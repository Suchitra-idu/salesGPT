<script>
	import '../app.css';

	let { children } = $props();
</script>

<nav class="sticky top-0 z-30 w-full bg-white/90 backdrop-blur border-b border-gray-200 shadow-sm">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<a href="/" class="text-xl font-bold text-gray-900 tracking-tight hover:text-blue-600 transition">SalesGPT</a>
		</div>
		<div class="flex items-center gap-4">
			<a href="/admin" class="text-sm font-medium text-blue-600 hover:text-blue-800 transition">Admin Panel</a>
		</div>
	</div>
</nav>

<slot />
