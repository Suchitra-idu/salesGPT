// Agentic router function
export async function routeQuery(systemPrompt, question, routerLLM, lastNSummaries = [], fullSummary = '', router_config = undefined) {
    let ragMetadata = (router_config && typeof router_config.rag_metadata === 'string') ? router_config.rag_metadata : '';
    let ragExamples = Array.isArray(router_config?.rag_examples) ? router_config.rag_examples : [];
    let reframeExamples = Array.isArray(router_config?.reframe_examples) ? router_config.reframe_examples : [];
    const promptParts = [];
    promptParts.push(`You are a router for a RAG chatbot. Decide for each user message which of the following should be used:\n- \"rag\": Use document retrieval (RAG) if the question is about something in the RAG database.\n- \"memory\": Use summary memory if the question needs context from the conversation.\n- \"reframe\": Rephrase the question for better RAG retrieval if it is vague or refers to previous context. IMPORTANT: Only include \"reframe\" if you also include \"rag\".`);
    promptParts.push(`RAG database contains: \"${ragMetadata}\"`);
    if (lastNSummaries.length > 0) {
        promptParts.push(`Recent summary memories:\n${lastNSummaries.join('\n')}`);
    }
    if (fullSummary) {
        promptParts.push(`Full summary (if available):\n${fullSummary}`);
    }
    if (ragExamples.length > 0) {
        promptParts.push('RAG Routing Examples:');
        for (const ex of ragExamples) {
            promptParts.push(`Q: \"${ex.question}\" → ${ex.route}, needs_reframe: ${ex.needs_reframe}`);
        }
    }
    if (reframeExamples.length > 0) {
        promptParts.push('Reframing Examples:');
        for (const ex of reframeExamples) {
            promptParts.push(`Q: \"${ex.question}\" → needs_reframe: ${ex.needs_reframe}`);
        }
    }
    promptParts.push(`User message: \"${question}\"`);
    promptParts.push(`\nRespond as JSON:\n{\n  \"routes\": [\"rag\", \"memory\", \"reframe\"] // include any that apply\n}`);
    const routingPrompt = {
        role: 'system',
        content: promptParts.join('\n\n')
    };
    // Log the final router prompt string before sending to LLM
    console.log('ROUTER FINAL PROMPT STRING:\n' + routingPrompt.content);
    const response = await routerLLM.invoke([
        { role: 'system', content: 'You are a query router. Respond only with a valid JSON object as described.' },
        { role: 'user', content: routingPrompt.content }
    ]);
    // Log the raw router LLM response
    console.log('ROUTER RAW ANSWER:', response.content);
    try {
        // Handle JSON wrapped in markdown code blocks
        let jsonContent = response.content.trim();
        if (jsonContent.startsWith('```json')) {
            jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonContent.startsWith('```')) {
            jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        console.log('ROUTER CLEANED JSON:', jsonContent);
        const parsed = JSON.parse(jsonContent);
        console.log('ROUTER PARSED RESULT:', parsed);
        
        if (Array.isArray(parsed.routes)) {
            return { routes: parsed.routes.map(r => r.toLowerCase()) };
        }
        return { routes: [] };
    } catch (parseError) {
        console.error('ROUTER JSON PARSE ERROR:', parseError);
        console.error('ROUTER FAILED CONTENT:', response.content);
        return { routes: [] }; // fallback
    }
} 