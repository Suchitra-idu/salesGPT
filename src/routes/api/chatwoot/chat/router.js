// Agentic router function with handoff logic
export async function routeQuery(systemPrompt, question, routerLLM, lastTwoMessages = '', fullSummary = '', router_config = undefined) {
    let ragMetadata = (router_config && typeof router_config.rag_metadata === 'string') ? router_config.rag_metadata : '';
    let ragExamples = Array.isArray(router_config?.rag_examples) ? router_config.rag_examples : [];
    let reframeExamples = Array.isArray(router_config?.reframe_examples) ? router_config.reframe_examples : [];
    const promptParts = [];
    promptParts.push(`You are a router for a RAG chatbot. Decide for each user message which of the following should be used:\n- \"rag\": Use document retrieval (RAG) if the question is about something in the RAG database.\n- \"memory\": Use summary memory if the question needs context from the conversation.\n- \"reframe\": Rephrase the question for better RAG retrieval if it is vague or refers to previous context. IMPORTANT: Only include \"reframe\" if you also include \"rag\".\n- \"handoff\": Transfer to human agent if the question is complex, requires personal assistance, or is outside the AI's capabilities.`);
    promptParts.push(`RAG database contains: \"${ragMetadata}\"`);
    if (lastTwoMessages) {
        promptParts.push(`Recent conversation:\n${lastTwoMessages}`);
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
    promptParts.push(`\nRespond as JSON:\n{\n  \"routes\": [\"reframe\", \"rag\", \"memory\", \"handoff\"] // include any that apply\n}`);
    const routingPrompt = {
        role: 'system',
        content: promptParts.join('\n\n')
    };
    // Log the complete router prompt as a string
    console.log('ROUTER COMPLETE PROMPT STRING:');
    console.log('--- System Message ---');
    console.log('You are a query router. Respond only with a valid JSON object as described.');
    console.log('--- User Message ---');
    console.log(routingPrompt.content);
    console.log('---');
    
    const response = await routerLLM.invoke([
        { role: 'system', content: 'You are a query router. Respond only with a valid JSON object as described.' },
        { role: 'user', content: routingPrompt.content }
    ]);
    
    console.log('ROUTER OUTPUT - Raw Response:', response.content);
    
    // Capture token usage
    let tokenUsage = null;
    if (response.usage) {
        tokenUsage = {
            prompt_tokens: response.usage.promptTokens,
            completion_tokens: response.usage.completionTokens,
            total_tokens: response.usage.totalTokens
        };
    } else if (response.response_metadata?.usage) {
        tokenUsage = {
            prompt_tokens: response.response_metadata.usage.prompt_tokens,
            completion_tokens: response.response_metadata.usage.completion_tokens,
            total_tokens: response.response_metadata.usage.total_tokens
        };
    } else if (response.llmOutput?.tokenUsage) {
        tokenUsage = {
            prompt_tokens: response.llmOutput.tokenUsage.promptTokens,
            completion_tokens: response.llmOutput.tokenUsage.completionTokens,
            total_tokens: response.llmOutput.tokenUsage.totalTokens
        };
    }
    console.log('ROUTER OUTPUT - Captured Token Usage:', tokenUsage);
    
    try {
        // Handle JSON wrapped in markdown code blocks
        let jsonContent = response.content.trim();
        if (jsonContent.startsWith('```json')) {
            jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonContent.startsWith('```')) {
            jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        console.log('ROUTER OUTPUT - Cleaned JSON String:', jsonContent);
        const parsed = JSON.parse(jsonContent);
        console.log('ROUTER OUTPUT - Parsed Routes:', parsed.routes);
        
        if (Array.isArray(parsed.routes)) {
            return { 
                routes: parsed.routes.map(r => r.toLowerCase()),
                tokenUsage: tokenUsage
            };
        }
        return { 
            routes: [],
            tokenUsage: tokenUsage
        };
    } catch (parseError) {
        console.error('ROUTER OUTPUT - JSON Parse Error:', parseError);
        console.error('ROUTER OUTPUT - Failed Content:', response.content);
        return { 
            routes: [], // fallback
            tokenUsage: tokenUsage
        };
    }
} 