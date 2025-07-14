import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

// Create Supabase client without JWT for Chatwoot integration
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

export async function GET({ url }) {
	try {
		const inboxId = url.searchParams.get('inbox_id');
		const chatId = url.searchParams.get('chat_id');

		if (!inboxId || !chatId) {
			return json({ error: 'Missing inbox_id or chat_id' }, { status: 400 });
		}

		// Check if project exists for this inbox
		const { data: projectData, error: projectErr } = await supabase
			.from('projects')
			.select('id, name, ai_config')
			.eq('inbox_id', parseInt(inboxId))
			.single();

		if (projectErr || !projectData) {
			return json({ error: 'Project not found for this inbox' }, { status: 404 });
		}

		// Get chat session details
		const { data: chatData, error: chatErr } = await supabase
			.from('chats')
			.select('id, status, human_agent_id, takeover_reason, created_at, updated_at')
			.eq('project_id', projectData.id)
			.eq('inbox_id', parseInt(inboxId))
			.eq('chat_id', chatId)
			.single();

		if (chatErr) {
			// Chat session doesn't exist yet
			return json({
				project_id: projectData.id,
				project_name: projectData.name,
				inbox_id: parseInt(inboxId),
				chat_id: chatId,
				status: 'not_created',
				ai_enabled: true
			});
		}

		return json({
			project_id: projectData.id,
			project_name: projectData.name,
			inbox_id: parseInt(inboxId),
			chat_id: chatId,
			status: chatData.status,
			human_agent_id: chatData.human_agent_id,
			takeover_reason: chatData.takeover_reason,
			created_at: chatData.created_at,
			updated_at: chatData.updated_at,
			ai_enabled: chatData.status !== 'human_takeover'
		});

	} catch (error) {
		console.error('Status check error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
} 