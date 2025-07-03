import { validateUUID } from '../utils.js';

if (!validateUUID(project_id) || !validateUUID(conversation_id)) {
  throw new Error('Invalid project_id or conversation_id');
}

if (memory_type === 'vector' || memory_type === 'summary') {
  // Always fetch both window and summary
  const windowMessages = await getWindowMessages(project_id, conversation_id, windowSize);
  const summary = await getSummary(project_id, conversation_id);
  let vectorContext = null;
  if (memory_type === 'vector') {
    vectorContext = await getVectorContext(project_id, conversation_id, question, vectorLimit);
  }
  return { windowMessages, summary, vectorContext };
} else if (memory_type === 'window') {
  const windowMessages = await getWindowMessages(project_id, conversation_id, windowSize);
  return { windowMessages };
} 