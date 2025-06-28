<script>
	import DocumentUpload from './DocumentUpload.svelte';
	import DocumentList from './DocumentList.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	
	export let documents = [];
	export let file = null;
	export let loading = {};
	export let selectedProject = null;
	export let onFileSelect = () => {};
	export let onUpload = () => {};
	export let onDeleteDocument = () => {};
	export let formatDate = () => '';
	export let chunkSize = 3200;
	export let embeddingModel = 'text-embedding-3-small';
	export let chunkingMethod = 'fixed';
	export let chunkOverlap = 200;
	export let semanticThresholdType = 'percentile';
	export let semanticThresholdAmount = 95.0;

	let uniqueDocNames = [...new Set(documents.map((d) => d.doc_name))];

	const chunkingMethods = [
		{ value: 'fixed', label: 'Fixed Size' },
		{ value: 'recursive', label: 'Recursive' },
		{ value: 'semantic', label: 'Semantic' }
	];

	const semanticThresholdTypes = [
		{ value: 'percentile', label: 'Percentile', default: 95.0, description: 'Best for general documents and articles' },
		{ value: 'standard_deviation', label: 'Standard Deviation', default: 1.5, description: 'Good for technical and scientific documents' },
		{ value: 'interquartile', label: 'Interquartile', default: 1.5, description: 'Works well with varied text styles and mixed content' },
		{ value: 'gradient', label: 'Gradient', default: 95.0, description: 'Ideal for domain-specific content (legal, medical, etc.)' }
	];

	// Preset configurations for different document types
	const semanticPresets = [
		{ name: 'General Documents', type: 'percentile', amount: 95.0, description: 'Articles, reports, general text' },
		{ name: 'Technical Manuals', type: 'standard_deviation', amount: 1.5, description: 'Technical documentation, manuals' },
		{ name: 'Legal Documents', type: 'gradient', amount: 95.0, description: 'Contracts, legal text, structured documents' },
		{ name: 'Scientific Papers', type: 'standard_deviation', amount: 2.0, description: 'Research papers, academic content' },
		{ name: 'Mixed Content', type: 'interquartile', amount: 1.5, description: 'Varied writing styles, mixed formats' }
	];

	const embeddingModels = [
		{ value: 'text-embedding-3-small', label: 'OpenAI text-embedding-3-small (Fast)', provider: 'openai' },
		{ value: 'text-embedding-3-large', label: 'OpenAI text-embedding-3-large (Accurate)', provider: 'openai' },
		{ value: 'text-embedding-ada-002', label: 'OpenAI text-embedding-ada-002 (Legacy)', provider: 'openai' },
		{ value: 'sentence-transformers/all-MiniLM-L6-v2', label: 'HuggingFace all-MiniLM-L6-v2 (Fast)', provider: 'huggingface' },
		{ value: 'sentence-transformers/all-mpnet-base-v2', label: 'HuggingFace all-mpnet-base-v2 (Accurate)', provider: 'huggingface' },
		{ value: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', label: 'HuggingFace multilingual-MiniLM (Multi-lang)', provider: 'huggingface' }
	];

	// Check if chunking method requires size/overlap parameters
	$: showChunkParams = chunkingMethod !== 'semantic';
	$: showSemanticParams = chunkingMethod === 'semantic';

	// Debug logging
	$: console.log('DocumentsSection - chunkingMethod changed to:', chunkingMethod);

	// Update threshold amount when type changes
	$: {
		if (semanticThresholdType) {
			const selectedType = semanticThresholdTypes.find(t => t.value === semanticThresholdType);
			if (selectedType && semanticThresholdAmount === 95.0) {
				// Only update if user hasn't manually changed the value
				semanticThresholdAmount = selectedType.default;
			}
		}
	}

	$: uniqueDocNames = [...new Set(documents.map((d) => d.doc_name))];

	// Function to apply preset
	function applyPreset(preset) {
		semanticThresholdType = preset.type;
		semanticThresholdAmount = preset.amount;
	}

	// Check if current settings match a preset
	function isPresetActive(preset) {
		return semanticThresholdType === preset.type && Math.abs(semanticThresholdAmount - preset.amount) < 0.01;
	}
</script>

<section class="rounded-lg border bg-white shadow-sm">
	<div class="border-b border-gray-200 px-6 py-4">
		<h2 class="text-xl font-semibold text-gray-900">Documents</h2>
		<p class="mt-1 text-sm text-gray-600">
			Upload and manage documents for {selectedProject?.name}
		</p>
	</div>

	<div class="space-y-6 p-6">
		<!-- Document Upload -->
		<div class="rounded-md border border-gray-200 bg-gray-50 p-4">
			<h3 class="mb-3 text-lg font-semibold text-gray-700">Upload New Document</h3>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="chunking-method" class="mb-1 block text-sm font-medium text-gray-700">Chunking Method</label>
					<select
						id="chunking-method"
						class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						bind:value={chunkingMethod}
					>
						{#each chunkingMethods as method}
							<option value={method.value}>{method.label}</option>
						{/each}
					</select>
					<div class="text-xs text-gray-500 mt-1">
						{chunkingMethod === 'fixed' ? 'Simple character-based splitting' :
						 chunkingMethod === 'recursive' ? 'Smart splitting with multiple separators' :
						 'Semantic splitting using embeddings to identify natural breakpoints'}
					</div>
				</div>
				{#if showChunkParams}
					<div>
						<label for="chunk-size" class="mb-1 block text-sm font-medium text-gray-700">Chunk Size (characters)</label>
						<input
							id="chunk-size"
							type="number"
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							bind:value={chunkSize}
							step="100"
							min="100"
						/>
					</div>
					<div>
						<label for="chunk-overlap" class="mb-1 block text-sm font-medium text-gray-700">Chunk Overlap (characters)</label>
						<input
							id="chunk-overlap"
							type="number"
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							bind:value={chunkOverlap}
							step="50"
							min="0"
							max="1000"
						/>
						<div class="text-xs text-gray-500 mt-1">
							Number of characters to overlap between chunks for better context
						</div>
					</div>
				{/if}
				{#if showSemanticParams}
					<div class="md:col-span-2">
						<details class="group">
							<summary class="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
								<span class="flex items-center">
									<svg class="h-4 w-4 mr-1 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
									</svg>
									How Semantic Chunking Works
								</span>
							</summary>
							<div class="mt-2 p-3 bg-blue-50 rounded-md text-xs text-gray-700 space-y-2">
								<p><strong>Semantic chunking</strong> uses AI embeddings to understand text meaning and split at natural breakpoints instead of arbitrary character counts.</p>
								<div class="grid grid-cols-1 gap-2 text-xs">
									<div><strong>Percentile:</strong> Splits at the 95th percentile of semantic distances (creates more chunks with higher values)</div>
									<div><strong>Standard Deviation:</strong> Splits when distance exceeds mean + (multiplier × std) (fewer chunks with higher values)</div>
									<div><strong>Interquartile:</strong> Uses IQR-based outlier detection (fewer chunks with higher values)</div>
									<div><strong>Gradient:</strong> Uses gradient analysis for anomaly detection (more chunks with higher values)</div>
								</div>
							</div>
						</details>
					</div>
					<div class="md:col-span-2">
						<label class="mb-2 block text-sm font-medium text-gray-700">Quick Presets</label>
						<div class="flex flex-wrap gap-2">
							{#each semanticPresets as preset}
								<button
									type="button"
									class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
									on:click={() => applyPreset(preset)}
									title={preset.description}
								>
									{preset.name}
								</button>
							{/each}
						</div>
						<div class="text-xs text-gray-500 mt-1">
							Click a preset to automatically configure optimal settings for your document type
						</div>
					</div>
					<div>
						<label for="semantic-threshold-type" class="mb-1 block text-sm font-medium text-gray-700">Breakpoint Threshold Type</label>
						<select
							id="semantic-threshold-type"
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							bind:value={semanticThresholdType}
						>
							{#each semanticThresholdTypes as type}
								<option value={type.value}>{type.label}</option>
							{/each}
						</select>
						<div class="text-xs text-gray-500 mt-1">
							{semanticThresholdTypes.find(t => t.value === semanticThresholdType)?.description || ''}
						</div>
					</div>
					<div>
						<label for="semantic-threshold-amount" class="mb-1 block text-sm font-medium text-gray-700">
							{semanticThresholdType === 'percentile' ? 'Percentile Threshold' :
							 semanticThresholdType === 'standard_deviation' ? 'Standard Deviation Multiplier' :
							 semanticThresholdType === 'interquartile' ? 'IQR Multiplier' :
							 'Gradient Threshold'}
						</label>
						<input
							id="semantic-threshold-amount"
							type="number"
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							bind:value={semanticThresholdAmount}
							step={semanticThresholdType === 'percentile' ? '1' : '0.1'}
							min={semanticThresholdType === 'percentile' ? '0' : '0'}
							max={semanticThresholdType === 'percentile' ? '100' : '10'}
						/>
						<div class="text-xs text-gray-500 mt-1">
							{semanticThresholdType === 'percentile' ? 'Higher values create more chunks (0-100, default: 95)' :
							 semanticThresholdType === 'standard_deviation' ? 'Higher values create fewer chunks (default: 1.5)' :
							 semanticThresholdType === 'interquartile' ? 'Higher values create fewer chunks (default: 1.5)' :
							 'Higher values create more chunks (0-100, default: 95)'}
						</div>
					</div>
				{/if}
				<div>
					<label for="embedding-model" class="mb-1 block text-sm font-medium text-gray-700">Embedding Model</label>
					<select
						id="embedding-model"
						class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						bind:value={embeddingModel}
					>
						{#each embeddingModels as model}
							<option value={model.value}>
								{model.label}
							</option>
						{/each}
					</select>
					<div class="text-xs text-gray-500 mt-1">
						{#if embeddingModel.includes('sentence-transformers/')}
							<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
								HuggingFace
							</span>
						{:else}
							<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
								OpenAI
							</span>
						{/if}
						{#if embeddingModel.includes('multilingual')}
							<span class="ml-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
								Multi-language
							</span>
						{/if}
					</div>
				</div>
			</div>
			<div class="mt-4">
				<label for="doc-upload" class="mb-1 block text-sm font-medium text-gray-700"
					>Select File (PDF or TXT)</label
				>
				<input
					id="doc-upload"
					type="file"
					class="block w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
					on:change={onFileSelect}
					accept=".pdf,.txt"
				/>
			</div>

			<div class="mt-4 flex items-center justify-end space-x-3">
				{#if loading.upload}
					<LoadingSpinner message="Uploading..." />
				{/if}
				<button
					on:click={onUpload}
					disabled={!file || loading.upload}
					class="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Upload
				</button>
			</div>
		</div>

		<!-- Document List -->
		<DocumentList
			{documents}
			loading={loading.documents}
			onDelete={onDeleteDocument}
			{formatDate}
		/>
	</div>
</section> 