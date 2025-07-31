import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, BaseMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { excalidrawTool } from "./excalidrawTool";

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

  // Add system prompt for first interaction
  let messagesToSend = messages;
  if (messages.length === 1 && messages[0] instanceof HumanMessage) {
    const systemPrompt = new AIMessage(`You are an AI drawing assistant that helps users create visual content using Excalidraw. 

When users ask you to draw something:
1. Use the excalidraw_drawing tool to create shapes, text, and drawings
2. Choose appropriate coordinates, sizes, and colors
3. Break complex drawings into multiple simple shapes
4. Always provide descriptive feedback about what you're drawing

Available actions: draw_rectangle, draw_circle, draw_line, draw_text, clear_canvas

For positioning, use a coordinate system where (0,0) is top-left. Spread elements across the canvas (use coordinates like 100, 200, 300, etc.) to avoid overlapping.

Now I'll help you with your drawing request.`);
    
    messagesToSend = [systemPrompt, ...messages];
  }

  try {
    const response = await model.invoke(messagesToSend);
    console.log(`Model response type: ${response.constructor.name}`);
    console.log(`Has tool calls: ${(response as AIMessage & { tool_calls?: unknown[] }).tool_calls?.length || 0}`);
    
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

// Main function to run the drawing agent
export async function runDrawingAgent(
  message: string,
  sessionId: string,
  onDrawingEvent?: (elements: unknown[], message: string) => void
): Promise<{ messages: BaseMessage[] }> {
  console.log('Starting drawing agent for session:', sessionId);
  console.log('User message:', message);

  const initialState = {
    messages: [new HumanMessage(message)],
    sessionId,
    iterations: 0,
  };

  try {
    const result = await compiledGraph.invoke(initialState);
    console.log('Agent completed with', result.messages.length, 'total messages');

    // Extract drawing events from tool results and call the callback
    if (onDrawingEvent) {
      for (const msg of result.messages) {
        if (msg instanceof ToolMessage) {
          try {
            const toolResult = JSON.parse(msg.content) as { success: boolean; elements?: unknown[]; message: string };
            if (toolResult.success && toolResult.elements && toolResult.elements.length > 0) {
              onDrawingEvent(toolResult.elements, toolResult.message);
            }
          } catch (e) {
            console.warn('Failed to parse tool result:', e);
          }
        }
      }
    }

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

  const initialState = {
    messages: [new HumanMessage(message)],
    sessionId,
    iterations: 0,
  };

  try {
    const stream = await compiledGraph.stream(initialState);

    for await (const chunk of stream) {
      console.log('Stream chunk:', Object.keys(chunk));

      // Handle agent responses
      if (chunk.agent) {
        const messages = chunk.agent.messages;
        for (const msg of messages) {
          if (msg instanceof AIMessage && typeof msg.content === 'string') {
            onUpdate({ type: 'message', content: msg.content });
          }
        }
      }

      // Handle tool results
      if (chunk.tools) {
        const messages = chunk.tools.messages;
        for (const msg of messages) {
          if (msg instanceof ToolMessage) {
            try {
              const toolResult = JSON.parse(msg.content) as { success: boolean; elements?: unknown[]; message: string };
              if (toolResult.success && toolResult.elements && toolResult.elements.length > 0) {
                onUpdate({
                  type: 'drawing',
                  elements: toolResult.elements,
                  message: toolResult.message
                });
              } else if (toolResult.success) {
                // Send message even if no elements (for actions like clear_canvas)
                onUpdate({
                  type: 'message',
                  content: toolResult.message
                });
              }
            } catch (e) {
              console.warn('Failed to parse tool result in stream:', e);
            }
          }
        }
      }
    }

    onUpdate({ type: 'complete' });
  } catch (error) {
    console.error('Error in streaming drawing agent:', error);
    onUpdate({
      type: 'error',
      content: 'I encountered an error while processing your drawing request. Please try again.'
    });
  }
}