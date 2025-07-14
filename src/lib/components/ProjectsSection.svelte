<script>
	import { Pencil, Trash2 } from 'lucide-svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import ProjectForm from './ProjectForm.svelte';
	
	export let projects = [];
	export let selectedProjectId = '';
	export let selectedProject = null;
	export let newProject = {};
	export let loading = {};
	export let editMode = {};
	export let selectedClient = null;
	export let onProjectSelect = () => {};
	export let onEditProject = () => {};
	export let onDeleteProject = () => {};
	export let onSaveProject = () => {};
	export let onCancelEdit = () => {};
</script>

<section class="rounded-lg border bg-white shadow-sm">
	<div
		class="flex flex-col border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
	>
		<div>
			<h2 class="text-xl font-semibold text-gray-900">Projects</h2>
			<p class="mt-1 text-sm text-gray-600">
				Manage projects for {selectedClient?.name}
			</p>
		</div>
		

		{#if selectedProject}
			<div class="mt-4 flex gap-2 sm:mt-0">
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-md bg-yellow-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-600 focus:ring-2 focus:ring-yellow-400 focus:outline-none"
					on:click={onEditProject}
				>
					<Pencil class="h-4 w-4" />
					<span>Edit</span>
				</button>

				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 focus:ring-2 focus:ring-red-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					on:click={onDeleteProject}
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
		<!-- Project Selection -->
		{#if projects.length > 0}
			<div class="flex flex-col gap-4 sm:flex-row">
				<div class="flex-1">
					<label for="project-select" class="mb-2 block text-sm font-medium text-gray-700">
						Select Project
					</label>
					
					<select
						id="project-select"
						bind:value={selectedProjectId}
						on:change={onProjectSelect}
						disabled={loading.projects}
						class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
					>
						<option value="">Choose a project...</option>
						{#each projects as project}
							<option value={project.id}
								>{project.name} ({project.status})</option
							>
						{/each}
					</select>
				</div>


			</div>

		{:else if !loading.projects}
			<div class="py-8 text-center text-gray-500">
				<p>No projects found. Create your first project below.</p>
			</div>
		{/if}
		

		<!-- Project Form -->
		<ProjectForm
			project={newProject}
			loading={loading.createProject}
			editMode={editMode.project}
			onSave={onSaveProject}
			onCancel={() => onCancelEdit('project')}
		/>
	</div>
</section> 