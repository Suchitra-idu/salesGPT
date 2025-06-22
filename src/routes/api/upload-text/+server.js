// File: /src/routes/api/upload-text/+server.js

import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
// 	auth: { persistSession: false }
// });
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const sb = createClient(
	'https://zlrskwyjeonufwfulosn.supabase.co',
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpscnNrd3lqZW9udWZ3ZnVsb3NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MTg4OTgsImV4cCI6MjA2NjA5NDg5OH0.8WVGPf8mSCZYeWvkmkaS4gAI2_WtJ0e4t2zNyC2y5js',
	{
		auth: { persistSession: false }
	}
);
const openai = new OpenAI({
	apiKey:
		'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'
});

export async function POST({ request }) {
	try {
		const { client_id, project_id, text, doc_name = 'untitled.txt' } = await request.json();

		if (!client_id || !project_id || !text) return json({ error: 'Missing data' }, { status: 400 });

		// 1) optional: validate client/project link
		// const { data: project, error: projErr } = await sb
		// 	.from('projects')
		// 	.select('id, client_id')
		// 	.eq('id', project_id)
		// 	.single();

		// if (projErr || !project || project.client_id !== client_id)
		// 	return json({ error: 'Invalid project/client combo' }, { status: 403 });

		// 2) naive chunking
		const CHARS_PER_CHUNK = 3200;
		const chunks = [];
		for (let i = 0; i < text.length; i += CHARS_PER_CHUNK) {
			chunks.push(text.slice(i, i + CHARS_PER_CHUNK));
		}

		// 3) embed in batches
		const rows = [];
		for (let i = 0; i < chunks.length; i += 100) {
			const batch = chunks.slice(i, i + 100);
			const { data: embeds } = await openai.embeddings.create({
				model: 'text-embedding-3-small',
				input: batch
			});
			embeds.forEach((e, j) => {
				rows.push({
					project_id,
					doc_name,
					chunk_index: i + j,
					content: batch[j],
					embedding: e.embedding
				});
			});
		}

		// 4) insert
		const { error: insertErr } = await sb.from('documents').insert(rows);
		if (insertErr) throw insertErr;

		return json({ chunks: rows.length });
	} catch (err) {
		console.error(err);
		return json({ error: 'Server error', detail: err.message }, { status: 500 });
	}
}
