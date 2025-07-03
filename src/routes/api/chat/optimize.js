import { getLLM } from './llm.js';
import { sanitizeInput } from '../../../lib/utils.js';

// Query optimization functions
export async function optimizeQuery(question, optimizationMethod, optimizationConfig, llm) {
	// Before using 'question', sanitize it
	question = sanitizeInput(question);

	if (optimizationMethod === 'semantic') {
		return question;
	} else if (optimizationMethod === 'hyde') {
		// HyDE: Hypothetical Document Embeddings
		const hydeModel = optimizationConfig?.hyde_model || 'gpt-4o-mini';
		const hydeLLM = getLLM(hydeModel, 0.3);
		
		const hydePrompt = {
			role: 'user',
			content: `Given the following question, write a hypothetical document that would contain the answer. This document should be written in a way that would be similar to how the actual answer would be presented in a real document.

Question: ${question}

Hypothetical document:`
		};

		try {
			const response = await hydeLLM.invoke([hydePrompt]);
			return response.content;
		} catch (error) {
			console.error('HyDE optimization failed:', error);
			return question;
		}
	} else if (optimizationMethod === 'hybrid') {
		// Hybrid search: combine semantic and keyword search
		// For now, return the original question - hybrid search would be implemented in the retrieval step
		return question;
	}

	return question;
} 