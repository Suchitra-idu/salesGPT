import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

export async function GET({ params }) {
  try {
    const { id } = params;
    const { data, error } = await sb.from('projects').select('*').eq('id', id).single();
    if (error) throw error;
    return json({ project: data });
  } catch (err) {
    console.error(err);
    return json({ error: 'Server error', detail: err.message }, { status: 500 });
  }
} 