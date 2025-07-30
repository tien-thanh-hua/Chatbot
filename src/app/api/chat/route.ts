import { GoogleGenAI } from '@google/genai';
import { ragService } from '@/lib/ragService';

const MODEL_NAME = 'gemini-1.5-flash-latest';
const API_KEY = process.env.GOOGLE_API_KEY || '';

// Static system instruction - separate from dynamic context
const SYSTEM_INSTRUCTION = `You are a professional and helpful customer support assistant for an industrial products company.
Your role is to answer user questions based ONLY on the product information provided in the conversation context and the conversation history.
Do not answer any questions that are not related to the products. If the information is not available, say that you cannot find the information and ask for more details.
Be concise and friendly.

When product information is provided in the conversation, use it to answer questions accurately. Always mention specific product details like name, price, and availability when relevant.

Guidelines:
- Always reference specific products by name when available
- Provide pricing information when relevant
- Mention stock availability when asked
- If comparing products, highlight key differences
- Ask clarifying questions when the query is ambiguous`;

export async function POST(req: Request) {
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  try {
    const { message, history } = await req.json();

    // Format history for Gemini API
    const formattedHistory = (history || []).map(
      (msg: { sender: 'user' | 'bot'; text: string }) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      })
    );

    // 1. Retrieve relevant products using enhanced RAG service
    const retrievalResult = await ragService.retrieveRelevantProducts(message);
    const { products } = retrievalResult;

    // Log retrieval analytics for monitoring
    const analytics = ragService.getRetrievalAnalytics(retrievalResult);
    console.log('RAG Analytics:', analytics);

    // 2. Create chat session with static system instruction
    const chat = ai.chats.create({
      model: MODEL_NAME,
      history: formattedHistory,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    // 3. Construct message with context injection (proper RAG pattern)
    const contextualMessage =
      products.length > 0
        ? `${ragService.formatProductsForContext(products)}

User Question: ${message}`
        : message;

    // 4. Send contextual message
    const result = await chat.sendMessageStream({
      message: contextualMessage,
    });

    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of result) {
          const chunkText = chunk.text;
          controller.enqueue(new TextEncoder().encode(chunkText));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-RAG-Strategy': retrievalResult.retrievalStrategy,
        'X-RAG-Results': products.length.toString(),
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
