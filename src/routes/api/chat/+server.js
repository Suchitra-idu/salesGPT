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
		let { inbox_id, question, chat_id } = body;
		if (!inbox_id || !question) {
			return json({ error: 'Missing inbox_id or question' }, { status: 400 });
		}
		// Set default chat_id if not provided
		if (!chat_id) {
			chat_id = '1'; // Default placeholder chat_id
		}
		// Only check that question is present; allow any string for conversation_id
		if (!question) {
			return json({ error: 'Invalid input' }, { status: 400 });
		}
		question = sanitizeInput(question);

		// Find project by inbox_id - only get what we need
		const { data: projectData, error: projectErr } = await supabase
			.from('projects')
			.select('id, ai_config')
			.eq('inbox_id', inbox_id)
			.single();

		if (projectErr || !projectData) {
			return json({ error: 'Project not found for this inbox', detail: projectErr?.message }, { status: 404 });
		}

		// Get conversation history - fetch only the last N conversation turns needed
		const maxMessages = projectData.ai_config?.max_conversation_messages || 20;
		const windowSize = projectData.ai_config?.memory_config?.window_size || 2;
		const turnsNeeded = Math.max(windowSize, 2); // Number of conversation turns needed
		
		let conversationHistory = [];
		
		try {
			// Get or create chat session first
			const { data: chatSessionData, error: chatSessionErr } = await supabase.rpc('get_or_create_chat', {
				p_project_id: projectData.id,
				p_inbox_id: parseInt(inbox_id),
				p_chat_id: chat_id
			});
			
			if (chatSessionErr) {
				console.error('Error getting/creating chat session:', chatSessionErr);
				// Continue without chat session if there's an error
			}
			
			// Fetch only the last N conversation turns (each turn = 1 row with content + answer)
			const { data: historyData, error: historyErr } = await supabase
				.from('conversations')
				.select('content, answer, summary, created_at, confidence_score')
				.eq('inbox_id', parseInt(inbox_id))
				.eq('chat_id', chat_id)
				.eq('chat_session_id', chatSessionData)
				.order('created_at', { ascending: false })
				.limit(turnsNeeded);

			if (historyErr) {
				console.error('Error fetching conversation history:', historyErr);
				// Continue without history if there's an error
			} else {
				// Transform to chronological order and create message pairs
				conversationHistory = (historyData || [])
					.reverse()
					.slice(-maxMessages)
					.flatMap(row => {
						const messages = [];
						// Add user message if content exists
						if (row.content && row.content.trim()) {
							messages.push({
								role: 'user',
								content: row.content,
								summary: row.summary,
								created_at: row.created_at
							});
						}
						// Add assistant message if answer exists
						if (row.answer && row.answer.trim()) {
							messages.push({
								role: 'assistant',
								content: row.answer,
								summary: row.summary,
								confidence_score: row.confidence_score,
								created_at: row.created_at
							});
						}
						return messages;
					});
				
				console.log('Retrieved conversation history:', conversationHistory.length, 'messages from', turnsNeeded, 'turns');
				console.log('First few history entries:', conversationHistory.slice(0, 3));
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
			chat_id,
			user.id,
			true, // useRouter
			parseInt(inbox_id)
		);

		// Store the new conversation entry - one row per conversation turn
		try {
			const { error: convError } = await supabase
				.from('conversations')
				.insert({
					project_id: projectData.id,
					inbox_id: parseInt(inbox_id),
					chat_id: chat_id,
					chat_session_id: chatSessionData,
					content: question,
					answer: result.answer,
					summary: result.turn_summary || null,
					confidence_score: result.confidence_score || 1.0,
					used_rag: result.used_rag || false,
					created_at: new Date().toISOString()
				});
			if (convError) console.error('Error saving conversation:', convError);
		} catch (error) {
			console.error('Exception saving conversation:', error);
		}

		// Save analytics
		try {
			console.log('SERVER - Saving analytics with token_usage:', result.analytics.token_usage);
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
		
		return json(result);
	} catch (err) {
		console.error(err);
		return json({ error: 'Server error', detail: err.message }, { status: 500 });
	}
} 