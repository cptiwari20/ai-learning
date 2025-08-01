import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, BaseMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { excalidrawTool } from "./excalidrawTool";
// Import broadcastDrawing dynamically to avoid circular dependency
// import { broadcastDrawing } from "@/app/api/draw/ws/route";

// Define the state structure
const DrawingState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  sessionId: Annotation<string>({
    reducer: (x, _y) => x,
  }),
  iterations: Annotation<number>({
    reducer: (x, _y) => (x || 0) + 1,
  }),
  currentElements: Annotation<unknown[]>({
    reducer: (x, y) => y || x || [],
  }),
  conversationContext: Annotation<string>({
    reducer: (x, y) => y || x || '',
  }),
});

// Initialize the model with tools
const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.1,
  apiKey: process.env.OPENAI_API_KEY,
}).bindTools([excalidrawTool]);

// Agent node - handles conversation and decides when to use tools
async function agentNode(state: typeof DrawingState.State) {
  console.log(`Agent node called - iteration ${state.iterations || 0}`);
  
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  
  console.log(`Last message type: ${lastMessage?.constructor.name}`);
  console.log(`Total messages: ${messages.length}`);

  // Enhanced system prompt with context awareness
  let messagesToSend = messages;
  if (messages.length === 1 && messages[0] instanceof HumanMessage) {
    const currentElementsCount = state.currentElements?.length || 0;
    const conversationSummary = state.conversationContext || '';
    
    const systemPrompt = new AIMessage(`You are an AI drawing assistant that creates ACTUAL VISUAL DRAWINGS using Excalidraw tools.

CRITICAL RULES:
- NEVER provide explanatory text or descriptions
- NEVER mention Excalidraw links or external URLs
- ONLY call the excalidraw_drawing tool to create visual elements
- DO NOT say what you will draw - JUST DRAW IT
- Respond ONLY with tool calls, no additional text

CONTEXT AWARENESS:
- Current canvas has ${currentElementsCount} elements
- Previous conversation context: ${conversationSummary}
- When adding new elements, consider existing drawings and build upon them
- For iterative requests, add to existing content rather than replacing it

ACTIONS TO USE:
- For flowcharts: create_flowchart with steps array
- For mind maps: create_mindmap with branches array  
- For simple shapes: draw_rectangle, draw_circle, draw_text, etc.
- Position new elements to complement existing ones (avoid overlap)
- Use consistent colors and styling with existing elements

Available actions: create_flowchart, create_mindmap, create_diagram, draw_rectangle, draw_circle, draw_line, draw_text, draw_arrow, draw_diamond, clear_canvas

RESPOND ONLY WITH TOOL CALLS - NO TEXT RESPONSES.`);
    
    messagesToSend = [systemPrompt, ...messages];
  }

  try {
    const response = await model.invoke(messagesToSend);
    console.log(`Model response type: ${response.constructor.name}`);
    console.log(`Has tool calls: ${(response as AIMessage & { tool_calls?: unknown[] }).tool_calls?.length || 0}`);
    
    // If response has tool calls, clear any text content to ensure only drawing actions
    if (response instanceof AIMessage && response.tool_calls && response.tool_calls.length > 0) {
      response.content = ''; // Remove any explanatory text
    }
    
    return {
      messages: [response],
      iterations: 1
    };
  } catch (error) {
    console.error('Error in agent node:', error);
    const errorMessage = new AIMessage("I encountered an error while processing your request. Please try again.");
    return {
      messages: [errorMessage],
      iterations: 1
    };
  }
}

// Tool node - executes tools when called by the agent
async function toolNode(state: typeof DrawingState.State) {
  console.log('Tool node called');
  
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1] as AIMessage;
  
  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    console.log('No tool calls found in last message');
    return { messages: [] };
  }

  const toolMessages: ToolMessage[] = [];

  for (const toolCall of lastMessage.tool_calls) {
    console.log(`Executing tool: ${toolCall.name} with ID: ${toolCall.id}`);
    
    try {
      if (toolCall.name === 'excalidraw_drawing') {
        const result = await excalidrawTool.invoke(toolCall.args);
        console.log('Tool execution result:', result);
        
        const toolMessage = new ToolMessage(result, toolCall.id);
        toolMessages.push(toolMessage);
      } else {
        console.warn(`Unknown tool: ${toolCall.name}`);
        const errorMessage = new ToolMessage(
          JSON.stringify({ success: false, message: `Unknown tool: ${toolCall.name}`, elements: [] }),
          toolCall.id
        );
        toolMessages.push(errorMessage);
      }
    } catch (error) {
      console.error(`Error executing tool ${toolCall.name}:`, error);
      const errorMessage = new ToolMessage(
        JSON.stringify({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Tool execution failed',
          elements: [] 
        }),
        toolCall.id
      );
      toolMessages.push(errorMessage);
    }
  }

  console.log(`Created ${toolMessages.length} tool messages`);
  return { messages: toolMessages };
}

// Router function - decides next step based on current state
function shouldContinue(state: typeof DrawingState.State): string {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  const iterations = state.iterations || 0;

  console.log(`Router: Last message type: ${lastMessage?.constructor.name}`);
  console.log(`Router: Iterations: ${iterations}`);

  // Safety check - prevent infinite loops
  if (iterations > 10) {
    console.log('Router: Max iterations reached, ending');
    return END;
  }

  // If last message is AI with tool calls, go to tool node
  if (lastMessage instanceof AIMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    console.log('Router: Going to tool node');
    return 'tools';
  }

  // If last message is a tool message, continue conversation with agent
  if (lastMessage instanceof ToolMessage) {
    console.log('Router: Going back to agent');
    return 'agent';
  }

  // Otherwise, end the conversation
  console.log('Router: Ending conversation');
  return END;
}

// Build the graph
const graph = new StateGraph(DrawingState)
  .addNode('agent', agentNode)
  .addNode('tools', toolNode)
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', shouldContinue, {
    tools: 'tools',
    [END]: END,
  })
  .addConditionalEdges('tools', shouldContinue, {
    agent: 'agent',
    [END]: END,
  });

const compiledGraph = graph.compile();

// Session storage for context persistence
const sessionContexts = new Map<string, {
  elements: unknown[];
  conversationHistory: string;
  lastUpdate: number;
}>();

// Main function to run the drawing agent
export async function runDrawingAgent(
  message: string,
  sessionId: string,
  onDrawingEvent?: (elements: unknown[], message: string) => void
): Promise<{ messages: BaseMessage[] }> {
  console.log('Starting drawing agent for session:', sessionId);
  console.log('User message:', message);

  // Get existing context for session
  const existingContext = sessionContexts.get(sessionId);
  const conversationSummary = existingContext ? 
    `Previous requests: ${existingContext.conversationHistory}. Current canvas has ${existingContext.elements.length} elements.` : 
    'First request in session.';

  const initialState = {
    messages: [new HumanMessage(message)],
    sessionId,
    iterations: 0,
    currentElements: existingContext?.elements || [],
    conversationContext: conversationSummary,
  };

  try {
    const result = await compiledGraph.invoke(initialState);
    console.log('Agent completed with', result.messages.length, 'total messages');

    // Extract drawing events from tool results and call the callback
    let allElements: unknown[] = existingContext?.elements || [];
    
    if (onDrawingEvent) {
      for (const msg of result.messages) {
        if (msg instanceof ToolMessage) {
          try {
            const toolResult = JSON.parse(msg.content) as { success: boolean; elements?: unknown[]; message: string };
            if (toolResult.success && toolResult.elements && toolResult.elements.length > 0) {
              // Update all elements for context persistence
              allElements = toolResult.elements;
              
              // Broadcast to WebSocket clients
              console.log('🚀 Broadcasting drawing elements via WebSocket (non-streaming):', toolResult.elements.length);
              try {
                const { broadcastDrawing } = await import("@/app/api/draw/ws/route");
                broadcastDrawing(toolResult.elements as unknown[], toolResult.message);
              } catch (error) {
                console.error('❌ Non-streaming WebSocket broadcast failed:', error);
              }
              
              onDrawingEvent(toolResult.elements, toolResult.message);
            }
          } catch (e) {
            console.warn('Failed to parse tool result:', e);
          }
        }
      }
    }

    // Update session context
    const currentContext = sessionContexts.get(sessionId) || { elements: [], conversationHistory: '', lastUpdate: 0 };
    sessionContexts.set(sessionId, {
      elements: allElements,
      conversationHistory: currentContext.conversationHistory + ` | ${message}`,
      lastUpdate: Date.now()
    });

    return { messages: result.messages };
  } catch (error) {
    console.error('Error running drawing agent:', error);
    const errorMessage = new AIMessage("I encountered an error while processing your drawing request. Please try again.");
    return { messages: [new HumanMessage(message), errorMessage] };
  }
}

// Stream version for real-time updates
export async function streamDrawingAgent(
  message: string,
  sessionId: string,
  onUpdate: (data: { type: string; content?: string; elements?: unknown[]; message?: string }) => void
): Promise<void> {
  console.log('Starting streaming drawing agent for session:', sessionId);

  // Get existing context for session
  const existingContext = sessionContexts.get(sessionId);
  const conversationSummary = existingContext ? 
    `Previous requests: ${existingContext.conversationHistory}. Current canvas has ${existingContext.elements.length} elements.` : 
    'First request in session.';

  const initialState = {
    messages: [new HumanMessage(message)],
    sessionId,
    iterations: 0,
    currentElements: existingContext?.elements || [],
    conversationContext: conversationSummary,
  };

  try {
    const stream = await compiledGraph.stream(initialState);
    let allElements: unknown[] = existingContext?.elements || [];

    for await (const chunk of stream) {
      console.log('🌊 Stream chunk received:', Object.keys(chunk));
      console.log('🌊 Chunk details:', JSON.stringify(chunk, null, 2));

      // Handle agent responses - only show text if no tool calls are made
      if (chunk.agent) {
        const messages = chunk.agent.messages;
        for (const msg of messages) {
          if (msg instanceof AIMessage && typeof msg.content === 'string') {
            // Only send text response if there are no tool calls (fallback case)
            const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0;
            if (!hasToolCalls && msg.content.trim()) {
              onUpdate({ type: 'message', content: msg.content });
            }
          }
        }
      }

      // Handle tool results
      if (chunk.tools) {
        console.log('🔧 Processing tools chunk with', chunk.tools.messages.length, 'messages');
        const messages = chunk.tools.messages;
        for (const msg of messages) {
          console.log('🔧 Processing message:', msg.constructor.name);
          if (msg instanceof ToolMessage) {
            console.log('🔧 Found ToolMessage, processing...');
            try {
              console.log('🔍 Parsing tool message content...');
              const toolResult = JSON.parse(msg.content) as { success: boolean; elements?: unknown[]; message: string };
              console.log('🔍 Tool result:', { success: toolResult.success, elementsCount: toolResult.elements?.length || 0, message: toolResult.message });
              
              if (toolResult.success && toolResult.elements && toolResult.elements.length > 0) {
                // Broadcast to WebSocket clients
                console.log('🚀 ATTEMPTING WebSocket broadcast with', toolResult.elements.length, 'elements');
                console.log('🚀 Elements to broadcast:', JSON.stringify(toolResult.elements, null, 2));
                
                try {
                  console.log('🚀 Dynamically importing broadcastDrawing function...');
                  const { broadcastDrawing } = await import("@/app/api/draw/ws/route");
                  console.log('🚀 Calling broadcastDrawing function...');
                  broadcastDrawing(toolResult.elements as unknown[], toolResult.message);
                  console.log('✅ WebSocket broadcast function call completed');
                } catch (error) {
                  console.error('❌ WebSocket broadcast failed with error:', error);
                  console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
                }
              } else {
                console.log('⚠️ Not broadcasting - conditions not met:', {
                  success: toolResult.success,
                  hasElements: !!toolResult.elements,
                  elementsLength: toolResult.elements?.length || 0
                });
              }
              
              // Always send the update regardless of broadcast success
              if (toolResult.success && toolResult.elements && toolResult.elements.length > 0) {
                // Update all elements for context persistence
                allElements = toolResult.elements;
                
                onUpdate({
                  type: 'drawing',
                  elements: toolResult.elements,
                  message: '✨ Drawing updated'
                });
              } else if (toolResult.success) {
                // Send brief message for actions like clear_canvas
                onUpdate({
                  type: 'message',
                  content: toolResult.message === 'Canvas cleared' ? '🧹 Canvas cleared' : '✅ Action completed'
                });
              }
            } catch (e) {
              console.warn('Failed to parse tool result in stream:', e);
            }
          }
        }
      }
    }

    // Update session context after streaming completes
    const currentContext = sessionContexts.get(sessionId) || { elements: [], conversationHistory: '', lastUpdate: 0 };
    sessionContexts.set(sessionId, {
      elements: allElements,
      conversationHistory: currentContext.conversationHistory + ` | ${message}`,
      lastUpdate: Date.now()
    });

    onUpdate({ type: 'complete' });
  } catch (error) {
    console.error('Error in streaming drawing agent:', error);
    onUpdate({
      type: 'error',
      content: 'I encountered an error while processing your drawing request. Please try again.'
    });
  }
}