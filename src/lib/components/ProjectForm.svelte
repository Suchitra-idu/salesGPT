<script>
	import LoadingSpinner from './LoadingSpinner.svelte';

	export let project = {
		name: '',
		plan: 'free',
		addons: [],
		llm_model: 'gpt-4o-mini',
		temperature: 0.3,
		maxHistoryMessages: 4,
		system_prompt: '',
		status: 'Active'
	};
	export let loading = false;
	export let editMode = false;
	export let onSave = () => {};
	export let onCancel = () => {};
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
			<label for="plan" class="mb-1 block text-sm font-medium text-gray-700"> Plan </label>
			<select
				id="plan"
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				bind:value={project.plan}
				disabled={loading}
			>
				<option value="basic">Basic</option>
				<option value="medium">Medium</option>
				<option value="premium">Premium</option>
			</select>
		</div>

		<div>
			<label for="llm-model" class="mb-1 block text-sm font-medium text-gray-700">
				LLM Model
			</label>
			<select
				id="llm-model"
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				bind:value={project.llm_model}
				disabled={loading}
			>
				<option value="gpt-4o-mini">GPT-4O Mini</option>
				<option value="gpt-4o">GPT-4O</option>
				<option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
			</select>
		</div>

		<div>
			<label for="temperature" class="mb-1 block text-sm font-medium text-gray-700">
				Temperature (0-2)
			</label>
			<input
				id="temperature"
				type="number"
				step="0.1"
				min="0"
				max="2"
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="0.3"
				bind:value={project.temperature}
				disabled={loading}
			/>
		</div>

		<div>
			<label for="match-threshold" class="mb-1 block text-sm font-medium text-gray-700">
				Similarity Threshold (0-1)
			</label>
			<input
				id="match-threshold"
				type="number"
				step="0.01"
				min="0"
				max="1"
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="0.3"
				bind:value={project.match_threshold}
				disabled={loading}
			/>
		</div>

		<div>
			<label for="max-history" class="mb-1 block text-sm font-medium text-gray-700">
				Max History Messages
			</label>
			<input
				id="max-history"
				type="number"
				step="1"
				min="0"
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="4"
				bind:value={project.maxHistoryMessages}
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

		<div class="md:col-span-2">
			<label class="mb-2 block text-sm font-medium text-gray-700"> Addons (Future Features) </label>
			<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
				<label class="flex items-center space-x-2">
					<input
						type="checkbox"
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						checked={project.addons.includes('fine-tuning')}
						on:change={(e) => {
							if (e.target.checked) {
								project.addons = [...project.addons, 'fine-tuning'];
							} else {
								project.addons = project.addons.filter((addon) => addon !== 'fine-tuning');
							}
						}}
						disabled={loading}
					/>
					<span class="text-sm text-gray-700">Fine-tuning</span>
				</label>

				<label class="flex items-center space-x-2">
					<input
						type="checkbox"
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						checked={project.addons.includes('multi-language')}
						on:change={(e) => {
							if (e.target.checked) {
								project.addons = [...project.addons, 'multi-language'];
							} else {
								project.addons = project.addons.filter((addon) => addon !== 'multi-language');
							}
						}}
						disabled={loading}
					/>
					<span class="text-sm text-gray-700">Multi-language Support</span>
				</label>

				<label class="flex items-center space-x-2">
					<input
						type="checkbox"
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						checked={project.addons.includes('media-support')}
						on:change={(e) => {
							if (e.target.checked) {
								project.addons = [...project.addons, 'media-support'];
							} else {
								project.addons = project.addons.filter((addon) => addon !== 'media-support');
							}
						}}
						disabled={loading}
					/>
					<span class="text-sm text-gray-700">Video/Image Support</span>
				</label>

				<label class="flex items-center space-x-2">
					<input
						type="checkbox"
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						checked={project.addons.includes('tool-access')}
						on:change={(e) => {
							if (e.target.checked) {
								project.addons = [...project.addons, 'tool-access'];
							} else {
								project.addons = project.addons.filter((addon) => addon !== 'tool-access');
							}
						}}
						disabled={loading}
					/>
					<span class="text-sm text-gray-700">Tool Access</span>
				</label>
			</div>
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

	<div class="mt-4 flex gap-2">
		<button
			type="button"
			class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			on:click={() => {
				console.log('ProjectForm save button clicked', project);
				onSave();
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
