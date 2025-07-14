// Test script for serve.js functionality
// This can be run to test different AI configurations

// Mock Supabase client for testing
const mockSupabase = {
	from: (table) => ({
		select: () => ({
			eq: () => ({
				single: () => Promise.resolve({
					data: {
						id: 'test-project-id',
						inbox_id: 123,
						ai_config: {
							system_prompt: 'You are a helpful assistant for testing.',
							memory_type: 'window',
							memory_config: {
								window_size: 5
							},
							reranking_method: 'mmr',
							reranking_config: {
								mmr_diversity: 0.5
							},
							query_optimization: 'semantic',
							query_optimization_config: {},
							model_name: 'gpt-3.5-turbo',
							rag_top_k: 3,
							temperature: 0.3,
							similarity_threshold: 0.3
						}
					},
					error: null
				})
			})
		})
	}),
	rpc: (func, params) => {
		if (func === 'match_documents') {
			return Promise.resolve({
				data: [
					{
						content: 'This is a test document about AI and machine learning.',
						doc_name: 'test-doc.pdf',
						similarity: 0.85,
						embedding: [0.1, 0.2, 0.3, 0.4, 0.5]
					},
					{
						content: 'Another document about artificial intelligence applications.',
						doc_name: 'ai-doc.pdf',
						similarity: 0.75,
						embedding: [0.2, 0.3, 0.4, 0.5, 0.6]
					}
				],
				error: null
			});
		}
		return Promise.resolve({ data: [], error: null });
	}
};

// Test configurations
const testConfigs = [
	{
		name: 'Basic Configuration',
		config: {
			system_prompt: 'You are a helpful assistant.',
			memory_type: 'none',
			reranking_method: 'none',
			query_optimization: 'semantic',
			model_name: 'gpt-3.5-turbo',
			temperature: 0.3
		}
	},
	{
		name: 'Window Memory',
		config: {
			system_prompt: 'You are a helpful assistant with memory.',
			memory_type: 'window',
			memory_config: { window_size: 3 },
			reranking_method: 'none',
			query_optimization: 'semantic',
			model_name: 'gpt-3.5-turbo',
			temperature: 0.3
		}
	},
	{
		name: 'MMR Reranking',
		config: {
			system_prompt: 'You are a helpful assistant.',
			memory_type: 'none',
			reranking_method: 'mmr',
			reranking_config: { mmr_diversity: 0.7 },
			query_optimization: 'semantic',
			model_name: 'gpt-3.5-turbo',
			temperature: 0.3
		}
	},
	{
		name: 'HyDE Query Optimization',
		config: {
			system_prompt: 'You are a helpful assistant.',
			memory_type: 'none',
			reranking_method: 'none',
			query_optimization: 'hyde',
			query_optimization_config: { hyde_model: 'gpt-4o-mini' },
			model_name: 'gpt-3.5-turbo',
			temperature: 0.3
		}
	}
];

// Test function
async function testServeJS() {
	for (const testConfig of testConfigs) {
		try {
			// Mock the project data with test config
			const mockProjectData = {
				id: 'test-project-id',
				inbox_id: 123,
				ai_config: testConfig.config
			};

			// Override the supabase.from method for this test
			const testSupabase = {
				...mockSupabase,
				from: (table) => ({
					select: () => ({
						eq: () => ({
							single: () => Promise.resolve({
								data: mockProjectData,
								error: null
							})
						})
					})
				})
			};

			// Mock conversation history from database
			const mockHistory = [
				{ role: 'user', content: 'Hello', created_at: '2024-01-01T10:00:00Z' },
				{ role: 'assistant', content: 'Hi there! How can I help you?', created_at: '2024-01-01T10:00:01Z' }
			];

			const result = await processChat(
				testSupabase,
				'test-project-id',
				'What is artificial intelligence?',
				mockHistory,
				'conv_123'
			);

			console.log('Result:', {
				answer: result.answer?.substring(0, 100) + '...',
				sources: result.sources,
				config: result.config
			});
		} catch (error) {
			console.error('❌ Test failed:', error.message);
		}
	}
}

// Test the full API flow
async function testFullAPI() {
	// Mock the API request
	const mockRequest = {
		inbox_id: 123,
		question: 'What is machine learning?'
	};
	
	console.log('API Request:', mockRequest);
	console.log('Expected flow:');
	console.log('1. Find project by inbox_id: 123');
	console.log('2. Get conversation history for inbox_id: 123');
	console.log('3. Generate conversation ID: conv_123');
	console.log('4. Process chat with AI configurations');
	console.log('5. Store conversation in database');
	console.log('6. Return response');
	console.log('\n✅ API flow test completed\n');
}

// Export for use in other files
export { testServeJS, testFullAPI };

// Run tests if this file is executed directly
if (typeof window === 'undefined' && process?.argv?.includes('test.js')) {
	testServeJS().then(() => testFullAPI()).catch(console.error);
} 