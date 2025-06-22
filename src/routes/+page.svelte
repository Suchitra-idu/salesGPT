<script>
	import { onMount } from 'svelte';
	let input = '';
	let messages = [];
	let projects = [];
	let selectedProjectId = '';
	let selectedProject = null;
	let loadingProjects = false;
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

	function onProjectSelect(e) {
		selectedProjectId = e.target.value;
		selectedProject = projects.find((p) => p.id === selectedProjectId) || null;
		messages = [];
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
		messages = [
			...messages,
			{ role: 'assistant', content: aiText }
		];
		loadingChat = false;
	}

	onMount(fetchProjects);
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
	<h1 class="text-3xl md:text-4xl font-bold text-gray-900 text-center mt-8 mb-4 tracking-tight drop-shadow-sm">Chat with SalesGPT</h1>
	<div class="flex flex-col md:flex-row gap-8 max-w-5xl mx-auto py-8 px-2 md:px-6 w-full flex-1">
		<!-- Sidebar: Project Selection & Info -->
		<aside class="w-full md:w-80 flex-shrink-0 mb-6 md:mb-0">
			<div class="bg-white rounded-xl shadow border border-gray-200 p-6 flex flex-col gap-4">
				<h2 class="text-xl font-semibold text-gray-900 mb-2">Project Chat</h2>
				<div>
					<label for="project-select" class="block text-sm font-medium text-gray-700 mb-1">Select Project</label>
					<div class="relative">
						<select
							id="project-select"
							bind:value={selectedProjectId}
							on:change={onProjectSelect}
							class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 disabled:bg-gray-100 pr-10"
							disabled={loadingProjects}
						>
							<option value="">-- Choose a project --</option>
							{#each projects as p}
								<option value={p.id}>{p.name} ({p.llm_model})</option>
							{/each}
						</select>
						{#if loadingProjects}
							<div class="absolute right-2 top-2">
								<svg class="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
							</div>
						{/if}
					</div>
				</div>
				{#if selectedProject}
					<div class="bg-gray-50 rounded-lg p-4 mt-2 border border-gray-100">
						<div class="text-sm text-gray-700 mb-1"><span class="font-medium">Model:</span> {selectedProject.llm_model}</div>
						<div class="text-sm text-gray-700 mb-1"><span class="font-medium">Temperature:</span> {selectedProject.temperature}</div>
						<div class="text-sm text-gray-700 mb-1"><span class="font-medium">Status:</span> {selectedProject.status}</div>
						{#if selectedProject.system_prompt}
							<div class="text-sm text-gray-700 mt-2"><span class="font-medium">System Prompt:</span> <span class="italic text-gray-500">{selectedProject.system_prompt}</span></div>
						{/if}
					</div>
				{/if}
			</div>
		</aside>

		<!-- Main Chat Card -->
		<section class="flex-1 flex flex-col bg-white rounded-xl shadow border border-gray-200 min-h-[500px] max-h-[80vh]">
			{#if !selectedProjectId}
				<div class="flex flex-1 items-center justify-center text-gray-400 text-lg">Please select a project to start chatting.</div>
			{:else}
				<div class="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
					{#each messages as m, i}
						<div class="flex" class:flex-row-reverse={m.role === 'user'}>
							<div class={`rounded-2xl px-4 py-2 max-w-[75%] shadow-sm text-base whitespace-pre-line ${m.role === 'user' ? 'bg-blue-600 text-white ml-auto' : 'bg-gray-100 text-gray-900 mr-auto'}`}
							>
								{m.content}
							</div>
						</div>
					{/each}
					{#if loadingChat}
						<div class="flex">
							<div class="bg-gray-100 text-gray-500 rounded-2xl px-4 py-2 max-w-[75%] shadow-sm flex items-center gap-2">
								<svg class="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
								AI is thinking...
							</div>
						</div>
					{/if}
				</div>
				<form class="sticky bottom-0 bg-white border-t border-gray-100 flex gap-2 px-4 py-3" on:submit|preventDefault={send} autocomplete="off">
					<input
						bind:value={input}
						placeholder="Type your message..."
						class="flex-1 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 px-4 py-2 text-base bg-gray-50 disabled:bg-gray-100"
						disabled={!selectedProjectId || loadingChat}
					/>
					<button
						type="submit"
						class="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 transition disabled:bg-blue-300 disabled:cursor-not-allowed"
						disabled={!selectedProjectId || loadingChat}
					>
						Send
					</button>
				</form>
			{/if}
		</section>
	</div>
</div>
