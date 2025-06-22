<script>
	import { Trash2 } from 'lucide-svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	
	export let documents = [];
	export let loading = false;
	export let onDelete = () => {};
	export let formatDate = () => '';
</script>

{#if documents.length > 0}
	<div class="border-t pt-6">
		<h3 class="mb-4 text-lg font-medium text-gray-900">Uploaded Documents</h3>
		<div class="overflow-hidden bg-white shadow sm:rounded-md">
			<ul class="divide-y divide-gray-200">
				{#each documents as doc}
					<li class="px-6 py-4">
						<div class="flex items-center justify-between">
							<div class="flex items-center">
								<div class="flex-shrink-0">
									<svg
										class="h-8 w-8 text-gray-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
										></path>
									</svg>
								</div>
								<div class="ml-4">
									<p class="text-sm font-medium text-gray-900">{doc.name}</p>
									<p class="text-sm text-gray-500">
										{doc.count} chunk{doc.count !== 1 ? 's' : ''} • Uploaded {formatDate(doc.latest)}
									</p>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<span
									class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
								>
									Processed
								</span>
								<button
									type="button"
									class="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
									on:click={() => onDelete(doc.name)}
									disabled={loading}
								>
									{#if loading}
										<LoadingSpinner size="sm" />
										<span>Deleting</span>
									{:else}
										<Trash2 class="h-3 w-3" />
										<span>Delete</span>
									{/if}
								</button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	</div>
{:else if !loading}
	<div class="border-t pt-6">
		<div class="py-8 text-center text-gray-500">
			<svg
				class="mx-auto h-12 w-12 text-gray-400"
				stroke="currentColor"
				fill="none"
				viewBox="0 0 48 48"
			>
				<path
					d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			<p class="mt-2">No documents uploaded yet</p>
			<p class="text-sm">Upload your first document to get started</p>
		</div>
	</div>
{/if}

{#if loading}
	<div class="border-t pt-6">
		<div class="py-8 text-center">
			<LoadingSpinner size="lg" text="Loading documents..." />
		</div>
	</div>
{/if} 