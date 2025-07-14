import { routeQuery } from './router.js';
import { getLLM, getEmbeddings } from './llm.js';
import { getMemoryContext } from './memory.js';
import { rerankResults } from './rerank.js';
import { optimizeQuery } from './optimize.js';
import { sanitizeInput } from '../../../lib/utils.js';

// Main chat processing function
export async function processChat(supabase, projectId, question, history = [], conversationId = null, userId = null, useRouter = true, inboxId = null) {
	const timings = {};
	const stepStart = () => Date.now();
	let t0 = stepStart();
	let errorMessage = null;
	let tokenUsage = {};
	let modelProvider = 'openai';

	try {
		// 1. Fetch project configuration - only get what we need
		timings.config = stepStart();
		const { data: projectData, error: projectErr } = await supabase
			.from('projects')
			.select('ai_config')
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

		// 2. Get full summary from conversation history (no additional DB call needed)
		let fullSummary = '';
		if (useRouter && (memory_type === 'summary' || router_config?.rag_metadata)) {
			// Use the most recent summary from conversation history
			const recentSummaries = history
				.map(msg => msg.summary)
				.filter(Boolean)
				.reverse(); // Most recent first
			
			if (recentSummaries.length > 0) {
				fullSummary = recentSummaries[0]; // Most recent summary
			}
		}

		// 3. Get hybrid memory context (this will fetch only the needed summaries)
		const memoryResult = await getMemoryContext(
			supabase, projectId, memory_type, memory_config, conversationId, history, question, inboxId
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
			// 4. Router context: last 2 complete chat messages + full summary
			timings.routing = stepStart();
			const routerLLM = getLLM('gpt-4o', 0.1);
			
			// Get last 2 complete chat messages instead of summaries
			console.log('ROUTER DEBUG - History length:', history.length);
			console.log('ROUTER DEBUG - History entries:', history.slice(-3));
			
			// Get last 2 messages with actual content
			const lastTwoMessages = history
				.slice(-2)
				.filter(msg => msg && msg.role && msg.content && msg.content.trim())
				.map(msg => `${msg.role}: ${msg.content}`)
				.join('\n');
			
			console.log('ROUTER INPUT - Question:', question);
			console.log('ROUTER INPUT - Last 2 Chat Messages:', lastTwoMessages);
			console.log('ROUTER INPUT - Full Summary:', fullSummary);
			console.log('ROUTER INPUT - RAG Metadata:', router_config?.rag_metadata);
			routerResult = await routeQuery(system_prompt, question, routerLLM, lastTwoMessages, fullSummary, router_config);
			console.log('ROUTER OUTPUT - Routes:', routerResult.routes);
			
			// Capture token usage from router (if available in routerResult)
			if (routerResult.tokenUsage) {
				tokenUsage.router = routerResult.tokenUsage;
			}
			timings.routing = stepStart() - timings.routing;
		}
		const routerRoutes = routerResult.routes || [];
		const useMemory = routerRoutes.includes('memory');
		const useRag = routerRoutes.includes('rag');
		// Reframe should only be used when RAG is also selected
		const useReframe = routerRoutes.includes('reframe') && useRag;
		// Check if router suggests handoff
		const useHandoff = routerRoutes.includes('handoff');

		// Always use memory context, only decide on RAG
		let contextSections = [];
		let allHistory = [];
		const windowSize = memory_config?.window_size || 2;
		if (useMemory) {
			allHistory = [summary, ...windowSummaries, ...history].filter(Boolean);
			if (summary) contextSections.push(`Summary so far:\n${summary}`);
			if (windowSummaries.length > 0) contextSections.push(`Recent summaries:\n${windowSummaries.slice(-windowSize).join('\n')}`);
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
			console.log('REFRAME - Original Question:', question);
			const reframeResp = await reframeLLM.invoke([{ role: 'human', content: reframePrompt }]);
			reframedQuestion = reframeResp.content.trim();
			console.log('REFRAME - Reframed Question:', reframedQuestion);
			
			// Capture token usage from reframe
			if (reframeResp.usage) {
				tokenUsage.reframe = {
					prompt_tokens: reframeResp.usage.promptTokens,
					completion_tokens: reframeResp.usage.completionTokens,
					total_tokens: reframeResp.usage.totalTokens
				};
			} else if (reframeResp.response_metadata?.usage) {
				tokenUsage.reframe = {
					prompt_tokens: reframeResp.response_metadata.usage.prompt_tokens,
					completion_tokens: reframeResp.response_metadata.usage.completion_tokens,
					total_tokens: reframeResp.response_metadata.usage.total_tokens
				};
			} else if (reframeResp.llmOutput?.tokenUsage) {
				tokenUsage.reframe = {
					prompt_tokens: reframeResp.llmOutput.tokenUsage.promptTokens,
					completion_tokens: reframeResp.llmOutput.tokenUsage.completionTokens,
					total_tokens: reframeResp.llmOutput.tokenUsage.totalTokens
				};
			}
			console.log('REFRAME OUTPUT - Captured Token Usage:', tokenUsage.reframe);
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
			const rerankResult = await rerankResults(
				matches || [], reranking_method, reranking_config, getLLM(model_name, temperature), question
			);
			rerankedMatches = rerankResult.results || rerankResult; // Handle both new and old format
			ragContext = rerankedMatches.length > 0 
				? rerankedMatches.map(m => m.content).join('\n---\n') 
				: '';
			sources = rerankedMatches.length > 0 
				? [...new Set(rerankedMatches.map(m => m.doc_name))] 
				: [];
			
			// Capture token usage from rerank
			if (rerankResult.tokenUsage) {
				tokenUsage.rerank = rerankResult.tokenUsage;
			}
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
		
		console.log('MAIN LLM INPUT - System Prompt:', system_prompt);
		console.log('MAIN LLM INPUT - Context Sections:', contextSections);
		console.log('MAIN LLM INPUT - RAG Context:', ragContext);
		console.log('MAIN LLM INPUT - User Question:', question);
		console.log('MAIN LLM INPUT - Model:', model_name);
		console.log('MAIN LLM INPUT - Temperature:', temperature);
		console.log('MAIN LLM INPUT - Used RAG:', usedRag);
		
		const prompt = [
			{ role: 'system', content: systemContent },
			{ role: 'user', content: question },
			{ role: 'system', content: 'Please answer the question above.\n\nAfter your answer, write a concise summary of this Q&A turn (user question and your answer) in under 100 characters.\n\nRespond in JSON:\n{\n  "answer": "...",\n  "turn_summary": "..."\n}' }
		];
		
		// Log the complete prompt as a string
		console.log('MAIN LLM COMPLETE PROMPT STRING:');
		prompt.forEach((p, i) => {
			console.log(`--- Message ${i + 1} (${p.role}) ---`);
			console.log(p.content);
			console.log('---');
		});
		
		const resp = await llm.invoke(prompt);
		console.log('MAIN LLM OUTPUT - Raw Response:', resp.content);
		console.log('MAIN LLM OUTPUT - Response Length:', resp.content.length);
		
		// Capture token usage from the response
		if (resp.usage) {
			tokenUsage.main = {
				prompt_tokens: resp.usage.promptTokens,
				completion_tokens: resp.usage.completionTokens,
				total_tokens: resp.usage.totalTokens
			};
		} else if (resp.response_metadata?.usage) {
			tokenUsage.main = {
				prompt_tokens: resp.response_metadata.usage.prompt_tokens,
				completion_tokens: resp.response_metadata.usage.completion_tokens,
				total_tokens: resp.response_metadata.usage.total_tokens
			};
		} else if (resp.llmOutput?.tokenUsage) {
			tokenUsage.main = {
				prompt_tokens: resp.llmOutput.tokenUsage.promptTokens,
				completion_tokens: resp.llmOutput.tokenUsage.completionTokens,
				total_tokens: resp.llmOutput.tokenUsage.totalTokens
			};
		}
		console.log('MAIN LLM OUTPUT - Captured Token Usage:', tokenUsage.main);
		
		try {
			const parsed = JSON.parse(resp.content);
			answer = parsed.answer;
			turnSummary = parsed.turn_summary;
			console.log('MAIN LLM OUTPUT - Parsed Answer:', answer);
			console.log('MAIN LLM OUTPUT - Turn Summary:', turnSummary);
		} catch (parseError) {
			console.warn('MAIN LLM OUTPUT - Failed to parse JSON, using raw response');
			console.log('MAIN LLM OUTPUT - Raw response content:', resp.content);
			answer = resp.content;
			turnSummary = null;
		}
		
		timings.llm = stepStart() - timings.llm;

		// Check for handoff conditions
		let shouldHandoff = false;
		let handoffReason = '';
		let confidenceScore = 1.0;

		// 1. Router suggested handoff
		if (useHandoff) {
			shouldHandoff = true;
			handoffReason = 'Router determined question requires human assistance';
		}
		
		// 2. Low confidence in response (if we can extract it)
		if (answer && answer.toLowerCase().includes("i can't") || 
			answer.toLowerCase().includes("i don't know") ||
			answer.toLowerCase().includes("i cannot help") ||
			answer.toLowerCase().includes("i'm not sure")) {
			confidenceScore = 0.3;
			if (confidenceScore < 0.5) {
				shouldHandoff = true;
				handoffReason = 'Low confidence response detected';
			}
		}
		
		// 3. Explicit customer request for human
		if (question.toLowerCase().includes("speak to human") ||
			question.toLowerCase().includes("talk to agent") ||
			question.toLowerCase().includes("real person") ||
			question.toLowerCase().includes("human agent")) {
			shouldHandoff = true;
			handoffReason = 'Customer explicitly requested human agent';
		}

		// 8. Update memory if configured (simplified - summaries are already saved in conversations table)
		if (memory_type === 'summary') {
			// No need to save to summarization_memory table since summaries are already in conversations table
			// The turnSummary is already saved with the conversation entry
			console.log('MEMORY - Summary already saved in conversation table:', turnSummary);
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
					inbox_id: inboxId,
					chat_id: conversationId,
					entity_type: 'conversation',
					entity_id: conversationId, // Now TEXT, can be phone number or string
					embedding: conversationEmbedding,
					content: conversationText
				});
			if (vecError) console.error('Error saving vector memory:', vecError);
		}

		const result = {
			answer,
			sources,
			turn_summary: turnSummary,
			confidence_score: confidenceScore,
			used_rag: usedRag,
			should_handoff: shouldHandoff,
			handoff_reason: handoffReason,
			chat_status: shouldHandoff ? 'human_takeover' : 'active',
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
		
		// Calculate total token usage across all operations
		let totalTokens = 0;
		let totalPromptTokens = 0;
		let totalCompletionTokens = 0;
		
		Object.values(tokenUsage).forEach(usage => {
			if (usage && typeof usage === 'object') {
				totalTokens += usage.total_tokens || 0;
				totalPromptTokens += usage.prompt_tokens || 0;
				totalCompletionTokens += usage.completion_tokens || 0;
			}
		});
		
		// Add totals to token usage
		tokenUsage.total = {
			total_tokens: totalTokens,
			prompt_tokens: totalPromptTokens,
			completion_tokens: totalCompletionTokens
		};
		
		console.log('PROCESSCHAT OUTPUT - Final Token Usage:', tokenUsage);
		console.log('PROCESSCHAT OUTPUT - Total Tokens Used:', totalTokens);
		console.log('PROCESSCHAT OUTPUT - Final Analytics:', result.analytics);
		
		return result;

	} catch (error) {
		timings.error = stepStart() - t0;
		console.error('Chat processing error:', error);
		throw error;
	}
} 