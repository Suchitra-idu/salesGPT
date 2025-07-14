<script>
	import LoadingSpinner from './LoadingSpinner.svelte';

	export let client = {
		name: '',
		business_type: '',
		contact_email: '',
		contact_phone: '',
		location_country: '',
		location_city: '',
		notes: ''
	};
	export let loading = false;
	export let editMode = false;
	export let onSave = () => {};
	export let onCancel = () => {};
</script>

<div class="border-t pt-6">
	<h3 class="mb-4 text-lg font-medium text-gray-900">
		{editMode ? 'Edit Client' : 'Add New Client'}
	</h3>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<div>
			<label for="client-name" class="mb-1 block text-sm font-medium text-gray-700">
				Client Name *
			</label>
			<input
				id="client-name"
				type="text"
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="Enter client name"
				bind:value={client.name}
				disabled={loading}
			/>
		</div>

		<div>
			<label for="business-type" class="mb-1 block text-sm font-medium text-gray-700">
				Business Type
			</label>
			<input
				id="business-type"
				type="text"
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="e.g., E-commerce, SaaS, Healthcare"
				bind:value={client.business_type}
				disabled={loading}
			/>
		</div>

		<div>
			<label for="country" class="mb-1 block text-sm font-medium text-gray-700"> Country </label>
			<input
				id="country"
				type="text"
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="Enter country"
				bind:value={client.location_country}
				disabled={loading}
			/>
		</div>

		<div>
			<label for="city" class="mb-1 block text-sm font-medium text-gray-700"> City </label>
			<input
				id="city"
				type="text"
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="Enter city"
				bind:value={client.location_city}
				disabled={loading}
			/>
		</div>

		<div class="md:col-span-2">
			<label for="email" class="mb-1 block text-sm font-medium text-gray-700">
				Contact Email *
			</label>
			<input
				id="email"
				type="email"
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="Enter contact email"
				bind:value={client.contact_email}
				disabled={loading}
			/>
		</div>
		<div class="md:col-span-2">
			<label for="tel" class="mb-1 block text-sm font-medium text-gray-700"> Contact Number </label>
			<input
				id="tel"
				type="tel"
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="Enter contact number"
				bind:value={client.contact_phone}
				disabled={loading}
			/>
		</div>

		<div class="md:col-span-2">
			<label for="client-notes" class="mb-1 block text-sm font-medium text-gray-700"> Notes </label>
			<textarea
				id="client-notes"
				rows="4"
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="Enter any notes for this client..."
				bind:value={client.notes}
				disabled={loading}
			></textarea>
		</div>
	</div>

	<div class="mt-4 flex gap-2">
		<button
			type="button"
			class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			on:click={onSave}
			disabled={loading}
		>
			{#if loading}
				<LoadingSpinner size="sm" />
				<span class="ml-2">{editMode ? 'Updating...' : 'Creating...'}</span>
			{:else}
				{editMode ? 'Update Client' : 'Create Client'}
			{/if}
		</button>

		{#if editMode}
			<button
				type="button"
				class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
				on:click={onCancel}
			>
				Cancel
			</button>
		{/if}
	</div>
</div>
