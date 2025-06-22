// File: /src/routes/api/upload-text/+server.js

import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { PDFExtract } from 'pdf.js-extract';
// import { env } from '$env/dynamic/private';

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
// const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

async function extractPdfText(buffer) {
	const pdfExtract = new PDFExtract();
	return new Promise((resolve, reject) => {
		pdfExtract.extractBuffer(buffer, {}, (err, data) => {
			if (err) return reject(err);
			const text = data.pages
				.map((page) => page.content.map((item) => item.str).join(' '))
				.join('\n');
			resolve(text);
		});
	});
}

export async function POST({ request }) {
	try {
		const formData = await request.formData();
		const file = formData.get('file');
		const projectId = formData.get('project_id');
		const chunkSize = parseInt(formData.get('chunk_size') || '3200', 10);
		const embeddingModel = formData.get('embedding_model') || 'text-embedding-3-small';

		if (!file || !projectId) {
			return json({ error: 'Missing file or project_id' }, { status: 400 });
		}

		let text;
		if (file.type === 'application/pdf') {
			const buffer = Buffer.from(await file.arrayBuffer());
			text = await extractPdfText(buffer);
		} else if (file.type === 'text/plain' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
			text = await file.text();
		} else {
			return json({ error: `Unsupported file type: ${file.type}`}, { status: 400 });
		}

		const doc_name = file.name;

		if (!text) return json({ error: 'Could not extract text from file' }, { status: 400 });

		const chunks = [];
		for (let i = 0; i < text.length; i += chunkSize) {
			chunks.push(text.slice(i, i + chunkSize));
		}

		// 3) embed in batches
		const rows = [];
		for (let i = 0; i < chunks.length; i += 100) {
			const batch = chunks.slice(i, i + 100);
			const { data: embeds } = await openai.embeddings.create({
				model: embeddingModel,
				input: batch
			});
			embeds.forEach((e, j) => {
				rows.push({
					project_id: projectId,
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
