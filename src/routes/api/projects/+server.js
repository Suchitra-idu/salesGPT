import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

export async function GET({ request }) {
	const authHeader = request.headers.get('authorization');
	const jwt = authHeader?.replace('Bearer ', '');
	if (!jwt) return json({ error: 'Unauthorized' }, { status: 401 });

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
		global: { headers: { Authorization: `Bearer ${jwt}` } },
		auth: { persistSession: false }
	});

	const { data: { user }, error: userError } = await supabase.auth.getUser();
	if (userError || !user) return json({ error: 'Unauthorized' }, { status: 401 });
	
	try {
		const { data, error } = await supabase.from('projects').select('id, name').order('created_at', { ascending: false });
		if (error) throw error;
		return json({ projects: data });
	} catch (err) {
		console.error(err);
		return json({ error: 'Server error', detail: err.message }, { status: 500 });
	}
} 