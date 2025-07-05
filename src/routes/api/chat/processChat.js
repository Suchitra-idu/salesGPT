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
			model_name = 'gpt-4o',
			rag_top_k = 5,
			temperature = 0.3,
			similarity_threshold = 0.3,
			max_conversation_messages = 20,
			router_config = undefined
		} = aiConfig;

		// Before using 'question', sanitize it
		console.log('Original question:', question);
		question = sanitizeInput(question);
		console.log('Sanitized question:', question);

		// 1. Fetch last N summary memories and full summary for the router
		const N = 3;
		let lastNSummaries = [];
		let fullSummary = '';
		try {
			const { data: summaryRows } = await supabase
				.from('summarization_memory')
				.select('summary')
				.eq('project_id', projectId)
				.order('created_at', { ascending: false })
				.limit(N);
			lastNSummaries = (summaryRows || []).map(row => row.summary).filter(Boolean);
			const { data: fullSummaryRow } = await supabase
				.from('summarization_memory')
				.select('summary')
				.eq('project_id', projectId)
				.order('created_at', { ascending: false })
				.limit(1)
				.single();
			fullSummary = fullSummaryRow?.summary || '';
		} catch (e) {
			lastNSummaries = [];
			fullSummary = '';
		}

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

		let routerResult = { routes: [] };
		if (useRouter) {
			// 3. Router context: last N summaries + full summary
			timings.routing = stepStart();
			const routerLLM = getLLM('gpt-4o', 0.1);
			console.log('ROUTER PROMPT:', JSON.stringify({
				lastNSummaries,
				fullSummary,
				rag_metadata: router_config?.rag_metadata,
				rag_examples: router_config?.rag_examples,
				reframe_examples: router_config?.reframe_examples,
				user_message: question
			}, null, 2));
			routerResult = await routeQuery(system_prompt, question, routerLLM, lastNSummaries, fullSummary, router_config);
			console.log('ROUTER DECISION:', JSON.stringify(routerResult, null, 2));
			timings.routing = stepStart() - timings.routing;
		}
		const routerRoutes = routerResult.routes || [];
		const useMemory = routerRoutes.includes('memory');
		const useRag = routerRoutes.includes('rag');
		// Reframe should only be used when RAG is also selected
		const useReframe = routerRoutes.includes('reframe') && useRag;

		// Always use memory context, only decide on RAG
		let contextSections = [];
		let allHistory = [];
		const windowSize = memory_config?.window_size || 2;
		if (useMemory) {
			allHistory = [fullSummary, ...lastNSummaries, ...history].filter(Boolean);
			if (fullSummary) contextSections.push(`Summary so far:\n${fullSummary}`);
			if (lastNSummaries.length > 0) contextSections.push(`Recent summaries:\n${lastNSummaries.slice(-windowSize).join('\n')}`);
		} else {
			// Only use last 2 turns and the question
			allHistory = history.slice(-2);
			if (allHistory.length > 0) contextSections.push(`Recent conversation:\n${allHistory.map(m => m.content).join('\n')}`);
		}
		let chatHistory = allHistory.slice(-max_conversation_messages);

		if (useReframe) {
			timings.reframe = stepStart();
			const reframeLLM = getLLM('gpt-4o', 0.1);
			const reframePrompt = `Given the following context and question, rephrase the question to be maximally clear for document retrieval.\n\nContext:\n${contextSections.join('\n')}\n\nQuestion:\n${question}\n\nRephrased question:`;
			const reframeResp = await reframeLLM.invoke([{ role: 'human', content: reframePrompt }]);
			reframedQuestion = reframeResp.content.trim();
			timings.reframe = stepStart() - timings.reframe;
		}

		if (useRag) {
			timings.rag = stepStart();
			embeddings = getEmbeddings('text-embedding-3-small');
			let searchQuery = useReframe ? reframedQuestion : question;
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
			timings.rag = stepStart() - timings.rag;
		}

		// 7. Compose final prompt and get answer
		timings.llm = stepStart();
		let answer;
		let turnSummary = null;
		// Always combine answer and per-turn summary in one LLM call
		const llm = getLLM(model_name, temperature);
		
		// Build a single comprehensive system prompt
		let systemContent = system_prompt;
		if (contextSections.length > 0) {
			systemContent += '\n\n' + contextSections.join('\n\n');
		}
		if (ragContext) {
			systemContent += '\n\nRelevant context:\n' + ragContext;
		}
		
		console.log('MAIN LLM PROMPT:', JSON.stringify({
			systemContent,
			question,
			contextSections,
			ragContext
		}, null, 2));
		
		// Before calling main LLM, log the final string prompt
		console.log('MAIN LLM FINAL PROMPT STRING:\n' + [
			{ role: 'system', content: systemContent },
			{ role: 'user', content: question },
			{ role: 'system', content: 'Please answer the question above.\n\nAfter your answer, write a concise summary of this Q&A turn (user question and your answer) in under 100 characters.\n\nRespond in JSON:\n{\n  "answer": "...",\n  "turn_summary": "..."\n}' }
		].map(p => `Role: ${p.role}\nContent:\n${p.content}\n`).join('\n'));
		
		const prompt = [
			{ role: 'system', content: systemContent },
			{ role: 'user', content: question },
			{ role: 'system', content: 'Please answer the question above.\n\nAfter your answer, write a concise summary of this Q&A turn (user question and your answer) in under 100 characters.\n\nRespond in JSON:\n{\n  "answer": "...",\n  "turn_summary": "..."\n}' }
		];
		
		console.log('Sending prompt to LLM:', {
			system_prompt_length: systemContent.length,
			question: question,
			context_sections: contextSections.length,
			has_rag_context: !!ragContext,
			used_rag: usedRag,
			model_name: model_name,
			temperature: temperature
		});
		
		console.log('Full prompt structure:', prompt.map(p => ({ role: p.role, content_length: p.content.length })));
		
		const resp = await llm.invoke(prompt);
		console.log('LLM response:', {
			content_length: resp.content.length,
			content_preview: resp.content.substring(0, 200) + '...',
			model_used: model_name
		});
		
		try {
			const parsed = JSON.parse(resp.content);
			answer = parsed.answer;
			turnSummary = parsed.turn_summary;
			console.log('Successfully parsed JSON response:', { answer_length: answer?.length, turn_summary: turnSummary });
		} catch (parseError) {
			console.warn('Failed to parse LLM response as JSON, using raw response:', parseError);
			console.log('Raw response content:', resp.content);
			answer = resp.content;
			turnSummary = null;
		}
		
		timings.llm = stepStart() - timings.llm;

		// 8. Update memory if configured (as before)
		if (memory_type === 'summary') {
			let newSummary = turnSummary;
			if (!newSummary) {
				// fallback to old method if turnSummary not available
				const { data: previousSummary } = await supabase
					.from('summarization_memory')
					.select('summary')
					.eq('project_id', projectId)
					.eq('inbox_id', conversationId)
					.single();
				let summaryPrompt;
				if (previousSummary?.summary) {
					summaryPrompt = `You are assisting with memory summarization for a RAG-based AI chatbot. Your goal is to maintain a concise summary of the conversation history to help the LLM retain relevant context.\n\nPrevious summary:\n${previousSummary.summary}\n\nNew exchange:\nUser: ${question}\nAI: ${answer}\n\nUpdate the summary to include this latest exchange. Keep the total summary under ${memory_config.summary_length || 200} characters. Prioritize recent interactions while gradually omitting older, less relevant details.`;
				} else {
					summaryPrompt = `You are assisting with memory summarization for a RAG-based AI chatbot. Your goal is to maintain a concise summary of the conversation history to help the LLM retain relevant context.\n\nNew conversation exchange:\nUser: ${question}\nAI: ${answer}\n\nWrite a summary of this exchange in ${memory_config.summary_length || 200} characters or less. Focus on the most recent conversation details, as earlier context will be gradually forgotten.`;
				}
				const summaryLLM = getLLM('gpt-4o', 0.1);
				const summaryResponse = await summaryLLM.invoke([{ role: 'human', content: summaryPrompt }]);
				newSummary = summaryResponse.content;
			}
			if (newSummary) {
				const { error: sumError } = await supabase
					.from('summarization_memory')
					.upsert({
						project_id: projectId,
						inbox_id: conversationId,
						summary: newSummary
					}, {
						onConflict: 'project_id,inbox_id'
					});
				if (sumError) console.error('Error saving summary memory:', sumError);
			}
		} else if (memory_type === 'vector') {
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