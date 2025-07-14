import { getEmbeddings } from './llm.js';
import { validateUUID } from '../../../lib/utils.js';

// Hybrid Memory management function
export async function getMemoryContext(
	supabase,
	projectId,
	memoryType,
	memoryConfig,
	chatId,
	history,
	question,
	inboxId = null
) {
	// Before using projectId or chatId, validate them
	if (!projectId) {
		throw new Error('Invalid projectId');
	}
	if (!chatId) {
		throw new Error('Invalid chatId');
	}

	// Get sliding window of summaries from conversation history (no additional DB calls needed)
	const windowSize = memoryConfig?.window_size || 10;
	
	// Extract summaries from conversation history (each message has a summary)
	const historySummaries = history
		.map(msg => msg.summary)
		.filter(Boolean)
		.filter((summary, index, arr) => arr.indexOf(summary) === index); // Remove duplicates
	
	// Take the last N unique summaries
	const windowSummaries = historySummaries.slice(-windowSize);
	
	console.log("MEMORY - Window Summaries:", windowSummaries);

	// Get summary from conversation history (no additional DB call needed)
	let summary = '';
	if (memoryType === 'summary' && history.length > 0) {
		// Use the most recent summary from conversation history
		const recentSummaries = history
			.map(msg => msg.summary)
			.filter(Boolean)
			.reverse(); // Most recent first
		
		if (recentSummaries.length > 0) {
			summary = recentSummaries[0]; // Most recent summary
		}
	}

	// Get vector memory if needed
	let vectorContext = '';
	if (memoryType === 'vector') {
		const threshold = memoryConfig?.vector_similarity_threshold || 0.7;
		const topK = memoryConfig?.vector_top_k || 5;
		let queryText = question;
		if (history.length > 0) {
			const lastMessage = history[history.length - 1];
			queryText = `Context from previous turn:\n${lastMessage.role}: ${lastMessage.content}\n\nCurrent Question: ${question}`;
		}
		const embeddings = getEmbeddings('text-embedding-3-small');
		const conversationEmbedding = await embeddings.embedQuery(queryText);
		const { data: vectorMemory } = await supabase.rpc('match_vector_memory', {
			project_id: projectId,
			query_embedding: conversationEmbedding,
			match_threshold: threshold,
			match_count: topK,
			inbox_id: inboxId,
			chat_id: chatId
		});
		if (vectorMemory && vectorMemory.length > 0) {
			vectorContext = vectorMemory.map(vm => vm.content).join('\n');
		}
	}

	return {
		windowSummaries,
		summary,
		vectorContext
	};
} 