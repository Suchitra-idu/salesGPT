<script>
	import { onMount } from 'svelte';
	import { createClient as createSupabaseClient } from '@supabase/supabase-js';
	import { supaFetch } from '$lib/supaFetch';

	// Import components
	import StatusMessage from '$lib/components/StatusMessage.svelte';
	import NavigationButtons from '$lib/components/NavigationButtons.svelte';
	import ClientsSection from '$lib/components/ClientsSection.svelte';
	import ProjectsSection from '$lib/components/ProjectsSection.svelte';
	import DocumentsSection from '$lib/components/DocumentsSection.svelte';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

	// Import utilities
	import {
		validateClient,
		validateProject,
		formatDate,
		defaultClient,
		defaultProject
	} from '$lib/utils.js';

	const supabase = createSupabaseClient(
		import.meta.env.VITE_SUPABASE_URL,
		import.meta.env.VITE_SUPABASE_ANON_KEY
	);
	// State management
	let clients = [];
	let selectedClientId = '';
	let selectedClient = null;
	let newClient = { ...defaultClient };

	let projects = [];
	let selectedProjectId = '';
	let selectedProject = null;
	let newProject = { ...defaultProject };

	let documents = [];
	let file;
	let status = null;
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

	// Navigation states
	let projectWindow = false;
	let clientWindow = true;
	let documentWindow = false;

	// Modal state
	let showConfirmation = false;
	let confirmationConfig = {
		title: '',
		message: '',
		onConfirm: () => {}
	};
	let resolveConfirmation;

	let chunkSize = 3200;
	let embeddingModel = 'text-embedding-3-small';

	function requestConfirmation(title, message, onConfirm) {
		confirmationConfig = { title, message, onConfirm };
		showConfirmation = true;
	}

	function handleConfirm() {
		if (typeof confirmationConfig.onConfirm === 'function') {
			confirmationConfig.onConfirm();
		}
		resetConfirmation();
	}

	function resetConfirmation() {
		showConfirmation = false;
		confirmationConfig = { title: '', message: '', onConfirm: () => {} };
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
		console.log('saveClient called', newClient, editMode.client);
		const errors = validateClient(newClient);
		if (errors.length > 0) {
			showError(errors.join(', '));
			return;
		}

		loading.createClient = true;
		try {
			let data, error;
			const isEditing = editMode.client;

			if (isEditing) {
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
			newClient = { ...defaultClient };
			editMode.client = false;

			showSuccess(`Client ${isEditing ? 'updated' : 'created'} successfully`);
			await loadClients();
		} catch (error) {
			showError(`Failed to ${editMode.client ? 'update' : 'create'} client: ` + error.message);
		} finally {
			loading.createClient = false;
		}
	}

	async function saveProject() {
		console.log('saveProject called', newProject, editMode.project);
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
			const isEditing = editMode.project;

			// Create a safe payload for Supabase, removing fields that might not be in the DB
			const projectPayload = { ...newProject };
			delete projectPayload.maxHistoryMessages;
			// The addons field is valid in the database, so we'll keep it

			// Ensure status is included and has a valid value
			if (!projectPayload.status) {
				projectPayload.status = 'active';
			}

			if (isEditing) {
				// Update existing project
				const result = await supabase
					.from('projects')
					.update(projectPayload)
					.eq('id', selectedProjectId)
					.select();
				data = result.data;
				error = result.error;
			} else {
				// Create new project
				const result = await supabase
					.from('projects')
					.insert([{ ...projectPayload, client_id: selectedClientId }])
					.select();
				data = result.data;
				error = result.error;
			}

			if (error) throw error;

			selectedProjectId = data[0].id;
			selectedProject = data[0];

			// Reset form
			newProject = { ...defaultProject };
			editMode.project = false;

			showSuccess(`Project ${isEditing ? 'updated' : 'created'} successfully`);
			await loadProjects(selectedClientId);
		} catch (error) {
			showError(`Failed to ${editMode.project ? 'update' : 'create'} project: ` + error.message);
		} finally {
			loading.createProject = false;
		}
	}

	// Edit functions
	function editClient() {
		console.log('editClient called', selectedClient);
		if (!selectedClient) return;
		newClient = { ...selectedClient };
		editMode.client = true;
	}

	function editProject() {
		console.log('editProject called', selectedProject);
		if (!selectedProject) return;
		newProject = { ...selectedProject };
		editMode.project = true;
	}

	function cancelEdit(type) {
		console.log('cancelEdit called', type);
		if (type === 'client') {
			newClient = { ...defaultClient };
			editMode.client = false;
		} else if (type === 'project') {
			newProject = { ...defaultProject };
			editMode.project = false;
		}
	}

	// Delete functions
	async function deleteClient() {
		console.log('deleteClient called', selectedClientId);
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
		console.log('deleteProject called', selectedProjectId);
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
		console.log('deleteDocument called', docName);
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
			const formData = new FormData();
			formData.append('file', file);
			formData.append('project_id', selectedProjectId);
			formData.append('chunk_size', chunkSize);
			formData.append('embedding_model', embeddingModel);

			const response = await supaFetch('/api/upload-text', {
				method: 'POST',
				body: formData
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
		console.log('showSuccess called', message);
		status = { type: 'success', message };
		setTimeout(() => (status = null), 5000);
	}

	function showError(message) {
		console.log('showError called', message);
		status = { type: 'error', message };
		setTimeout(() => (status = null), 8000);
	}

	// Navigation functions
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

	onMount(loadClients);
</script>

<svelte:head>
	<title>RAG Admin Dashboard</title>
</svelte:head>

<ConfirmationModal
	bind:show={showConfirmation}
	title={confirmationConfig.title}
	message={confirmationConfig.message}
	on:confirm={handleConfirm}
	on:cancel={resetConfirmation}
/>

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
			<StatusMessage {status} />
		{/if}

		<div class="space-y-8">
			<!-- Navigation Buttons -->
			<NavigationButtons onBack={back} onForward={forward} />

			<!-- Clients Section -->
			{#if clientWindow}
				<ClientsSection
					{clients}
					bind:selectedClientId
					{selectedClient}
					bind:newClient
					{loading}
					{editMode}
					{onClientSelect}
					onEditClient={editClient}
					onDeleteClient={() =>
						requestConfirmation(
							'Delete Client?',
							'Are you sure you want to delete this client? This will also delete all associated projects and documents.',
							deleteClient
						)}
					onSaveClient={saveClient}
					onCancelEdit={cancelEdit}
				/>
			{/if}

			<!-- Projects Section -->
			{#if projectWindow}
				<ProjectsSection
					{projects}
					bind:selectedProjectId
					{selectedProject}
					bind:newProject
					{loading}
					{editMode}
					{selectedClient}
					{onProjectSelect}
					onEditProject={editProject}
					onDeleteProject={() =>
						requestConfirmation(
							'Delete Project?',
							'Are you sure you want to delete this project? This will also delete all associated documents.',
							deleteProject
						)}
					onSaveProject={saveProject}
					onCancelEdit={cancelEdit}
				/>
			{/if}

			<!-- Documents Section -->
			{#if documentWindow}
				<DocumentsSection
					{documents}
					bind:file
					{loading}
					{selectedProject}
					bind:chunkSize
					bind:embeddingModel
					{onFileSelect}
					onUpload={uploadDoc}
					onDeleteDocument={(docName) =>
						requestConfirmation(
							`Delete ${docName}?`,
							`Are you sure you want to delete all versions of "${docName}"?`,
							() => deleteDocument(docName)
						)}
					{formatDate}
				/>
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
