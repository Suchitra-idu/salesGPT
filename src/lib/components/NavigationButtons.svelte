<script>
	export let onBack = () => {};
	export let onForward = () => {};
</script>

<div class="flex gap-4">
	<button
		on:click={onBack}
		class="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 shadow transition-all hover:bg-gray-200"
	>
		← Back
	</button>
	<button
		on:click={onForward}
		class="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 shadow transition-all hover:bg-gray-200"
	>
		Forward →
	</button>
</div> 