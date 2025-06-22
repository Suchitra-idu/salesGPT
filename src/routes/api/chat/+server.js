import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { env } from '$env/dynamic/private';

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function POST({ request }) {
  try {
    const { project_id, question, embedding_model: reqEmbeddingModel, top_k = 5, history = [] } = await request.json();
    if (!project_id || !question) {
      return json({ error: 'Missing project_id or question' }, { status: 400 });
    }

    // 0. Fetch project configuration
    const { data: projectData, error: projectErr } = await sb
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .single();
    if (projectErr || !projectData) {
      return json({ error: 'Project not found or error fetching project', detail: projectErr?.message }, { status: 404 });
    }

    // Use project config or fallback defaults
    const embeddingModel = projectData.embedding_model || reqEmbeddingModel || 'text-embedding-3-small';
    const llmModel = projectData.llm_model || 'gpt-3.5-turbo';
    const temperature = typeof projectData.temperature === 'number' ? projectData.temperature : 0.3;
    const maxHistoryMessages = projectData.maxHistoryMessages || 4;
    const systemPrompt = projectData.system_prompt || 'You are a helpful assistant for answering questions about project documents.';

    // 1. Embed the question
    const { data: embedData } = await openai.embeddings.create({
      model: embeddingModel,
      input: [question]
    });
    const questionEmbedding = embedData[0].embedding;
    console.log(projectData.client_id)

    // 2. Search for similar document chunks using Supabase vector search
    const { data: matches, error: matchErr } = await sb.rpc('match_documents', {
      match_count: top_k,
      match_threshold: 0.3,
      p_project: project_id,
      query_embedding: questionEmbedding
    });
    if (matchErr) throw matchErr;

    // 3. Compose context from top matches (may be empty)
    const context = matches && matches.length > 0 ? matches.map((m) => m.content).join('\n---\n') : '';

    // 4. Build chat history for OpenAI
    let chatHistory = [];
    if (Array.isArray(history) && history.length > 0) {
      // Only take the last maxHistoryMessages
      const trimmed = history.slice(-maxHistoryMessages);
      chatHistory = trimmed.map((msg) => ({ role: msg.role, content: msg.content }));
    }

    // 5. Generate answer using OpenAI
    let prompt;
    if (context) {
      prompt = `${systemPrompt}\nContext:\n${context}\n\nQuestion: ${question}\nAnswer:`;
    } else {
      prompt = `${systemPrompt}\n\nQuestion: ${question}\nAnswer:`;
    }
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory,
      { role: 'user', content: prompt }
    ];
    const completion = await openai.chat.completions.create({
      model: llmModel,
      messages,
      temperature
    });
    const answer = completion.choices[0].message.content;
    return json({ answer, context: matches, config: { embeddingModel, llmModel, temperature, maxHistoryMessages, systemPrompt } });
  } catch (err) {
    console.error(err);
    return json({ error: 'Server error', detail: err.message }, { status: 500 });
  }
} 