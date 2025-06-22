<script>
	import { Pencil, Trash2 } from 'lucide-svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import ClientForm from './ClientForm.svelte';
	
	export let clients = [];
	export let selectedClientId = '';
	export let selectedClient = null;
	export let newClient = {};
	export let loading = {};
	export let editMode = {};
	export let onClientSelect = () => {};
	export let onEditClient = () => {};
	export let onDeleteClient = () => {};
	export let onSaveClient = () => {};
	export let onCancelEdit = () => {};
</script>

<section class="rounded-lg border bg-white shadow-sm">
	<div
		class="flex flex-col border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
	>
		<div>
			<h2 class="text-xl font-semibold text-gray-900">Clients</h2>
			<p class="mt-1 text-sm text-gray-600">Manage your business clients</p>
		</div>

		{#if selectedClient}
			<div class="mt-4 flex gap-2 sm:mt-0">
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-md bg-yellow-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-600 focus:ring-2 focus:ring-yellow-400 focus:outline-none"
					on:click={() => {
						console.log('Edit client button clicked');
						onEditClient();
					}}
				>
					<Pencil class="h-4 w-4" />
					<span>Edit</span>
				</button>

				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 focus:ring-2 focus:ring-red-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					on:click={() => {
						console.log('Delete client button clicked');
						onDeleteClient();
					}}
					disabled={loading.delete}
				>
					{#if loading.delete}
						<LoadingSpinner size="sm" />
						<span>Deleting...</span>
					{:else}
						<Trash2 class="h-4 w-4" />
						<span>Delete</span>
					{/if}
				</button>
			</div>
		{/if}
	</div>

	<div class="space-y-6 p-6">
		<!-- Client Selection -->
		{#if clients.length > 0}
			<div class="flex flex-col gap-4 sm:flex-row">
				<div class="flex-1">
					<label for="client-select" class="mb-2 block text-sm font-medium text-gray-700">
						Select Client
					</label>
					<select
						id="client-select"
						bind:value={selectedClientId}
						on:change={onClientSelect}
						disabled={loading.clients}
						class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
					>
						<option value="">Choose a client...</option>
						{#each clients as client}
							<option value={client.id}
								>{client.name} ({client.business_type || 'No type'})</option
							>
						{/each}
					</select>
				</div>

				{#if selectedClient}
					<div class="flex-1 rounded-md bg-gray-50 p-4">
						<h4 class="mb-2 font-medium text-gray-900">Client Details</h4>
						<div class="space-y-1 text-sm text-gray-600">
							<p>
								<span class="font-medium">Type:</span>
								{selectedClient.business_type || 'Not specified'}
							</p>
							<p>
								<span class="font-medium">Location:</span>
								{selectedClient.location_city
									? `${selectedClient.location_city}, ${selectedClient.location_country}`
									: 'Not specified'}
							</p>
							<p><span class="font-medium">Email:</span> {selectedClient.contact_email}</p>
						</div>
					</div>
				{/if}
			</div>
		{:else if !loading.clients}
			<div class="py-8 text-center text-gray-500">
				<p>No clients found. Create your first client below.</p>
			</div>
		{/if}

		<!-- Client Form -->
		<ClientForm
			client={newClient}
			loading={loading.createClient}
			editMode={editMode.client}
			onSave={onSaveClient}
			onCancel={() => onCancelEdit('client')}
		/>
	</div>
</section> 