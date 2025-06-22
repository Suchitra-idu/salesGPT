<script>
	import { onMount } from 'svelte';
	import { createClient as createSupabaseClient } from '@supabase/supabase-js';
	import { Pencil, Trash2 } from 'lucide-svelte';

	// Initialize Supabase client
	const supabase = createSupabaseClient(
		'https://zlrskwyjeonufwfulosn.supabase.co',
		'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpscnNrd3lqZW9udWZ3ZnVsb3NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MTg4OTgsImV4cCI6MjA2NjA5NDg5OH0.8WVGPf8mSCZYeWvkmkaS4gAI2_WtJ0e4t2zNyC2y5js'
	);

	// State management
	let clients = [];
	let selectedClientId = '';
	let selectedClient = null;
	let newClient = {
		name: '',
		business_type: '',
		contact_email: '',
		contact_phone: '022',
		location_country: '',
		location_city: ''
	};

	let projects = [];
	let selectedProjectId = '';
	let selectedProject = null;
	let newProject = {
		name: '',
		plan: 'free',
		addons: [],
		llm_model: 'gpt-4o-mini',
		temperature: 0.3,
		maxHistoryMessages: 4,
		system_prompt: '',
		status: 'Active'
	};

	let documents = [];
	let file;
	let status = '';
	let loading = {
		clients: false,
		projects: false,
		documents: false,
		upload: false,
		createClient: false,
		createProject: false,
		delete: false
	};

	// Edit mode states
	let editMode = {
		client: false,
		project: false
	};

	// Validation functions
	function validateClient(client) {
		const errors = [];
		if (!client.name?.trim()) errors.push('Client name is required');
		if (!client.contact_email?.trim()) errors.push('Contact email is required');
		if (client.contact_email && !isValidEmail(client.contact_email)) {
			errors.push('Please enter a valid email address');
		}
		return errors;
	}

	function validateProject(project) {
		const errors = [];
		if (!project.name?.trim()) errors.push('Project name is required');
		if (project.temperature < 0 || project.temperature > 2) {
			errors.push('Temperature must be between 0 and 2');
		}
		return errors;
	}

	function isValidEmail(email) {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}

	// Data loading functions
	async function loadClients() {
		loading.clients = true;
		try {
			const { data, error } = await supabase
				.from('clients')
				.select('*')
				.order('created_at', { ascending: false });

			if (error) throw error;

			clients = data || [];
			if (!selectedClientId && clients.length) {
				selectedClientId = clients[0].id;
				selectedClient = clients[0];
				await loadProjects(selectedClientId);
			}
		} catch (error) {
			showError('Failed to load clients: ' + error.message);
		} finally {
			loading.clients = false;
		}
	}

	async function loadProjects(clientId) {
		if (!clientId) return;

		loading.projects = true;
		try {
			const { data, error } = await supabase
				.from('projects')
				.select('*')
				.eq('client_id', clientId)
				.order('created_at', { ascending: false });

			if (error) throw error;

			projects = data || [];
			if (!selectedProjectId && projects.length) {
				selectedProjectId = projects[0].id;
				selectedProject = projects[0];
				await loadDocuments(selectedProjectId);
			} else {
				selectedProjectId = '';
				selectedProject = null;
				documents = [];
			}
		} catch (error) {
			showError('Failed to load projects: ' + error.message);
		} finally {
			loading.projects = false;
		}
	}

	async function loadDocuments(projectId) {
		if (!projectId) return;

		loading.documents = true;
		try {
			const { data, error } = await supabase
				.from('documents')
				.select('doc_name, created_at')
				.eq('project_id', projectId)
				.order('created_at', { ascending: false });

			if (error) throw error;

			// Group documents by name and get count
			const docGroups = {};
			data?.forEach((doc) => {
				if (!docGroups[doc.doc_name]) {
					docGroups[doc.doc_name] = {
						name: doc.doc_name,
						count: 0,
						latest: doc.created_at
					};
				}
				docGroups[doc.doc_name].count++;
			});

			documents = Object.values(docGroups);
		} catch (error) {
			showError('Failed to load documents: ' + error.message);
		} finally {
			loading.documents = false;
		}
	}

	// CRUD operations
	async function saveClient() {
		const errors = validateClient(newClient);
		if (errors.length > 0) {
			showError(errors.join(', '));
			return;
		}

		loading.createClient = true;
		try {
			let data, error;

			if (editMode.client) {
				// Update existing client
				const result = await supabase
					.from('clients')
					.update(newClient)
					.eq('id', selectedClientId)
					.select();
				data = result.data;
				error = result.error;
			} else {
				// Create new client
				const result = await supabase.from('clients').insert([newClient]).select();
				data = result.data;
				error = result.error;
			}

			if (error) throw error;

			const saved = data[0];
			selectedClientId = saved.id;
			selectedClient = saved;

			// Reset form
			newClient = {
				name: '',
				business_type: '',
				contact_email: '',
				contact_phone: '022',
				location_country: '',
				location_city: ''
			};
			editMode.client = false;

			showSuccess(`Client ${editMode.client ? 'updated' : 'created'} successfully`);
			await loadClients();
		} catch (error) {
			showError(`Failed to ${editMode.client ? 'update' : 'create'} client: ` + error.message);
		} finally {
			loading.createClient = false;
		}
	}

	async function saveProject() {
		if (!selectedClientId) {
			showError('Please select a client first');
			return;
		}

		const errors = validateProject(newProject);
		if (errors.length > 0) {
			showError(errors.join(', '));
			return;
		}

		loading.createProject = true;
		try {
			let data, error;

			if (editMode.project) {
				// Update existing project
				const result = await supabase
					.from('projects')
					.update(newProject)
					.eq('id', selectedProjectId)
					.select();
				data = result.data;
				error = result.error;
			} else {
				// Create new project
				const result = await supabase
					.from('projects')
					.insert([{ ...newProject, client_id: selectedClientId }])
					.select();
				data = result.data;
				error = result.error;
			}

			if (error) throw error;

			selectedProjectId = data[0].id;
			selectedProject = data[0];

			// Reset form
			newProject = {
				name: '',
				plan: 'free',
				llm_model: 'gpt-4o-mini',
				temperature: 0.3,
				maxHistoryMessages: 4,
				system_prompt: '',
				status: 'Active'
			};
			editMode.project = false;

			showSuccess(`Project ${editMode.project ? 'updated' : 'created'} successfully`);
			await loadProjects(selectedClientId);
		} catch (error) {
			showError(`Failed to ${editMode.project ? 'update' : 'create'} project: ` + error.message);
		} finally {
			loading.createProject = false;
		}
	}

	// Edit functions
	function editClient() {
		if (!selectedClient) return;

		newClient = { ...selectedClient };
		editMode.client = true;
	}

	function editProject() {
		if (!selectedProject) return;

		newProject = { ...selectedProject };
		editMode.project = true;
	}

	function cancelEdit(type) {
		if (type === 'client') {
			newClient = {
				name: '',
				business_type: '',
				contact_email: '',
				contact_phone: '022',
				location_country: '',
				location_city: ''
			};
			editMode.client = false;
		} else if (type === 'project') {
			newProject = {
				name: '',
				plan: 'free',
				llm_model: 'gpt-4o-mini',
				temperature: 0.3,
				maxHistoryMessages: 4,
				system_prompt: '',
				status: 'Active'
			};
			editMode.project = false;
		}
	}

	// Delete functions
	async function deleteClient() {
		if (
			!selectedClientId ||
			!confirm(
				'Are you sure you want to delete this client? This will also delete all associated projects and documents.'
			)
		) {
			return;
		}

		loading.delete = true;
		try {
			const { error } = await supabase.from('clients').delete().eq('id', selectedClientId);

			if (error) throw error;

			showSuccess('Client deleted successfully');
			selectedClientId = '';
			selectedClient = null;
			selectedProjectId = '';
			selectedProject = null;
			projects = [];
			documents = [];
			await loadClients();
		} catch (error) {
			showError('Failed to delete client: ' + error.message);
		} finally {
			loading.delete = false;
		}
	}

	async function deleteProject() {
		if (
			!selectedProjectId ||
			!confirm(
				'Are you sure you want to delete this project? This will also delete all associated documents.'
			)
		) {
			return;
		}

		loading.delete = true;
		try {
			const { error } = await supabase.from('projects').delete().eq('id', selectedProjectId);

			if (error) throw error;

			showSuccess('Project deleted successfully');
			selectedProjectId = '';
			selectedProject = null;
			documents = [];
			await loadProjects(selectedClientId);
		} catch (error) {
			showError('Failed to delete project: ' + error.message);
		} finally {
			loading.delete = false;
		}
	}

	async function deleteDocument(docName) {
		if (!confirm(`Are you sure you want to delete all versions of "${docName}"?`)) {
			return;
		}

		loading.delete = true;
		try {
			const { error } = await supabase
				.from('documents')
				.delete()
				.eq('project_id', selectedProjectId)
				.eq('doc_name', docName);

			if (error) throw error;

			showSuccess('Document deleted successfully');
			await loadDocuments(selectedProjectId);
		} catch (error) {
			showError('Failed to delete document: ' + error.message);
		} finally {
			loading.delete = false;
		}
	}

	async function uploadDoc() {
		if (!selectedProjectId || !file) {
			showError('Please select a project and file first');
			return;
		}

		if (
			![
				'application/pdf',
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				'text/plain'
			].includes(file.type)
		) {
			showError('Please upload a PDF, DOCX, or TXT file');
			return;
		}

		loading.upload = true;
		try {
			const response = await fetch('/api/upload', {
				method: 'POST',
				body: file,
				headers: {
					'Content-Type': file.type,
					'x-file-name': file.name,
					'x-client-id': selectedClientId,
					'x-project-id': selectedProjectId
				}
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || `HTTP ${response.status}`);
			}

			const data = await response.json();
			showSuccess(`Document uploaded successfully! Processed ${data.chunks} chunks`);
			file = null;
			await loadDocuments(selectedProjectId);
		} catch (error) {
			showError('Upload failed: ' + error.message);
		} finally {
			loading.upload = false;
		}
	}

	// Event handlers
	function onClientSelect(e) {
		const clientId = e.target.value;
		selectedClientId = clientId;
		selectedClient = clients.find((c) => c.id === clientId) || null;
		selectedProjectId = '';
		selectedProject = null;
		projects = [];
		documents = [];
		if (clientId) {
			loadProjects(clientId);
			clientWindow = false;
			projectWindow = true;
		}
	}

	function onProjectSelect(e) {
		const projectId = e.target.value;
		selectedProjectId = projectId;
		selectedProject = projects.find((p) => p.id === projectId) || null;
		documents = [];

		if (projectId) {
			loadDocuments(projectId);
			projectWindow = false;
			documentWindow = true;
		}
	}

	function onFileSelect(e) {
		file = e.target.files[0];
	}

	// Status management
	function showSuccess(message) {
		status = { type: 'success', message };
		setTimeout(() => (status = ''), 5000);
	}

	function showError(message) {
		status = { type: 'error', message };
		setTimeout(() => (status = ''), 8000);
	}

	function formatDate(dateString) {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	onMount(loadClients);

	let projectWindow = false;
	let clientWindow = true;
	let documentWindow = false;

	function forward() {
		if (clientWindow && selectedClientId) {
			clientWindow = false;
			projectWindow = true;
		} else if (projectWindow && selectedProjectId) {
			projectWindow = false;
			documentWindow = true;
		}
	}

	function back() {
		if (documentWindow) {
			documentWindow = false;
			projectWindow = true;
		} else if (projectWindow) {
			projectWindow = false;
			clientWindow = true;
		}
	}
</script>

<svelte:head>
	<title>RAG Admin Dashboard</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<header class="border-b bg-white shadow-sm">
		<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
			<h1 class="text-3xl font-bold tracking-tight text-gray-900">RAG Admin Dashboard</h1>
			<p class="mt-2 text-gray-600">Manage clients, projects, and documents for your RAG system</p>
		</div>
	</header>

	<main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<!-- Status Messages -->
		{#if status}
			<div
				class="mb-6 rounded-md p-4 {status.type === 'success'
					? 'border border-green-200 bg-green-50 text-green-800'
					: 'border border-red-200 bg-red-50 text-red-800'}"
			>
				<div class="flex">
					<div class="flex-shrink-0">
						{#if status.type === 'success'}
							<svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									clip-rule="evenodd"
								/>
							</svg>
						{:else}
							<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
									clip-rule="evenodd"
								/>
							</svg>
						{/if}
					</div>
					<div class="ml-3">
						<p class="text-sm font-medium">{status.message}</p>
					</div>
				</div>
			</div>
		{/if}

		<div class="space-y-8">
			<button
				on:click={back}
				class="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 shadow transition-all hover:bg-gray-200"
			>
				← Back
			</button>
			<button
				on:click={forward}
				class="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 shadow transition-all hover:bg-gray-200"
			>
				Forward →
			</button>
			<!-- Clients Section -->
			{#if clientWindow}
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
									on:click={editClient}
								>
									<Pencil class="h-4 w-4" />
									<span>Edit</span>
								</button>

								<button
									type="button"
									class="inline-flex items-center gap-1 rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 focus:ring-2 focus:ring-red-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
									on:click={deleteClient}
									disabled={loading.delete}
								>
									{#if loading.delete}
										<svg
											class="h-4 w-4 animate-spin text-white"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
										>
											<circle
												class="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												stroke-width="4"
											></circle>
											<path
												class="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											></path>
										</svg>
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

						<!-- Create New Client -->
						<div class="border-t pt-6">
							<h3 class="mb-4 text-lg font-medium text-gray-900">Add New Client</h3>
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
										bind:value={newClient.name}
										disabled={loading.createClient}
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
										bind:value={newClient.business_type}
										disabled={loading.createClient}
									/>
								</div>

								<div>
									<label for="country" class="mb-1 block text-sm font-medium text-gray-700">
										Country
									</label>
									<input
										id="country"
										type="text"
										class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
										placeholder="Enter country"
										bind:value={newClient.location_country}
										disabled={loading.createClient}
									/>
								</div>

								<div>
									<label for="city" class="mb-1 block text-sm font-medium text-gray-700">
										City
									</label>
									<input
										id="city"
										type="text"
										class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
										placeholder="Enter city"
										bind:value={newClient.location_city}
										disabled={loading.createClient}
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
										bind:value={newClient.contact_email}
										disabled={loading.createClient}
									/>
								</div>
								<div class="md:col-span-2">
									<label for="email" class="mb-1 block text-sm font-medium text-gray-700">
										Contact Number
									</label>
									<input
										id="tel"
										type="tel"
										class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
										placeholder="Enter contact number"
										bind:value={newClient.contact_phone}
										disabled={loading.createClient}
									/>
								</div>
							</div>

							<button
								type="button"
								class="mt-4 inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
								on:click={saveClient}
								disabled={loading.createClient}
							>
								{#if loading.createClient}
									<svg
										class="mr-2 -ml-1 h-4 w-4 animate-spin text-white"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
									>
										<circle
											class="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											stroke-width="4"
										></circle>
										<path
											class="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										></path>
									</svg>
									{editMode.client ? 'Updating...' : 'Creating...'}
								{:else}
									{editMode.client ? 'Update Client' : 'Create Client'}
								{/if}
							</button>

							{#if editMode.client}
								<button
									type="button"
									class="mt-4 ml-2 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
									on:click={() => cancelEdit('client')}
								>
									Cancel
								</button>
							{/if}
						</div>
					</div>
				</section>
			{/if}
			<!-- Projects Section -->
			{#if projectWindow}
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
									on:click={editProject}
								>
									<Pencil class="h-4 w-4" />
									<span>Edit</span>
								</button>

								<button
									type="button"
									class="inline-flex items-center gap-1 rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 focus:ring-2 focus:ring-red-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
									on:click={deleteProject}
									disabled={loading.delete}
								>
									{#if loading.delete}
										<svg
											class="h-4 w-4 animate-spin text-white"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
										>
											<circle
												class="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												stroke-width="4"
											></circle>
											<path
												class="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											></path>
										</svg>
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
							<div class="flex flex-col gap-4 lg:flex-row">
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
											<option value={project.id}>{project.name} ({project.plan})</option>
										{/each}
									</select>
								</div>

								{#if selectedProject}
									<div class="flex-1 rounded-md bg-gray-50 p-4">
										<h4 class="mb-2 font-medium text-gray-900">Project Details</h4>
										<div class="space-y-1 text-sm text-gray-600">
											<p>
												<span class="font-medium">Plan:</span>
												<span
													class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 capitalize"
													>{selectedProject.plan}</span
												>
											</p>
											<p><span class="font-medium">Model:</span> {selectedProject.llm_model}</p>
											<p>
												<span class="font-medium">Temperature:</span>
												{selectedProject.temperature}
											</p>
											{#if selectedProject.system_prompt}
												<p>
													<span class="font-medium">System Prompt:</span>
													{selectedProject.system_prompt.substring(0, 100)}{selectedProject
														.system_prompt.length > 100
														? '...'
														: ''}
												</p>
											{/if}
										</div>
									</div>
								{/if}
							</div>
						{:else if !loading.projects}
							<div class="py-8 text-center text-gray-500">
								<p>No projects found for this client. Create your first project below.</p>
							</div>
						{/if}

						<!-- Create New Project -->
						<div class="border-t pt-6">
							<h3 class="mb-4 text-lg font-medium text-gray-900">Add New Project</h3>
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
										bind:value={newProject.name}
										disabled={loading.createProject}
									/>
								</div>

								<div>
									<label for="plan" class="mb-1 block text-sm font-medium text-gray-700">
										Plan
									</label>
									<select
										id="plan"
										class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
										bind:value={newProject.plan}
										disabled={loading.createProject}
									>
										<option value="free">Free</option>
										<option value="pro">Pro</option>
										<option value="enterprise">Enterprise</option>
									</select>
								</div>

								<div>
									<label for="llm-model" class="mb-1 block text-sm font-medium text-gray-700">
										LLM Model
									</label>
									<select
										id="llm-model"
										class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
										bind:value={newProject.llm_model}
										disabled={loading.createProject}
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
										bind:value={newProject.temperature}
										disabled={loading.createProject}
									/>
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
										bind:value={newProject.system_prompt}
										disabled={loading.createProject}
									></textarea>
								</div>
							</div>

							<button
								type="button"
								class="mt-4 inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
								on:click={saveProject}
								disabled={loading.createProject}
							>
								{#if loading.createProject}
									<svg
										class="mr-2 -ml-1 h-4 w-4 animate-spin text-white"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
									>
										<circle
											class="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											stroke-width="4"
										></circle>
										<path
											class="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										></path>
									</svg>
									{editMode.project ? 'Updating...' : 'Creating...'}
								{:else}
									{editMode.project ? 'Update Project' : 'Create Project'}
								{/if}
							</button>

							{#if editMode.project}
								<button
									type="button"
									class="mt-4 ml-2 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
									on:click={() => cancelEdit('project')}
								>
									Cancel
								</button>
							{/if}
						</div>
					</div>
				</section>
			{/if}

			<!-- Documents Section -->
			{#if documentWindow}
				<section class="rounded-lg border bg-white shadow-sm">
					<div class="border-b border-gray-200 px-6 py-4">
						<h2 class="text-xl font-semibold text-gray-900">Documents</h2>
						<p class="mt-1 text-sm text-gray-600">
							Upload and manage documents for {selectedProject?.name}
						</p>
					</div>

					<div class="space-y-6 p-6">
						<!-- Document Upload -->
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
									disabled={loading.upload}
								/>

								<button
									type="button"
									class="inline-flex items-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
									on:click={uploadDoc}
									disabled={loading.upload || !file}
								>
									{#if loading.upload}
										<svg
											class="mr-2 -ml-1 h-4 w-4 animate-spin text-white"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
										>
											<circle
												class="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												stroke-width="4"
											></circle>
											<path
												class="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											></path>
										</svg>
										Uploading...
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

						<!-- Document List -->
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
																{doc.count} chunk{doc.count !== 1 ? 's' : ''} • Uploaded {formatDate(
																	doc.latest
																)}
															</p>
														</div>
													</div>
													<div class="flex items-center">
														<span
															class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
														>
															Processed
														</span>
													</div>
												</div>
											</li>
											<button
												type="button"
												class="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
												on:click={() => deleteDocument(doc.name)}
												disabled={loading.delete}
											>
												{#if loading.delete}
													<svg
														class="h-3 w-3 animate-spin text-white"
														xmlns="http://www.w3.org/2000/svg"
														fill="none"
														viewBox="0 0 24 24"
													>
														<circle
															class="opacity-25"
															cx="12"
															cy="12"
															r="10"
															stroke="currentColor"
															stroke-width="4"
														></circle>
														<path
															class="opacity-75"
															fill="currentColor"
															d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
														></path>
													</svg>
													<span>Deleting</span>
												{:else}
													<Trash2 class="h-3 w-3" />
													<span>Delete</span>
												{/if}
											</button>
										{/each}
									</ul>
								</div>
							</div>
						{:else if !loading.documents}
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

						{#if loading.documents}
							<div class="border-t pt-6">
								<div class="py-8 text-center">
									<svg
										class="mx-auto h-8 w-8 animate-spin text-gray-400"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
									>
										<circle
											class="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											stroke-width="4"
										></circle>
										<path
											class="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										></path>
									</svg>
									<p class="mt-2 text-gray-500">Loading documents...</p>
								</div>
							</div>
						{/if}
					</div>
				</section>
			{/if}
		</div>
	</main>
</div>

<style>
	/* Custom styles for better UX */
	.focus\:ring-blue-500:focus {
		--tw-ring-color: rgb(59 130 246 / 0.5);
	}

	.focus\:border-blue-500:focus {
		--tw-border-opacity: 1;
		border-color: rgb(59 130 246 / var(--tw-border-opacity));
	}

	/* File input styling */
	input[type='file']::-webkit-file-upload-button {
		visibility: hidden;
	}

	input[type='file']::before {
		content: 'Choose file';
		display: inline-block;
		background: linear-gradient(top, #f9f9f9, #e3e3e3);
		border: 1px solid #999;
		border-radius: 3px;
		padding: 5px 8px;
		outline: none;
		white-space: nowrap;
		cursor: pointer;
		text-shadow: 1px 1px #fff;
		font-weight: 700;
		font-size: 10pt;
	}

	input[type='file']:hover::before {
		border-color: black;
	}

	input[type='file']:active::before {
		background: -webkit-linear-gradient(top, #e3e3e3, #f9f9f9);
	}
</style>
