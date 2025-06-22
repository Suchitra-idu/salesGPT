// File: /src/routes/api/upload-text/+server.js

import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { PDFExtract } from 'pdf.js-extract';
import { env } from '$env/dynamic/private';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

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
	const authHeader = request.headers.get('authorization');
	const jwt = authHeader?.replace('Bearer ', '');
	if (!jwt) return json({ error: 'Unauthorized' }, { status: 401 });

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
		global: { headers: { Authorization: `Bearer ${jwt}` } },
		auth: { persistSession: false }
	});

	const {
		data: { user },
		error: userError
	} = await supabase.auth.getUser();
	if (userError || !user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { data: profile, error: profileError } = await supabase
		.from('profiles')
		.select('is_dev')
		.eq('id', user.id)
		.single();

	if (profileError)
		return json(
			{ error: 'Database error checking profile', detail: profileError.message },
			{ status: 500 }
		);
	if (!profile?.is_dev) return json({ error: 'Forbidden' }, { status: 403 });

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
		} else if (
			file.type === 'text/plain' ||
			file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		) {
			text = await file.text();
		} else {
			return json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
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
		const { error: insertErr } = await supabase.from('documents').insert(rows);
		if (insertErr) throw insertErr;

		return json({ chunks: rows.length });
	} catch (err) {
		console.error(err);
		return json({ error: 'Server error', detail: err.message }, { status: 500 });
	}
}
