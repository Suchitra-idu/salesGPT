import { validateUUID } from '../utils.js';

if (!validateUUID(project_id)) {
  throw new Error('Invalid project_id');
}

if (memory_type === 'vector' || memory_type === 'summary') {
  // Always fetch both window and summary
  const windowMessages = await getWindowMessages(project_id, inbox_id, windowSize);
  const summary = await getSummary(project_id, inbox_id);
  let vectorContext = null;
  if (memory_type === 'vector') {
    vectorContext = await getVectorContext(project_id, inbox_id, question, vectorLimit);
  }
  return { windowMessages, summary, vectorContext };
} else if (memory_type === 'window') {
  const windowMessages = await getWindowMessages(project_id, inbox_id, windowSize);
  return { windowMessages };
} 