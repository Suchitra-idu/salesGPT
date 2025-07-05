import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { processChat } from './processChat.js';
import { sanitizeInput, validateUUID } from '../../../lib/utils.js';

// Implement a simple in-memory rate limiter for abuse prevention
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30;

function isRateLimited(ip) {
	const now = Date.now();
	const entry = rateLimitMap.get(ip) || { count: 0, last: now };
	if (now - entry.last > RATE_LIMIT_WINDOW) {
		rateLimitMap.set(ip, { count: 1, last: now });
		return false;
	}
	if (entry.count >= RATE_LIMIT_MAX) {
		return true;
	}
	entry.count++;
	entry.last = now;
	rateLimitMap.set(ip, entry);
	return false;
}

export async function POST({ request }) {
	const ip = request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown';
	if (isRateLimited(ip)) {
		return json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
	}

	const authHeader = request.headers.get('authorization');
	const jwt = authHeader?.replace('Bearer ', '');
	if (!jwt) return json({ error: 'Unauthorized' }, { status: 401 });

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
		global: { headers: { Authorization: `Bearer ${jwt}` } },
		auth: { persistSession: false }
	});

	const { data: { user }, error: userError } = await supabase.auth.getUser();
	if (userError || !user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { data: profile, error: profileError } = await supabase
		.from('profiles')
		.select('is_dev')
		.eq('id', user.id)
		.single();

	if (profileError) return json({ error: 'Database error checking profile', detail: profileError.message }, { status: 500 });
	if (!profile?.is_dev) return json({ error: 'Forbidden' }, { status: 403 });

	try {
		const body = await request.json();
		console.log('Received /api/chat payload:', body);
		let { inbox_id, question } = body;
		if (!inbox_id || !question) {
			return json({ error: 'Missing inbox_id or question' }, { status: 400 });
		}
		// Only check that question is present; allow any string for conversation_id
		if (!question) {
			return json({ error: 'Invalid input' }, { status: 400 });
		}
		question = sanitizeInput(question);

		// Find project by inbox_id
		const { data: projectData, error: projectErr } = await supabase
			.from('projects')
			.select('*')
			.eq('inbox_id', inbox_id)
			.single();

		if (projectErr || !projectData) {
			return json({ error: 'Project not found for this inbox', detail: projectErr?.message }, { status: 404 });
		}

		// Get conversation history using the database function (with automatic cleanup)
		const maxMessages = projectData.ai_config?.max_conversation_messages || 20;
		let conversationHistory = [];
		
		try {
			const { data: historyData, error: historyErr } = await supabase.rpc('get_conversation_history', {
				p_inbox_id: parseInt(inbox_id),
				max_messages: maxMessages
			});
			
			if (historyErr) {
				console.error('Error fetching conversation history:', historyErr);
				// Continue without history if there's an error
			} else {
				conversationHistory = historyData || [];
				console.log('Retrieved conversation history:', conversationHistory.length, 'messages');
			}
		} catch (error) {
			console.error('Exception fetching conversation history:', error);
			// Continue without history
		}

		// Use the new processChat function from processChat.js
		const result = await processChat(
			supabase, 
			projectData.id, 
			question, 
			conversationHistory, 
			inbox_id,
			user.id
		);

		// Store the new conversation entry, including per-turn summary and used_rag
		try {
			const { error: convError } = await supabase
				.from('conversations')
				.insert([
					{
						inbox_id: parseInt(inbox_id),
						content: question,
						summary: result.turn_summary || null,
						created_at: new Date().toISOString()
					},
					{
						inbox_id: parseInt(inbox_id),
						content: result.answer,
						summary: result.turn_summary || null,
						created_at: new Date().toISOString()
					}
				]);
			if (convError) console.error('Error saving conversation:', convError);
		} catch (error) {
			console.error('Exception saving conversation:', error);
		}

		// Save analytics
		try {
			const { error: analyticsError } = await supabase.from('chat_analytics').insert({
				project_id: projectData.id,
				conversation_id: inbox_id,
				user_id: user.id,
				timings: result.analytics.timings,
				token_usage: result.analytics.token_usage,
				model_name: result.analytics.model_name,
				provider: result.analytics.provider,
				temperature: result.analytics.temperature,
				error: result.analytics.error || null
			});
			if (analyticsError) console.error('Error saving analytics:', analyticsError);
		} catch (error) {
			console.error('Exception saving analytics:', error);
		}

		// Clean up old messages using the database function
		try {
			const { data: cleanupResult, error: cleanupErr } = await supabase.rpc('cleanup_old_conversations', {
				p_inbox_id: parseInt(inbox_id),
				max_messages: maxMessages
			});

			if (cleanupErr) {
				console.error('Error cleaning up old messages:', cleanupErr);
			} else if (cleanupResult > 0) {
				console.log(`Cleaned up ${cleanupResult} old messages for inbox ${inbox_id}`);
			}
		} catch (error) {
			console.error('Exception cleaning up old messages:', error);
		}
		
		return json(result);
	} catch (err) {
		console.error(err);
		return json({ error: 'Server error', detail: err.message }, { status: 500 });
	}
} 