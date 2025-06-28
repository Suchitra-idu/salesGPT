<script>
	import LoadingSpinner from './LoadingSpinner.svelte';
	import { onMount } from 'svelte';
	import { derived } from 'svelte/store';

	export let project = {
		name: '',
		status: 'Active',
		inbox_id: '',
		reranking_method: 'none',
		memory_type: 'none',
		query_optimization: 'semantic',
		model_name: '',
		mmr_diversity: 0.5,
		llm_reranking_model: '',
		window_size: 10,
		summary_length: 200,
		vector_similarity_threshold: 0.7,
		hyde_model: '',
		hybrid_weight: 0.5,
		rag_top_k: 5, // for RAG retrieval
		vector_top_k: 5, // for vector memory retrieval
		temperature: 0.3,
		similarity_threshold: 0.3,
		system_prompt: ''
	};
	export let loading = false;
	export let editMode = false;
	export let onSave = () => {};
	export let onCancel = () => {};

	// Dropdown options (refined)
	const memoryTypes = [
		{ value: 'none', label: 'None' },
		{ value: 'window', label: 'Window' },
		{ value: 'summary', label: 'Summary' },
		{ value: 'vector', label: 'Vector' }
	];
	const rerankingMethods = [
		{ value: 'none', label: 'None' },
		{ value: 'mmr', label: 'MMR' },
		{ value: 'llm', label: 'LLM-based' }
	];
	const queryOptimizations = [
		{ value: 'semantic', label: 'Semantic Filtering (Recommended)' },
		{ value: 'hybrid', label: 'Hybrid Search (Keyword + Vector)' },
		{ value: 'hyde', label: 'HyDE (Hypothetical Document Embeddings)' }
	];
	const modelProviders = [
		{ value: 'openai', label: 'OpenAI' },
		{ value: 'anthropic', label: 'Anthropic' },
		{ value: 'perplexity', label: 'Perplexity' },
		{ value: 'google', label: 'Google' }
	];

	// Enhanced model options for LangChain compatibility
	const llmModels = [
		// OpenAI Models
		{ value: 'gpt-4o', label: 'GPT-4O (Most Capable)', provider: 'openai' },
		{ value: 'gpt-4o-mini', label: 'GPT-4O Mini (Fast & Efficient)', provider: 'openai' },
		{ value: 'gpt-4-turbo', label: 'GPT-4 Turbo (Balanced)', provider: 'openai' },
		{ value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Fastest)', provider: 'openai' },
		
		// Anthropic Models
		{ value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Latest)', provider: 'anthropic' },
		{ value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)', provider: 'anthropic' },
		{ value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Most Powerful)', provider: 'anthropic' },
		{ value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet (Balanced)', provider: 'anthropic' },
		{ value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Fastest)', provider: 'anthropic' },
		
		// Perplexity Models
		{ value: 'llama-3.1-8b-instruct', label: 'Llama 3.1 8B (Fast)', provider: 'perplexity' },
		{ value: 'llama-3.1-70b-instruct', label: 'Llama 3.1 70B (Powerful)', provider: 'perplexity' },
		{ value: 'mixtral-8x7b-instruct', label: 'Mixtral 8x7B (Balanced)', provider: 'perplexity' },
		{ value: 'codellama-70b-instruct', label: 'Code Llama 70B (Code Focused)', provider: 'perplexity' },
		
		// Google Models
		{ value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Most Capable)', provider: 'google' },
		{ value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Fast)', provider: 'google' },
		{ value: 'gemini-1.0-pro', label: 'Gemini 1.0 Pro (Stable)', provider: 'google' }
	];

	// Help text for query optimization options
	const queryOptimizationHelp = {
		semantic: 'Uses vector similarity to find the most relevant results based on meaning. Fast, accurate, and recommended for most queries.',
		hybrid: 'Combines keyword and semantic search for best of both worlds. Useful for datasets with both structured and unstructured data.',
		hyde: 'Uses an LLM to generate a hypothetical answer to your query, then finds documents similar to that answer. Best for complex or ambiguous queries, but slower and more expensive.'
	};

	// Help text for re-ranking methods
	const rerankingMethodHelp = {
		none: 'No re-ranking. Fastest, simplest, and sufficient for many use cases.',
		mmr: 'Maximal Marginal Relevance. Increases diversity and reduces redundancy in results.',
		llm: 'Uses an LLM for nuanced ranking. Most powerful, but higher cost and latency.'
	};
	// Help text for memory types
	const memoryTypeHelp = {
		none: 'No memory. Each query is stateless.',
		window: 'Remembers a window of recent messages for context.',
		summary: 'Summarizes past conversation for efficient context.',
		vector: 'Uses a vector store for long-term memory and retrieval.'
	};
	// Help text for model providers
	const modelProviderHelp = {
		openai: 'Most popular provider. Many models, strong ecosystem.',
		anthropic: 'Claude models. Strong on reasoning and safety.',
		perplexity: 'Web-augmented, up-to-date info. Competitive pricing.',
		google: 'Google Gemini and other models. Good for enterprise.'
	};

	// Parameter help texts
	const parameterHelp = {
		mmr_diversity: 'Controls diversity vs relevance trade-off. Higher values increase diversity.',
		llm_reranking_model: 'Model used for LLM-based re-ranking. Can be from any provider for optimal performance.',
		window_size: 'Number of recent messages to keep in memory.',
		summary_length: 'Maximum length of conversation summary in characters.',
		vector_similarity_threshold: 'Minimum similarity score for vector memory retrieval.',
		hyde_model: 'Model used for HyDE query generation. Can be from any provider for best results.',
		hybrid_weight: 'Weight between keyword (0) and semantic (1) search. 0.5 balances both.'
	};

	// Justification for chosen re-ranking methods:
	// - None: Fastest, simplest, and sufficient for many use cases.
	// - MMR (Maximal Marginal Relevance): Widely used, easy to implement, increases diversity and reduces redundancy in results.
	// - LLM-based: Most powerful for nuanced ranking, but higher cost and latency.
	// Other options (e.g., BERTScore, custom neural re-rankers) were not included due to high implementation/infra cost, limited real-world benefit for most SaaS use cases, and lack of robust support in mainstream frameworks like LangChain.

	// Refactored aiConfig with nested subconfigurations and system_prompt
	$: aiConfig = {
		system_prompt: project.system_prompt,
		memory_type: project.memory_type,
		memory_config:
			project.memory_type === 'window'
				? { window_size: project.window_size }
				: project.memory_type === 'summary'
				? { summary_length: project.summary_length }
				: project.memory_type === 'vector'
				? { vector_similarity_threshold: project.vector_similarity_threshold, vector_top_k: project.vector_top_k }
				: {},
		reranking_method: project.reranking_method,
		reranking_config:
			project.reranking_method === 'mmr'
				? { mmr_diversity: project.mmr_diversity }
				: project.reranking_method === 'llm'
				? { llm_reranking_model: project.llm_reranking_model }
				: {},
		query_optimization: project.query_optimization,
		query_optimization_config:
			project.query_optimization === 'hyde'
				? { hyde_model: project.hyde_model }
				: project.query_optimization === 'hybrid'
				? { hybrid_weight: project.hybrid_weight }
				: {},
		model_name: project.model_name,
		rag_top_k: project.rag_top_k,
		temperature: project.temperature,
		similarity_threshold: project.similarity_threshold
	};
</script>

<div class="border-t pt-6">

	<h3 class="mb-4 text-lg font-medium text-gray-900">
		{editMode ? 'Edit Project' : 'Add New Project'}
	</h3>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<div>
			<label for="project-name" class="mb-1 block text-sm font-medium text-gray-700">
				Project Name *
			</label>
			<input
				id="project-name"
				type="text"
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="Enter project name"
				bind:value={project.name}
				disabled={loading}
			/>
		</div>

		<div>
			<label for="status" class="mb-1 block text-sm font-medium text-gray-700"> Status </label>
			<select
				id="status"
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				bind:value={project.status}
				disabled={loading}
			>
				<option value="active">Active</option>
				<option value="inactive">Inactive</option>
				<option value="draft">Draft</option>
				<option value="completed">Completed</option>
				<option value="pending">Pending</option>
			</select>
		</div>

		<div>
			<label for="inbox-id" class="mb-1 block text-sm font-medium text-gray-700">
				Inbox ID
			</label>
			<input
				id="inbox-id"
				type="number"
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="e.g., 42"
				bind:value={project.inbox_id}
				disabled={loading}
			/>
		</div>

		<div class="md:col-span-2">
			<label for="system-prompt" class="mb-1 block text-sm font-medium text-gray-700">
				System Prompt
			</label>
			<textarea
				id="system-prompt"
				rows="4"
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="Enter system prompt for the AI assistant..."
				bind:value={project.system_prompt}
				disabled={loading}
			></textarea>
		</div>
	</div>

	<div class="flex flex-col md:flex-row gap-8">
		
		<div class="flex-1 md:order-2">
			<fieldset class="mt-6 border-t pt-4">
				<legend class="text-md font-semibold text-gray-800 mb-2">Advanced AI/Retrieval Options</legend>
				<div class="space-y-6">
					<!-- Re-ranking Method -->
					<div>
						<label for="reranking-method" class="mb-1 block text-sm font-medium text-gray-700">Re-ranking Method</label>
						<select id="reranking-method" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" bind:value={project.reranking_method} disabled={loading}>
							{#each rerankingMethods as method}
								<option value={method.value}>{method.label}</option>
							{/each}
						</select>
						<div class="text-xs text-gray-500 mt-1">{rerankingMethodHelp[project.reranking_method]}</div>
						
						<!-- MMR Parameters -->
						{#if project.reranking_method === 'mmr'}
							<div class="mt-3 p-3 bg-blue-50 rounded-md">
								<label for="mmr-diversity" class="mb-1 block text-sm font-medium text-gray-700">MMR Diversity (0-1)</label>
								<input 
									id="mmr-diversity" 
									type="number" 
									step="0.1" 
									min="0" 
									max="1" 
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
									placeholder="0.5" 
									bind:value={project.mmr_diversity} 
									disabled={loading} 
								/>
								<div class="text-xs text-gray-500 mt-1">{parameterHelp.mmr_diversity}</div>
							</div>
						{/if}
						
						<!-- LLM Re-ranking Parameters -->
						{#if project.reranking_method === 'llm'}
							<div class="mt-3 p-3 bg-blue-50 rounded-md">
								<label for="llm-reranking-model" class="mb-1 block text-sm font-medium text-gray-700">Re-ranking Model</label>
								<select 
									id="llm-reranking-model" 
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
									bind:value={project.llm_reranking_model} 
									disabled={loading}
								>
									{#each llmModels as model}
										<option value={model.value}>{model.label} ({model.provider})</option>
									{/each}
								</select>
								<div class="text-xs text-gray-500 mt-1">{parameterHelp.llm_reranking_model}</div>
							</div>
						{/if}
					</div>

					<!-- Memory Type -->
					<div>
						<label for="memory-type" class="mb-1 block text-sm font-medium text-gray-700">Memory Type</label>
						<select id="memory-type" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" bind:value={project.memory_type} disabled={loading}>
							{#each memoryTypes as mem}
								<option value={mem.value}>{mem.label}</option>
							{/each}
						</select>
						<div class="text-xs text-gray-500 mt-1">{memoryTypeHelp[project.memory_type]}</div>
						
						<!-- Window Memory Parameters -->
						{#if project.memory_type === 'window'}
							<div class="mt-3 p-3 bg-blue-50 rounded-md">
								<label for="window-size" class="mb-1 block text-sm font-medium text-gray-700">Window Size (messages)</label>
								<input 
									id="window-size" 
									type="number" 
									step="1" 
									min="1" 
									max="50" 
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
									placeholder="10" 
									bind:value={project.window_size} 
									disabled={loading} 
								/>
								<div class="text-xs text-gray-500 mt-1">{parameterHelp.window_size}</div>
							</div>
						{/if}
						
						<!-- Summary Memory Parameters -->
						{#if project.memory_type === 'summary'}
							<div class="mt-3 p-3 bg-blue-50 rounded-md">
								<label for="summary-length" class="mb-1 block text-sm font-medium text-gray-700">Summary Length (characters)</label>
								<input 
									id="summary-length" 
									type="number" 
									step="50" 
									min="100" 
									max="1000" 
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
									placeholder="200" 
									bind:value={project.summary_length} 
									disabled={loading} 
								/>
								<div class="text-xs text-gray-500 mt-1">{parameterHelp.summary_length}</div>
							</div>
						{/if}
						
						<!-- Vector Memory Parameters -->
						{#if project.memory_type === 'vector'}
							<div class="mt-3 p-3 bg-blue-50 rounded-md">
								<label for="vector-similarity-threshold" class="mb-1 block text-sm font-medium text-gray-700">Similarity Threshold (0-1)</label>
								<input 
									id="vector-similarity-threshold" 
									type="number" 
									step="0.1" 
									min="0" 
									max="1" 
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
									placeholder="0.7" 
									bind:value={project.vector_similarity_threshold} 
									disabled={loading} 
								/>
								<div class="text-xs text-gray-500 mt-1">{parameterHelp.vector_similarity_threshold}</div>
							</div>
						{/if}

						<!-- Top K (Vector Results) -->
						{#if project.memory_type === 'vector'}
							<div>
								<label for="vector-top-k" class="mb-1 block text-sm font-medium text-gray-700">
									Top K (Vector Results)
								</label>
								<input
									id="vector-top-k"
									type="number"
									step="1"
									min="1"
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
									placeholder="5"
									bind:value={project.vector_top_k}
									disabled={loading}
								/>
								<div class="text-xs text-gray-500 mt-1">
									Number of top similar documents to retrieve from the vector database.
								</div>
							</div>
						{/if}
					</div>

					<!-- Query Optimization -->
					<div>
						<label for="query-optimization" class="mb-1 block text-sm font-medium text-gray-700">Query Optimization</label>
						<select id="query-optimization" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" bind:value={project.query_optimization} disabled={loading}>
							{#each queryOptimizations as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
						<div class="text-xs text-gray-500 mt-1">{queryOptimizationHelp[project.query_optimization]}</div>
						
						<!-- HyDE Parameters -->
						{#if project.query_optimization === 'hyde'}
							<div class="mt-3 p-3 bg-blue-50 rounded-md">
								<label for="hyde-model" class="mb-1 block text-sm font-medium text-gray-700">HyDE Model</label>
								<select 
									id="hyde-model" 
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
									bind:value={project.hyde_model} 
									disabled={loading}
								>
									{#each llmModels as model}
										<option value={model.value}>{model.label} ({model.provider})</option>
									{/each}
								</select>
								<div class="text-xs text-gray-500 mt-1">{parameterHelp.hyde_model}</div>
							</div>
						{/if}
						
						<!-- Hybrid Search Parameters -->
						{#if project.query_optimization === 'hybrid'}
							<div class="mt-3 p-3 bg-blue-50 rounded-md">
								<label for="hybrid-weight" class="mb-1 block text-sm font-medium text-gray-700">Hybrid Weight (0-1)</label>
								<input 
									id="hybrid-weight" 
									type="number" 
									step="0.1" 
									min="0" 
									max="1" 
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
									placeholder="0.5" 
									bind:value={project.hybrid_weight} 
									disabled={loading} 
								/>
								<div class="text-xs text-gray-500 mt-1">{parameterHelp.hybrid_weight}</div>
							</div>
						{/if}
					</div>

					<!-- Model Name -->
					<div>
						<label for="model-name" class="mb-1 block text-sm font-medium text-gray-700">Main Model</label>
						<div class="space-y-2">
							<!-- Model Selection Toggle -->
							<div class="flex gap-2">
								<button 
									type="button"
									class="px-3 py-1 text-xs rounded border {project.model_selection_type === 'dropdown' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-gray-100 border-gray-300 text-gray-600'}"
									on:click={() => project.model_selection_type = 'dropdown'}
									disabled={loading}
								>
									Select from List
								</button>
								<button 
									type="button"
									class="px-3 py-1 text-xs rounded border {project.model_selection_type === 'custom' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-gray-100 border-gray-300 text-gray-600'}"
									on:click={() => project.model_selection_type = 'custom'}
									disabled={loading}
								>
									Custom Model
								</button>
							</div>
							
							<!-- Dropdown Selection -->
							{#if project.model_selection_type === 'dropdown'}
								<select 
									id="model-name-dropdown" 
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
									bind:value={project.model_name} 
									disabled={loading}
								>
									<option value="">-- Select a model --</option>
									{#each llmModels as model}
										<option value={model.value}>{model.label} ({model.provider})</option>
									{/each}
								</select>
							{:else}
								<!-- Custom Input -->
								<input 
									id="model-name-custom" 
									type="text" 
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
									placeholder="e.g., gpt-4o, claude-3-opus, custom-model-name" 
									bind:value={project.model_name} 
									disabled={loading} 
								/>
							{/if}
						</div>
						<div class="text-xs text-gray-500 mt-1">
							{project.model_selection_type === 'dropdown' 
								? 'Select from our curated list of LangChain-compatible models' 
								: 'Enter any custom model name supported by your provider'}
						</div>
					</div>

					<div>
						<label for="rag-top-k" class="mb-1 block text-sm font-medium text-gray-700">
							Top K (RAG Retrieval)
						</label>
						<input
							id="rag-top-k"
							type="number"
							step="1"
							min="1"
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							placeholder="5"
							bind:value={project.rag_top_k}
							disabled={loading}
						/>
						<div class="text-xs text-gray-500 mt-1">
							Number of top similar documents to retrieve for RAG (retrieval-augmented generation) queries.
						</div>
					</div>

					<!-- Add Temperature and Similarity Threshold inputs to advanced config section -->
					<div>
						<label for="temperature" class="mb-1 block text-sm font-medium text-gray-700">
							Temperature (0-2)
						</label>
						<input
							id="temperature"
							type="number"
							step="0.01"
							min="0"
							max="2"
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							placeholder="0.3"
							bind:value={project.temperature}
							disabled={loading}
						/>
						<div class="text-xs text-gray-500 mt-1">
							Controls randomness/creativity of the model. Lower is more deterministic.
						</div>
					</div>
					<div>
						<label for="similarity-threshold" class="mb-1 block text-sm font-medium text-gray-700">
							Similarity Threshold (0-1)
						</label>
						<input
							id="similarity-threshold"
							type="number"
							step="0.01"
							min="0"
							max="1"
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							placeholder="0.3"
							bind:value={project.similarity_threshold}
							disabled={loading}
						/>
						<div class="text-xs text-gray-500 mt-1">
							Minimum similarity score for a document to be considered relevant.
						</div>
					</div>
				</div>
			</fieldset>
			<div class="mt-4 flex gap-2">
				<button
					type="button"
					class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					on:click={() => {
						console.log('ProjectForm save button clicked', project);
						onSave({
							name: project.name,
							status: project.status,
							inbox_id: project.inbox_id,
							ai_config: aiConfig
						});
					}}
					disabled={loading}
				>
					{#if loading}
						<LoadingSpinner size="sm" />
						<span class="ml-2">{editMode ? 'Updating...' : 'Creating...'}</span>
					{:else}
						{editMode ? 'Update Project' : 'Create Project'}
					{/if}
				</button>
				{#if editMode}
					<button
						type="button"
						class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
						on:click={() => {
							console.log('ProjectForm cancel button clicked');
							onCancel();
						}}
					>
						Cancel
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
