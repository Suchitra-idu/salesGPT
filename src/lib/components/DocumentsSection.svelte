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

	let uniqueDocNames = [...new Set(documents.map((d) => d.doc_name))];

	$: uniqueDocNames = [...new Set(documents.map((d) => d.doc_name))];
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
					<label for="chunk-size" class="mb-1 block text-sm font-medium text-gray-700"
						>Chunk Size (characters)</label
					>
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
					<label for="embedding-model" class="mb-1 block text-sm font-medium text-gray-700"
						>Embedding Model</label
					>
					<select
						id="embedding-model"
						class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						bind:value={embeddingModel}
					>
						<option value="text-embedding-3-small">text-embedding-3-small</option>
						<option value="text-embedding-3-large">text-embedding-3-large</option>
						<option value="text-embedding-ada-002">text-embedding-ada-002</option>
					</select>
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