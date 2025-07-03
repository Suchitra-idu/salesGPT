import { routeQuery } from './router.js';
import { getLLM, getEmbeddings } from './llm.js';
import { getMemoryContext } from './memory.js';
import { rerankResults } from './rerank.js';
import { optimizeQuery } from './optimize.js';
import { sanitizeInput } from '../../../lib/utils.js';

// Main chat processing function
export async function processChat(supabase, projectId, question, history = [], conversationId = null, userId = null, useRouter = true) {
	const timings = {};
	const stepStart = () => Date.now();
	let t0 = stepStart();
	let errorMessage = null;
	let tokenUsage = {};
	let modelProvider = 'openai';

	try {
		// 1. Fetch project configuration
		timings.config = stepStart();
		const { data: projectData, error: projectErr } = await supabase
			.from('projects')
			.select('*')
			.eq('id', projectId)
			.single();
		timings.config = stepStart() - timings.config;

		if (projectErr || !projectData) {
			throw new Error('Project not found or error fetching project');
		}

		const aiConfig = projectData.ai_config || {};
		const {
			system_prompt = 'You are a helpful assistant for answering questions about project documents.',
			memory_type = 'none',
			memory_config = {},
			reranking_method = 'none',
			reranking_config = {},
			query_optimization = 'semantic',
			query_optimization_config = {},
			model_name = 'GPT-4.1',
			rag_top_k = 5,
			temperature = 0.3,
			similarity_threshold = 0.3,
			max_conversation_messages = 20
		} = aiConfig;

		// Before using 'question', sanitize it
		question = sanitizeInput(question);

		// 2. Get hybrid memory context
		const memoryResult = await getMemoryContext(
			supabase, projectId, memory_type, memory_config, conversationId, history, question
		);
		let windowSummaries = memoryResult.windowSummaries;
		let summary = memoryResult.summary;
		let vectorContext = memoryResult.vectorContext;

		let route = 'none';
		let needs_reframe = false;
		let usedRag = false;
		let memoryContext = '';
		let memoryMessages = [];
		let reframedQuestion = question;
		let ragContext = '';
		let sources = [];
		let rerankedMatches = [];
		let embeddings;

		if (useRouter) {
			// 3. Router context: last 2 summaries + summary
			const last2Summaries = windowSummaries.slice(-2).join('\n');
			const routerContext = [last2Summaries, summary ? `Summary: ${summary}` : ''].filter(Boolean).join('\n');
			const routerLLM = getLLM('GPT-4.1', 0.1);
			let routerResult = await routeQuery(system_prompt, question, routerLLM, routerContext);
			route = routerResult.route;
			needs_reframe = routerResult.needs_reframe;
			timings.routing = stepStart() - timings.routing;
		}

		// Always use memory context, only decide on RAG
		let last2Summaries = windowSummaries.slice(-2).join('\n');
		if (needs_reframe) {
			let reframeContext = [last2Summaries, summary ? `Summary: ${summary}` : ''].filter(Boolean).join('\n');
			const reframeLLM = getLLM('GPT-4.1', 0.1);
			const reframePrompt = `Given the following context and question, rephrase the question to be maximally clear for document retrieval.\n\nContext:\n${reframeContext}\n\nQuestion:\n${question}\n\nRephrased question:`;
			const reframeResp = await reframeLLM.invoke([{ role: 'human', content: reframePrompt }]);
			reframedQuestion = reframeResp.content.trim();
		}

		if (route === 'rag') {
			embeddings = getEmbeddings('text-embedding-3-small');
			let searchQuery;
			if (needs_reframe) {
				// If reframed, use only the reframed question for RAG
				searchQuery = reframedQuestion;
			} else {
				// If not reframed, use summary and last2Summaries in the RAG query
				let contextParts = [];
				if (summary) contextParts.push(summary);
				if (last2Summaries) contextParts.push(last2Summaries);
				contextParts.push(`Question: ${reframedQuestion}`);
				searchQuery = contextParts.filter(Boolean).join('\n\n');
			}
			const questionEmbedding = await embeddings.embedQuery(searchQuery);
			const { data: matches, error: matchErr } = await supabase.rpc('match_documents', {
				match_count: rag_top_k,
				match_threshold: similarity_threshold,
				p_project: projectId,
				query_embedding: questionEmbedding
			});
			if (matchErr) throw matchErr;
			rerankedMatches = await rerankResults(
				matches || [], reranking_method, reranking_config, getLLM(model_name, temperature), question
			);
			ragContext = rerankedMatches.length > 0 
				? rerankedMatches.map(m => m.content).join('\n---\n') 
				: '';
			sources = rerankedMatches.length > 0 
				? [...new Set(rerankedMatches.map(m => m.doc_name))] 
				: [];
			usedRag = true;
		} else {
			usedRag = false;
		}

		// 7. Compose final prompt and get answer
		let allHistory = [];
		let contextSections = [];
		const windowSize = memory_config?.window_size || 2;
		if (memory_type === 'summary') {
			allHistory = [summary, ...windowSummaries, ...history].filter(Boolean);
			if (summary) contextSections.push(`Summary so far:\n${summary}`);
			if (windowSummaries.length > 0) contextSections.push(`Recent summaries:\n${windowSummaries.slice(-windowSize).join('\n')}`);
		} else if (memory_type === 'window') {
			allHistory = [summary, ...windowSummaries, ...history].filter(Boolean);
			if (summary) contextSections.push(`Summary so far:\n${summary}`);
			if (windowSummaries.length > 0) contextSections.push(`Recent summaries:\n${windowSummaries.slice(-windowSize).join('\n')}`);
			if (history.length > 0) {
				const recentHistory = history.slice(-windowSize).map(m => `${m.role}: ${m.content}`).join('\n');
				contextSections.push(`Recent conversation:\n${recentHistory}`);
			}
		} else if (memory_type === 'vector') {
			// For vector memory, use vectorContext as primary, plus recent windowSummaries/history for flow
			allHistory = [...windowSummaries, ...history];
			if (vectorContext) contextSections.push(`Vector memory:\n${vectorContext}`);
			if (windowSummaries.length > 0) contextSections.push(`Recent summaries:\n${windowSummaries.join('\n')}`);
		} else {
			allHistory = [...windowSummaries, ...history];
			if (windowSummaries.length > 0) contextSections.push(`Recent summaries:\n${windowSummaries.join('\n')}`);
		}
		let chatHistory = allHistory.slice(-max_conversation_messages);

		let answer;
		let turnSummary = null;
		// Always combine answer and per-turn summary in one LLM call
		const llm = getLLM(model_name, temperature);
		let ragSection = ragContext ? `Context:\n${ragContext}` : '';
		const prompt = [
			{ role: 'system', content: system_prompt },
			...contextSections.map(content => ({ role: 'system', content })),
			...(ragSection ? [{ role: 'system', content: ragSection }] : []),
			{ role: 'user', content: question },
			{ role: 'system', content: 'Please answer the question above.\n\nAfter your answer, write a concise summary of this Q&A turn (user question and your answer) in under 100 characters.\n\nRespond in JSON:\n{\n  "answer": "...",\n  "turn_summary": "..."\n}' }
		];
		const resp = await llm.invoke(prompt);
		try {
			const parsed = JSON.parse(resp.content);
			answer = parsed.answer;
			turnSummary = parsed.turn_summary;
		} catch {
			answer = resp.content;
			turnSummary = null;
		}

		// 8. Update memory if configured (as before)
		if (memory_type === 'summary' && conversationId) {
			let newSummary = turnSummary;
			if (!newSummary) {
				// fallback to old method if turnSummary not available
				const { data: previousSummary } = await supabase
					.from('summarization_memory')
					.select('summary')
					.eq('project_id', projectId)
					.eq('conversation_id', conversationId)
					.single();
				let summaryPrompt;
				if (previousSummary?.summary) {
					summaryPrompt = `You are assisting with memory summarization for a RAG-based AI chatbot. Your goal is to maintain a concise summary of the conversation history to help the LLM retain relevant context.\n\nPrevious summary:\n${previousSummary.summary}\n\nNew exchange:\nUser: ${question}\nAI: ${answer}\n\nUpdate the summary to include this latest exchange. Keep the total summary under ${memory_config.summary_length || 200} characters. Prioritize recent interactions while gradually omitting older, less relevant details.`;
				} else {
					summaryPrompt = `You are assisting with memory summarization for a RAG-based AI chatbot. Your goal is to maintain a concise summary of the conversation history to help the LLM retain relevant context.\n\nNew conversation exchange:\nUser: ${question}\nAI: ${answer}\n\nWrite a summary of this exchange in ${memory_config.summary_length || 200} characters or less. Focus on the most recent conversation details, as earlier context will be gradually forgotten.`;
				}
				const summaryLLM = getLLM('GPT-4.1', 0.1);
				const summaryResponse = await summaryLLM.invoke([{ role: 'human', content: summaryPrompt }]);
				newSummary = summaryResponse.content;
			}
			if (newSummary) {
				const { error: sumError } = await supabase
					.from('summarization_memory')
					.upsert({
						project_id: projectId,
						conversation_id: conversationId,
						summary: newSummary
					}, {
						onConflict: 'project_id,conversation_id'
					});
				if (sumError) console.error('Error saving summary memory:', sumError);
			}
		} else if (memory_type === 'vector' && conversationId) {
			if (!embeddings) {
				embeddings = getEmbeddings('text-embedding-3-small');
			}
			const conversationText = `${question}\n\nAnswer: ${answer}`;
			const conversationEmbedding = await embeddings.embedQuery(conversationText);
			const { error: vecError } = await supabase
				.from('vector_memory')
				.insert({
					project_id: projectId,
					entity_type: 'conversation',
					entity_id: conversationId, // Now TEXT, can be phone number or string
					embedding: conversationEmbedding,
					content: conversationText
				});
			if (vecError) console.error('Error saving vector memory:', vecError);
		}

		return {
			answer,
			sources,
			turn_summary: turnSummary,
			used_rag: usedRag,
			config: {
				memory_type,
				reranking_method,
				query_optimization,
				model_name,
				temperature,
				similarity_threshold
			},
			analytics: {
				timings,
				token_usage: tokenUsage,
				model_name,
				provider: modelProvider,
				temperature,
				error: errorMessage,
				user_id: userId
			}
		};

	} catch (error) {
		timings.error = stepStart() - t0;
		console.error('Chat processing error:', error);
		throw error;
	}
} 