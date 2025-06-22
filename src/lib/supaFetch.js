import { createClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';

const supabase = browser ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY) : null;

export async function supaFetch(url, options = {}) {
	let headers = options.headers || {};
	if (supabase) {
		const { data: { session } } = await supabase.auth.getSession();
		const jwt = session?.access_token;
		if (jwt) {
			headers = { ...headers, Authorization: `Bearer ${jwt}` };
		}
	}
	return fetch(url, { ...options, headers });
} 