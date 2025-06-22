<script>
	import LoadingSpinner from './LoadingSpinner.svelte';
	
	export let file = null;
	export let loading = false;
	export let onFileSelect = () => {};
	export let onUpload = () => {};
</script>

<div>
	<label for="file-upload" class="mb-2 block text-sm font-medium text-gray-700">
		Upload Document
	</label>
	<div class="flex items-center space-x-4">
		<input
			id="file-upload"
			type="file"
			accept=".pdf,.docx,.txt"
			class="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
			on:change={onFileSelect}
			disabled={loading}
		/>

		<button
			type="button"
			class="inline-flex items-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			on:click={onUpload}
			disabled={loading || !file}
		>
			{#if loading}
				<LoadingSpinner size="sm" />
				<span class="ml-2">Uploading...</span>
			{:else}
				<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
					></path>
				</svg>
				Upload
			{/if}
		</button>
	</div>
	<p class="mt-2 text-sm text-gray-500">
		Supported formats: PDF, DOCX, TXT. Maximum file size: 10MB
	</p>
</div> 