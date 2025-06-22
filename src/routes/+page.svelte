<script>
	import { onMount } from 'svelte';
	let input = '';
	let messages = [];
	let projects = [];
	let selectedProjectId = '';
	let selectedProject = null;
	let loadingProjects = false;
	let loadingProjectDetails = false;
	let loadingChat = false;

	const api = '/api/chat';

	async function fetchProjects() {
		loadingProjects = true;
		try {
			const res = await fetch('/api/projects');
			const data = await res.json();
			projects = data.projects || [];
		} catch (e) {
			projects = [];
		} finally {
			loadingProjects = false;
		}
	}

	async function fetchProjectDetails(id) {
		if (!id) return;
		loadingProjectDetails = true;
		try {
			const res = await fetch(`/api/projects/${id}`);
			const data = await res.json();
			selectedProject = data.project || null;
		} catch (e) {
			selectedProject = null;
		} finally {
			loadingProjectDetails = false;
		}
	}

	function onProjectSelect(e) {
		selectedProjectId = e.target.value;
		selectedProject = null;
		messages = [];
		if (selectedProjectId) fetchProjectDetails(selectedProjectId);
	}

	async function send() {
		if (!selectedProjectId || !input) return;
		const userMsg = { role: 'user', content: input };
		messages = [...messages, userMsg];
		input = '';
		loadingChat = true;

		// Prepare history: last N messages (excluding the current input)
		let maxHistory = 4;
		if (selectedProject && selectedProject.maxHistoryMessages) {
			maxHistory = selectedProject.maxHistoryMessages;
		}
		const history = messages.slice(-maxHistory);

		const res = await fetch(api, {
			method: 'POST',
			body: JSON.stringify({
				project_id: selectedProjectId,
				question: userMsg.content,
				history
			}),
			headers: { 'Content-Type': 'application/json' }
		});

		const data = await res.json();
		const aiText = data.answer || (data.error ? `Error: ${data.error}` : 'No answer');
		messages = [...messages, { role: 'assistant', content: aiText }];
		loadingChat = false;
	}

	onMount(fetchProjects);
</script>

<div class="flex min-h-screen flex-col bg-gradient-to-br from-blue-50 via-white to-indigo-50">
	<h1
		class="mt-8 mb-4 text-center text-3xl font-bold tracking-tight text-gray-900 drop-shadow-sm md:text-4xl"
	>
		Chat with SalesGPT
	</h1>
	<div class="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-2 py-8 md:flex-row md:px-6">
		<!-- Sidebar: Project Selection & Info -->
		<aside class="mb-6 w-full flex-shrink-0 md:mb-0 md:w-80">
			<div class="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow">
				<h2 class="mb-2 text-xl font-semibold text-gray-900">Project Chat</h2>
				<div>
					<label for="project-select" class="mb-1 block text-sm font-medium text-gray-700"
						>Select Project</label
					>
					<div class="relative">
						<select
							id="project-select"
							bind:value={selectedProjectId}
							on:change={onProjectSelect}
							class="block w-full rounded-md border-gray-300 pr-10 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
							disabled={loadingProjects}
						>
							<option value="">-- Choose a project --</option>
							{#each projects as p}
								<option value={p.id}>{p.name}</option>
							{/each}
						</select>
						{#if loadingProjects}
							<div class="absolute top-2 right-2">
								<svg
									class="h-5 w-5 animate-spin text-blue-500"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									><circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"
									></path></svg
								>
							</div>
						{/if}
					</div>
				</div>
				{#if loadingProjectDetails}
					<div class="mt-2 flex items-center gap-2 text-gray-500">
						<svg
							class="h-5 w-5 animate-spin text-blue-500"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							><circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"
							></path></svg
						>
						Loading project details...
					</div>
				{:else if selectedProject}
					<div class="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-4">
						<div class="mb-1 text-sm text-gray-700">
							<span class="font-medium">Model:</span>
							{selectedProject.llm_model}
						</div>
						<div class="mb-1 text-sm text-gray-700">
							<span class="font-medium">Temperature:</span>
							{selectedProject.temperature}
						</div>
						<div class="mb-1 text-sm text-gray-700">
							<span class="font-medium">Similarity Threshold:</span>
							{selectedProject.match_threshold}
						</div>
						<div class="mb-1 text-sm text-gray-700">
							<span class="font-medium">Status:</span>
							{selectedProject.status}
						</div>
						{#if selectedProject.system_prompt}
							<div class="mt-2 text-sm text-gray-700">
								<span class="font-medium">System Prompt:</span>
								<span class="text-gray-500 italic">{selectedProject.system_prompt}</span>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</aside>

		<!-- Main Chat Card -->
		<section
			class="flex max-h-[80vh] min-h-[500px] flex-1 flex-col rounded-xl border border-gray-200 bg-white shadow"
		>
			{#if !selectedProjectId}
				<div class="flex flex-1 items-center justify-center text-lg text-gray-400">
					Please select a project to start chatting.
				</div>
			{:else}
				<div class="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
					{#each messages as m, i}
						<div class="flex" class:flex-row-reverse={m.role === 'user'}>
							<div
								class={`max-w-[75%] rounded-2xl px-4 py-2 text-base whitespace-pre-line shadow-sm ${m.role === 'user' ? 'ml-auto bg-blue-600 text-white' : 'mr-auto bg-gray-100 text-gray-900'}`}
							>
								{m.content}
							</div>
						</div>
					{/each}
					{#if loadingChat}
						<div class="flex">
							<div
								class="flex max-w-[75%] items-center gap-2 rounded-2xl bg-gray-100 px-4 py-2 text-gray-500 shadow-sm"
							>
								<svg
									class="h-5 w-5 animate-spin text-blue-500"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									><circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"
									></path></svg
								>
								AI is thinking...
							</div>
						</div>
					{/if}
				</div>
				<form
					class="sticky bottom-0 flex gap-2 border-t border-gray-100 bg-white px-4 py-3"
					on:submit|preventDefault={send}
					autocomplete="off"
				>
					<input
						bind:value={input}
						placeholder="Type your message..."
						class="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-base focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
						disabled={!selectedProjectId || loadingChat}
					/>
					<button
						type="submit"
						class="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
						disabled={!selectedProjectId || loadingChat}
					>
						Send
					</button>
				</form>
			{/if}
		</section>
	</div>
</div>
