<script>
	import { Trash2 } from 'lucide-svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	
	export let documents = [];
	export let loading = false;
	export let onDelete = () => {};
	export let formatDate = () => '';
</script>

{#if documents.length > 0}
	<div class="space-y-3">
				{#each documents as doc}
			<div class="flex items-center justify-between rounded-md border border-gray-200 p-4">
				<div class="flex-1">
					<h4 class="font-medium text-gray-900">{doc.name}</h4>
					<div class="mt-1 text-sm text-gray-600">
						<span>Chunks: {doc.count}</span>
						{#if doc.latest}
							<span class="mx-2">•</span>
							<span>Updated: {formatDate(doc.latest)}</span>
						{/if}
								</div>
					{#if doc.config}
						<div class="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
							<div class="grid grid-cols-2 gap-2">
								<div>
									<span class="font-medium">Embedding:</span> 
									<span class="ml-1">{doc.config.embedding_model || 'N/A'}</span>
									{#if doc.config.embedding_model?.includes('sentence-transformers/')}
										<span class="ml-1 inline-flex items-center px-1 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
											HF
										</span>
									{:else if doc.config.embedding_model}
										<span class="ml-1 inline-flex items-center px-1 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
											OpenAI
										</span>
									{/if}
								</div>
								<div><span class="font-medium">Chunking:</span> {doc.config.chunking_method || 'N/A'}</div>
								{#if doc.config.chunk_size !== undefined}
									<div><span class="font-medium">Size:</span> {doc.config.chunk_size}</div>
								{/if}
								{#if doc.config.chunk_overlap !== undefined}
									<div><span class="font-medium">Overlap:</span> {doc.config.chunk_overlap}</div>
								{/if}
								{#if doc.config.semantic_threshold_type}
									<div><span class="font-medium">Threshold:</span> {doc.config.semantic_threshold_type}</div>
								{/if}
								{#if doc.config.semantic_threshold_amount !== undefined}
									<div><span class="font-medium">Amount:</span> {doc.config.semantic_threshold_amount}</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
								<button
									type="button"
					class="ml-4 text-red-600 hover:text-red-800 text-sm font-medium"
									on:click={() => onDelete(doc.name)}
					disabled={loading.delete}
				>
					Delete
								</button>
							</div>
				{/each}
	</div>
{:else if !loading}
	<div class="text-center py-8 text-gray-500">
		<p>No documents uploaded yet.</p>
	</div>
{/if}

{#if loading}
	<div class="border-t pt-6">
		<div class="py-8 text-center">
			<LoadingSpinner size="lg" text="Loading documents..." />
		</div>
	</div>
{/if} 