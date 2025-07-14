import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers';
import { env } from '$env/dynamic/private';

// Helper function to get LLM based on model name
export function getLLM(modelName, temperature = 0.3) {
	if (modelName.startsWith('gpt-')) {
		return new ChatOpenAI({
			modelName,
			temperature,
			openAIApiKey: env.OPENAI_API_KEY
		});
	} else if (modelName.startsWith('claude-')) {
		return new ChatAnthropic({
			modelName,
			temperature,
			anthropicApiKey: env.ANTHROPIC_API_KEY
		});
	} else if (modelName.startsWith('gemini-')) {
		return new ChatGoogleGenerativeAI({
			modelName,
			temperature,
			googleApiKey: env.GOOGLE_API_KEY
		});
	} else {
		// Default to OpenAI
		return new ChatOpenAI({
			modelName: 'gpt-3.5-turbo',
			temperature,
			openAIApiKey: env.OPENAI_API_KEY
		});
	}
}

// Helper function to get embeddings based on model name
export function getEmbeddings(modelName) {
	if (modelName.startsWith('text-embedding-')) {
		return new OpenAIEmbeddings({
			modelName,
			openAIApiKey: env.OPENAI_API_KEY
		});
	} else {
		// Hugging Face model
		return new HuggingFaceTransformersEmbeddings({
			modelName,
			apiKey: env.HUGGINGFACE_API_KEY
		});
	}
} 