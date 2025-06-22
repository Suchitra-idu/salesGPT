<script>
	let input = '';
	let messages = [];
	const api = '/api/chat'; // deployed edge function

	async function send() {
		const userMsg = { role: 'user', content: input };
		messages = [...messages, userMsg];
		input = '';

		const res = await fetch(api, {
			method: 'POST',
			body: JSON.stringify({
				conversation_id: localStorage.conv || crypto.randomUUID(),
				client_id: 'CLIENT_UUID',
				question: userMsg.content
			}),
			headers: { 'Content-Type': 'application/json' }
		});

		const reader = res.body.getReader();
		let aiText = '';
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			aiText += new TextDecoder().decode(value);
			messages = [
				...messages.slice(0, -1),
				{ role: 'user', content: userMsg.content },
				{ role: 'assistant', content: aiText }
			];
		}
	}
</script>

<div class="chat-box">
	{#each messages as m}
		<div class={m.role}>{m.content}</div>
	{/each}
</div>

<input bind:value={input} on:keydown={(e) => e.key === 'Enter' && send()} />
<button on:click={send}>Send</button>

<style>
	.chat-box {
		max-height: 300px;
		overflow: auto;
		margin-bottom: 8px;
	}
	.user {
		color: blue;
	}
	.assistant {
		color: green;
	}
</style>
