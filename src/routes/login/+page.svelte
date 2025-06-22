<script>
	import { createClient } from '@supabase/supabase-js';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let email = '';
	let password = '';
	let error = '';
	let message = '';
	let loading = false;
	const supabase = browser ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY) : null;

	onMount(() => {
		if ($page.url.searchParams.get('message') === 'unauthorized') {
			message = 'You are not authorized to access this page.';
		}
	});

	async function login() {
		error = '';
		message = '';
		loading = true;
		const { error: err } = await supabase.auth.signInWithPassword({ email, password });
		loading = false;
		if (err) {
			error = err.message;
		} else {
			goto('/');
		}
	}
</script>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
	<div class="bg-white rounded-xl shadow border border-gray-200 p-8 w-full max-w-md">
		<h1 class="text-2xl font-bold text-gray-900 mb-6 text-center">Login to SalesGPT</h1>
		<form on:submit|preventDefault={login} class="space-y-4">
			<div>
				<label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
				<input id="email" type="email" bind:value={email} required class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
			</div>
			<div>
				<label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
				<input id="password" type="password" bind:value={password} required class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
			</div>
			{#if error}
				<div class="text-red-600 text-sm">{error}</div>
			{/if}
			{#if message}
				<div class="text-yellow-600 text-sm">{message}</div>
			{/if}
			<button type="submit" class="w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 transition disabled:bg-blue-300 disabled:cursor-not-allowed" disabled={loading}>
				{#if loading}
					<svg class="animate-spin h-5 w-5 inline-block mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
					Logging in...
				{:else}
					Login
				{/if}
			</button>
		</form>
	</div>
</div> 