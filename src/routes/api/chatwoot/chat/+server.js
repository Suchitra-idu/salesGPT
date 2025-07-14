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

	// Create Supabase client without JWT for Chatwoot integration
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

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
			return json({ error: 'Failed to get/create chat session' }, { status: 500 });
		}
		
		// Check chat status - if in human takeover, don't process
		const { data: chatData, error: chatErr } = await supabase
			.from('chats')
			.select('status, takeover_reason')
			.eq('id', chatSessionData)
			.single();
			
		if (chatErr) {
			console.error('Error checking chat status:', chatErr);
			// Continue processing if we can't check status
		} else if (chatData && chatData.status === 'human_takeover') {
			console.log('Chat is in human takeover mode, skipping AI processing');
			return json({ 
				answer: 'This conversation has been transferred to a human agent. Please wait for their response.',
				chat_status: 'human_takeover',
				takeover_reason: chatData.takeover_reason
			});
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
			null, // No user ID for Chatwoot
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

		// Handle handoff if needed
		if (result.should_handoff) {
			try {
				const { error: handoffError } = await supabase
					.from('chats')
					.update({
						status: 'human_takeover',
						takeover_reason: result.handoff_reason,
						updated_at: new Date().toISOString()
					})
					.eq('id', chatSessionData);
				
				if (handoffError) {
					console.error('Error updating chat status for handoff:', handoffError);
				} else {
					console.log('Chat marked for human takeover:', result.handoff_reason);
				}
			} catch (error) {
				console.error('Exception updating chat status:', error);
			}
		}

		// Save analytics (without user_id for Chatwoot)
		try {
			console.log('SERVER - Saving analytics with token_usage:', result.analytics.token_usage);
			const { error: analyticsError } = await supabase.from('chat_analytics').insert({
				project_id: projectData.id,
				conversation_id: inbox_id,
				user_id: null, // No user ID for Chatwoot
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