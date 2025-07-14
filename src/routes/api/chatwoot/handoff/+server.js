import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

// Create Supabase client without JWT for Chatwoot integration
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { inbox_id, chat_id, reason = 'Manual handoff', human_agent_id = null } = body;

		if (!inbox_id || !chat_id) {
			return json({ error: 'Missing inbox_id or chat_id' }, { status: 400 });
		}

		// Find project by inbox_id
		const { data: projectData, error: projectErr } = await supabase
			.from('projects')
			.select('id')
			.eq('inbox_id', parseInt(inbox_id))
			.single();

		if (projectErr || !projectData) {
			return json({ error: 'Project not found for this inbox' }, { status: 404 });
		}

		// Get or create chat session
		const { data: chatSessionData, error: chatSessionErr } = await supabase.rpc('get_or_create_chat', {
			p_project_id: projectData.id,
			p_inbox_id: parseInt(inbox_id),
			p_chat_id: chat_id
		});

		if (chatSessionErr) {
			console.error('Error getting/creating chat session:', chatSessionErr);
			return json({ error: 'Failed to get/create chat session' }, { status: 500 });
		}

		// Update chat status to human takeover
		const { error: updateError } = await supabase
			.from('chats')
			.update({
				status: 'human_takeover',
				takeover_reason: reason,
				human_agent_id: human_agent_id,
				updated_at: new Date().toISOString()
			})
			.eq('id', chatSessionData);

		if (updateError) {
			console.error('Error updating chat status:', updateError);
			return json({ error: 'Failed to update chat status' }, { status: 500 });
		}

		return json({ 
			status: 'success',
			message: 'Chat transferred to human agent',
			chat_status: 'human_takeover',
			takeover_reason: reason
		});

	} catch (error) {
		console.error('Handoff error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
} 