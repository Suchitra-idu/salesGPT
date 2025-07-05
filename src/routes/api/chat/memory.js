import { getEmbeddings } from './llm.js';
import { validateUUID } from '../../../lib/utils.js';

// Hybrid Memory management function
export async function getMemoryContext(
	supabase,
	projectId,
	memoryType,
	memoryConfig,
	conversationId,
	history,
	question
) {
	// Before using projectId or conversationId, validate them
	if (!projectId) {
		throw new Error('Invalid projectId');
	}
	if (!conversationId) {
		throw new Error('Invalid conversationId');
	}

	// Always get sliding window of summaries
	const windowSize = memoryConfig?.window_size || 10;
	// history is expected to be an array of {content, answer, summary, ...}
	const windowSummaries = history
		.map(msg => msg.summary)
		.filter(Boolean)
		.slice(-windowSize);
	console.log("Windows summeries -------- ", windowSummaries)

	// Always get summary (summarization_memory only has project_id, no conversation_id)
	let summary = '';
	const { data: summaryData } = await supabase
		.from('summarization_memory')
		.select('summary')
		.eq('project_id', projectId)
		.single();
	if (summaryData?.summary) summary = summaryData.summary;

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
			match_count: topK
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