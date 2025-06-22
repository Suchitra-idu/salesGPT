<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { createClient } from '@supabase/supabase-js';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';

	let { children } = $props();
	let user = null;
	const supabase = browser ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY) : null;

	onMount(async () => {
		if (supabase) {
			const { data: { session } } = await supabase.auth.getSession();
			user = session?.user || null;

			if (user) {
				const { data: profile, error } = await supabase
					.from('profiles')
					.select('is_dev')
					.eq('id', user.id)
					.single();

				if (error || !profile?.is_dev) {
					await supabase.auth.signOut();
					user = null;
					goto('/login?message=unauthorized');
					return;
				}
			} else if (window.location.pathname !== '/login') {
				goto('/login');
			}

			supabase.auth.onAuthStateChange((_event, session) => {
				const currentUser = session?.user;
				if (!currentUser && window.location.pathname !== '/login') {
					goto('/login');
				}
				user = currentUser || null;
			});
		}
	});

	async function logout() {
		await supabase.auth.signOut();
		user = null;
		window.location.href = '/login';
	}
</script>

<nav class="sticky top-0 z-30 w-full bg-white/90 backdrop-blur border-b border-gray-200 shadow-sm">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<a href="/" class="text-xl font-bold text-gray-900 tracking-tight hover:text-blue-600 transition">SalesGPT</a>
		</div>
		<div class="flex items-center gap-4">
			<a href="/admin" class="text-sm font-medium text-blue-600 hover:text-blue-800 transition">Admin Panel</a>
			{#if user}
				<span class="text-sm text-gray-700">{user.email}</span>
				<button on:click={logout} class="text-sm font-medium text-red-600 hover:text-red-800 transition">Logout</button>
			{:else}
				<a href="/login" class="text-sm font-medium text-blue-600 hover:text-blue-800 transition">Login</a>
			{/if}
		</div>
	</div>
</nav>

<slot />
