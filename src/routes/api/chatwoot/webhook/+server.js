import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

// Create Supabase client without JWT for Chatwoot integration
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

export async function POST({ request }) {
	try {
		const body = await request.json();
		console.log('Received Chatwoot webhook:', body);

		// Extract Chatwoot webhook data
		const {
			event,
			conversation,
			messages,
			account
		} = body;

		// Only process message_created events
		if (event !== 'message_created') {
			return json({ status: 'ignored', reason: 'Not a message_created event' });
		}

		// Extract conversation details
		const inboxId = conversation?.inbox_id;
		const conversationId = conversation?.id?.toString();
		const message = messages?.[0];

		if (!inboxId || !conversationId || !message) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		// Only process messages from customers (not agents)
		if (message?.message_type === 'outgoing' || message?.sender_type === 'agent_bot') {
			return json({ status: 'ignored', reason: 'Not a customer message' });
		}

		const question = message?.content;
		if (!question) {
			return json({ error: 'No message content' }, { status: 400 });
		}

		// Check if project exists for this inbox
		const { data: projectData, error: projectErr } = await supabase
			.from('projects')
			.select('id, ai_config')
			.eq('inbox_id', inboxId)
			.single();

		if (projectErr || !projectData) {
			console.error('Project not found for inbox:', inboxId);
			return json({ error: 'Project not found for this inbox' }, { status: 404 });
		}

		// Check chat status before processing
		const { data: chatSessionData, error: chatSessionErr } = await supabase.rpc('get_or_create_chat', {
			p_project_id: projectData.id,
			p_inbox_id: inboxId,
			p_chat_id: conversationId
		});

		if (chatSessionErr) {
			console.error('Error getting/creating chat session:', chatSessionErr);
			return json({ error: 'Failed to get/create chat session' }, { status: 500 });
		}

		// Check if chat is in human takeover mode
		const { data: chatData, error: chatErr } = await supabase
			.from('chats')
			.select('status')
			.eq('id', chatSessionData)
			.single();

		if (!chatErr && chatData && chatData.status === 'human_takeover') {
			console.log('Chat is in human takeover mode, not processing message');
			return json({ status: 'ignored', reason: 'Chat in human takeover mode' });
		}

		// Process the message through our chat API
		const chatResponse = await fetch(`${env.PUBLIC_BASE_URL || 'http://localhost:5173'}/api/chatwoot/chat`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				inbox_id: inboxId,
				chat_id: conversationId,
				question: question
			})
		});

		if (!chatResponse.ok) {
			console.error('Error processing chat:', await chatResponse.text());
			return json({ error: 'Failed to process chat' }, { status: 500 });
		}

		const chatResult = await chatResponse.json();
		console.log('Chat processing result:', chatResult);

		// TODO: Send response back to Chatwoot via their API
		// This would require Chatwoot API credentials and implementation

		return json({ 
			status: 'processed', 
			chat_status: chatResult.chat_status,
			answer: chatResult.answer 
		});

	} catch (error) {
		console.error('Webhook processing error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
} 