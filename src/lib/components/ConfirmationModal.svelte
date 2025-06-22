<script>
	import { createEventDispatcher } from 'svelte';

	export let show = false;
	export let title = 'Are you sure?';
	export let message = 'This action cannot be undone.';

	const dispatch = createEventDispatcher();

	function confirm() {
		dispatch('confirm');
	}

	function cancel() {
		dispatch('cancel');
	}
</script>

{#if show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
		on:click={cancel}
		on:keydown={(e) => e.key === 'Escape' && cancel()}
	>
		<div
			class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
			on:click|stopPropagation
		>
			<h2 class="text-xl font-bold text-gray-900">{title}</h2>
			<p class="mt-2 text-gray-600">{message}</p>
			<div class="mt-6 flex justify-end gap-3">
				<button
					class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
					on:click={cancel}
				>
					Cancel
				</button>
				<button
					class="rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
					on:click={confirm}
				>
					Confirm
				</button>
			</div>
		</div>
	</div>
{/if} 