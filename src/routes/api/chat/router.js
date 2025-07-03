// Agentic router function
export async function routeQuery(systemPrompt, question, routerLLM, last2Turns = '') {
    let routingPrompt = {
        role: 'system',
        content: `
System prompt: "${systemPrompt}"

User question: "${question}"
`
    };
    if (last2Turns && last2Turns.length > 0) {
        routingPrompt.content += `\nRecent conversation:\n${last2Turns}\n`;
    }
    routingPrompt.content += `
Classify the query as one of:
- rag: needs document retrieval (use RAG)
- none: do not use document retrieval (answer from memory/context only)

IMPORTANT: Only use 'rag' if the question requires information from documents. Otherwise, use 'none'.

Examples:
Q: "What is attention in LLMs?" → rag, needs_reframe: false
Q: "How is it so useful?" (after above, vague reference) → rag, needs_reframe: true
Q: "Hi" → none, needs_reframe: false
Q: "Thanks!" → none, needs_reframe: false
Q: "What are the features of product X?" → rag, needs_reframe: false
Q: "Can you tell me more about what we discussed earlier?" → rag, needs_reframe: true
Q: "What about the last point?" → rag, needs_reframe: true
Q: "Summarize the above" → none, needs_reframe: false

Should the question be reframed for retrieval? (yes/no)

Respond as JSON:
{
  "route": "rag" | "none",
  "needs_reframe": true | false
}
`;
    const response = await routerLLM.invoke([
        { role: 'system', content: 'You are a query router. Respond in JSON.' },
        { role: 'user', content: routingPrompt.content }
    ]);
    try {
        return JSON.parse(response.content);
    } catch {
        return { route: 'rag', needs_reframe: false }; // fallback
    }
} 