import { sanitizeInput } from '../../../lib/utils.js';

// Reranking functions
export async function rerankResults(results, rerankingMethod, rerankingConfig, llm, question) {
	if (rerankingMethod === 'none') {
		return results;
	}

	if (rerankingMethod === 'mmr') {
		// Implement MMR (Maximal Marginal Relevance) reranking
		const diversity = rerankingConfig?.mmr_diversity || 0.5;
		return mmrRerank(results, diversity);
	} else if (rerankingMethod === 'llm') {
		// Implement LLM-based reranking
		const rerankingModel = rerankingConfig?.llm_reranking_model || 'gpt-4o-mini';
		// getLLM should be imported from llm.js in final refactor
		return await llmRerank(results, llm, question);
	}

	return results;
}

export function mmrRerank(results, diversity = 0.5) {
	if (results.length <= 1) return results;

	const reranked = [results[0]]; // Start with highest similarity
	const remaining = results.slice(1);

	while (remaining.length > 0 && reranked.length < results.length) {
		let bestIdx = 0;
		let bestScore = -1;

		for (let i = 0; i < remaining.length; i++) {
			const relevance = remaining[i].similarity;
			const diversityScore = Math.min(...reranked.map(r => 
				calculateCosineDistance(remaining[i].embedding, r.embedding)
			));
			const mmrScore = diversity * diversityScore + (1 - diversity) * relevance;

			if (mmrScore > bestScore) {
				bestScore = mmrScore;
				bestIdx = i;
			}
		}

		reranked.push(remaining[bestIdx]);
		remaining.splice(bestIdx, 1);
	}

	return reranked;
}

export async function llmRerank(results, llm, question) {
	if (results.length <= 1) return results;

	// Before using 'question', sanitize it
	question = sanitizeInput(question);

	const rerankingPrompt = {
		role: 'user',
		content: `You are a document reranker. Given a list of document chunks, rank them by relevance to the user's question. Return only the indices in order of relevance (most relevant first).

Question: ${question}

Documents:
${results.map((r, i) => `${i}: ${r.content.substring(0, 200)}...`).join('\n')}

Return only the indices (0-based) in order of relevance, separated by commas:`
	};

	try {
		const response = await llm.invoke([rerankingPrompt]);
		const rankedIndices = response.content.split(',').map(i => parseInt(i.trim())).filter(i => !isNaN(i));
		return rankedIndices.map(i => results[i]).filter(Boolean);
	} catch (error) {
		console.error('LLM reranking failed:', error);
		return results; // Fallback to original order
	}
}

// Helper function for cosine distance calculation
function calculateCosineDistance(vec1, vec2) {
	if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
	
	const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
	const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
	const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
	
	if (magnitude1 === 0 || magnitude2 === 0) return 0;
	
	return dotProduct / (magnitude1 * magnitude2);
} 