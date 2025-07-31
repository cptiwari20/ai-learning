import { ChatOpenAI } from "@langchain/openai";
import {
    AIMessage,
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import {
    StateGraph,
  START,
  END,
  Annotation,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { loadSession, saveSession } from "./sessionStore";
import { excalidrawTool } from "../drawing/excalidrawTool";


const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
  messages: Annotation<BaseMessage[]>({
      reducer: (x, y) => x.concat(y),
  }),
  toolCount: Annotation<number>({
    reducer: (x, y) => x + y,
  }),
  drawState: Annotation<number>({
    reducer: (x, y) => x + y,
  }),
  iterations: Annotation<number>({
    reducer: (x, y) => (x || 0) + (y || 1),
  }),
});

const model = new ChatOpenAI({ 
    modelName: "gpt-4o-mini",
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
}).bindTools([
    excalidrawTool,
  ]);

// --- User Confirmation ---
type ToolCallType = { 
  name: string; 
  args: Record<string, unknown>; 
  id?: string 
};

type UserConfirmationCallback = (toolName: string, toolArgs: Record<string, unknown>) => Promise<boolean>;

const defaultUserConfirmation: UserConfirmationCallback = 
  async (_toolName, _toolArgs) => {
    // Default: always confirm (for non-interactive use)
    return true;
  };

// --- Agent Node ---
async function agentNode(
  state: typeof GraphState.State,
  userConfirmation: UserConfirmationCallback
): Promise<typeof GraphState.State> {
  const msgs = state.messages;
  const last = msgs[msgs.length - 1] as BaseMessage & { tool_calls?: ToolCallType[] };
  
  // Increment iteration counter
  state.iterations = (state.iterations || 0) + 1;
  console.log(`AgentNode: Starting iteration ${state.iterations}`);

  // If the last message has tool calls, we need to handle them first
  if (last.tool_calls && last.tool_calls.length) {
    // Check confirmation for all tool calls
    for (const toolCall of last.tool_calls) {
      const confirmed = await userConfirmation(toolCall.name, toolCall.args);
      if (!confirmed) {
        state.messages = [
          ...msgs,
          new AIMessage("Understood, skipping API call."),
        ];
        return state;
      }
    }
    // If all confirmed, let the tool node handle the tool calls
    return state;
  }

  // If the last message is a tool message, we can proceed with the next model invocation
  if (last instanceof ToolMessage) {
    console.log("Processing ToolMessage, invoking model with messages:", msgs.length);
    console.log("Message types:", msgs.map(m => m.constructor.name));
    
    // Debug: Check for any AI messages with tool calls that might not have responses
    const aiMessagesWithToolCalls = msgs.filter(m => 
      m.constructor.name === 'AIMessage' && 
      (m as any).tool_calls && 
      (m as any).tool_calls.length > 0
    );
    
    if (aiMessagesWithToolCalls.length > 0) {
      console.log("AI messages with tool calls found:");
      aiMessagesWithToolCalls.forEach((msg, idx) => {
        const toolCalls = (msg as any).tool_calls || [];
        console.log(`  AI Message ${idx}: ${toolCalls.length} tool calls`);
        toolCalls.forEach((tc: any) => console.log(`    - ${tc.name} (ID: ${tc.id})`));
      });
      
      // Check which tool call IDs have responses
      const toolMessages = msgs.filter(m => m.constructor.name === 'ToolMessage') as ToolMessage[];
      console.log("Tool messages found:");
      toolMessages.forEach((tm, idx) => {
        console.log(`  Tool Message ${idx}: responds to ID ${tm.tool_call_id}`);
      });
      
      // Validate that all tool calls have responses - be more thorough
      // Only check the MOST RECENT AI message with tool calls, not all of them
      const lastAiMessageWithToolCalls = [...aiMessagesWithToolCalls].reverse()[0]; // Get the most recent one
      const toolCallsToCheck = lastAiMessageWithToolCalls ? (lastAiMessageWithToolCalls as any).tool_calls || [] : [];
      const allToolCallIds = toolCallsToCheck.map((tc: any) => tc.id);
      const respondedToolCallIds = toolMessages.map(tm => tm.tool_call_id);
      const missingResponses = allToolCallIds.filter(id => !respondedToolCallIds.includes(id));
      
      console.log("Checking only the most recent AI message for missing responses");
      console.log("Most recent AI message tool calls:", allToolCallIds);
      
      if (missingResponses.length > 0) {
        console.error("ERROR: Tool calls without responses detected:", missingResponses);
        console.log("Most recent AI tool call IDs:", allToolCallIds);
        console.log("Responded tool call IDs:", respondedToolCallIds);
        console.log("This will likely cause a 400 error from OpenAI");
        
        // Add missing tool messages with error responses
        const missingToolMessages = missingResponses.map(id => 
          new ToolMessage("Tool execution completed", id)
        );
        
        console.log("Adding missing tool messages:", missingToolMessages.length);
        state.messages = [...msgs, ...missingToolMessages];
        
        // Try invoking the model again with the fixed messages
        try {
          const res = await model.invoke(state.messages);
          console.log("Model invoke successful after fixing missing responses");
          state.messages = [...state.messages, res];
          return state;
        } catch (fixError) {
          console.error("Even after fixing missing responses, model invoke failed:", fixError);
          throw fixError;
        }
      }
    }
    
    try {
      const res = await model.invoke(msgs);
      console.log("Model invoke successful, response type:", res.constructor.name);
      console.log("Response has tool calls:", (res as any).tool_calls?.length || 0);
      if ((res as any).tool_calls?.length > 0) {
        console.log("Tool calls in response:", (res as any).tool_calls.map((tc: any) => ({ name: tc.name, id: tc.id })));
      }
      state.messages = [...msgs, res];
      return state;
    } catch (error) {
      console.error("Model invocation error:", error);
      throw error;
    }
  }

  // For human messages or other cases, invoke the model
  console.log("AgentNode: Invoking model for non-tool message");
  console.log("Message types before model invoke:", msgs.map(m => m.constructor.name));
  const res = await model.invoke(msgs);
  console.log("AgentNode: Model response type:", res.constructor.name);
  console.log("AgentNode: Model response has tool calls:", (res as any).tool_calls?.length || 0);
  state.messages = [...msgs, res];
  return state;
}

// --- Tool Node ---
async function toolNode(state: typeof GraphState.State): Promise<typeof GraphState.State> {
  console.log("TOOL NODE CALLED", 1)
  const messages = state.messages;
  const last = messages[messages.length - 1] as BaseMessage & { tool_calls?: ToolCallType[] };
  console.log("ToolNode: Processing message with tool_calls:", last.tool_calls?.length);
  console.log("Tool calls details:", last.tool_calls?.map(tc => ({ name: tc.name, id: tc.id })));
  
  if (last.tool_calls && last.tool_calls.length) {
    const toolMessages: ToolMessage[] = [];
    
    // Process ALL tool calls, not just the first one
    for (const toolCall of last.tool_calls) {
      console.log(`Processing tool call: ${toolCall.name} with ID: ${toolCall.id}`);
      let toolResult: string;
      
      if (toolCall.name === "excalidraw_drawing") {
        const args = toolCall.args as { 
          action: "draw_text" | "draw_rectangle" | "draw_circle" | "draw_line" | "clear_canvas"; 
          x?: number;
          y?: number;
          text?: string;
          color?: string;
          backgroundColor?: string;
          strokeWidth?: number;
          fontSize?: number;
          width?: number;
          height?: number;
          [key: string]: unknown 
        };
        
        try {
          const result = await excalidrawTool.invoke(args);
          console.log("Excalidraw tool result:", result);
          
          // Parse the JSON result and extract the message for the tool response
          const parsedResult = JSON.parse(result as string);
          toolResult = parsedResult.message || "Drawing action completed";
          
          // Store the drawing data in the state for later use by the frontend
          if (parsedResult.success && parsedResult.elements && parsedResult.elements.length > 0) {
            state.drawState = (state.drawState || 0) + parsedResult.elements.length;
          }
        } catch (error) {
          console.error("Error executing excalidraw tool:", error);
          toolResult = "Error executing drawing tool";
        }
      } else {
        toolResult = `Unknown tool called: ${toolCall.name}`;
      }
      
      // Use the original tool call ID from the model
      const toolCallId = toolCall.id;
      
      if (!toolCallId) {
        console.error("No tool call ID found:", toolCall);
        toolResult = "Error: No tool call ID found";
        // Use a fallback ID if none is provided
        const fallbackId = `tool_call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        console.log(`Creating ToolMessage with fallback ID: ${fallbackId}`);
        toolMessages.push(new ToolMessage(toolResult, fallbackId));
      } else {
        console.log(`Creating ToolMessage with ID: ${toolCallId}`);
        toolMessages.push(new ToolMessage(toolResult, toolCallId));
      }
    }
    
    // Add all tool messages to the state
    state.messages = [...messages, ...toolMessages];
    state.toolCount = (state.toolCount || 0) + toolMessages.length;
  }
  
  console.log("Tool node completed with messages:", state.messages.length)
  return state;
}

function shouldContinue(state: typeof GraphState.State): string {
  const messages = state.messages;
  const last = messages[messages.length - 1] as BaseMessage & { tool_calls?: ToolCallType[] };
  const iterations = state.iterations || 0;
  
  console.log(`shouldContinue: Last message type is ${last.constructor.name}`);
  console.log(`shouldContinue: Has tool calls: ${last.tool_calls ? last.tool_calls.length : 0}`);
  console.log(`shouldContinue: Current iterations: ${iterations}`);
  
  // Safety check: prevent infinite loops
  if (iterations > 10) {
    console.log("shouldContinue: Max iterations reached, ending conversation");
    return END;
  }
  
  // If the last message has tool calls, go to tool node
  if (last.tool_calls && last.tool_calls.length) {
    console.log("shouldContinue: Routing to toolNode");
    return "toolNode";
  }
  
  // If the last message is a tool message, continue to agent to get next response
  if (last instanceof ToolMessage) {
    console.log("shouldContinue: Routing to agent");
    return "agent";
  }
  
  console.log("shouldContinue: Ending conversation");
  return END;
}

// --- Graph Setup ---
function buildGraph(userConfirmation: UserConfirmationCallback) {
  const graph = new StateGraph(GraphState)
    .addNode("agent", (state) => agentNode(state, userConfirmation))
    .addNode("toolNode", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue, {
      toolNode: "toolNode",
      [END]: END,
    })
    .addConditionalEdges("toolNode", shouldContinue, {
      agent: "agent",
      [END]: END,
    });
  return graph;
}

// --- Main Entry Point ---
/**
 * Runs the agent for a given session and user input.
 * @param sessionId Unique session identifier
 * @param userText User's message
 * @param userConfirmation Optional callback for tool call confirmation
 * @returns Last 5 messages (for UI)
 */
export async function runAgent(
  sessionId: string,
  userText: string,
  userConfirmation?: UserConfirmationCallback
) {
  const session = loadSession(sessionId);
  
  // Check if the last message is already the same user message to avoid duplication
  const lastMessage = session.messages[session.messages.length - 1];
  const shouldAddUserMessage = !(lastMessage instanceof HumanMessage && lastMessage.content === userText);
  
  // Clean up any incomplete conversation state and remove duplicates
  let cleanMessages = session.messages;
  if (cleanMessages.length > 0) {
    console.log("Original messages before cleanup:", cleanMessages.map(m => `${m.constructor.name}: ${typeof m.content === 'string' ? m.content.substring(0, 30) : 'complex'}...`));
    
    // More aggressive duplicate removal - remove any duplicate messages regardless of position
    const seenMessages = new Set();
    cleanMessages = cleanMessages.filter((msg, index) => {
      let messageKey: string;
      
      if (msg instanceof HumanMessage) {
        messageKey = `human:${msg.content}`;
      } else if (msg instanceof AIMessage) {
        const toolCalls = (msg as any).tool_calls || [];
        messageKey = `ai:${msg.content}:${toolCalls.length}:${toolCalls.map((tc: any) => tc.id).join(',')}`;
      } else if (msg instanceof ToolMessage) {
        messageKey = `tool:${msg.content}:${msg.tool_call_id}`;
      } else {
        messageKey = `other:${msg.constructor.name}:${index}`;
      }
      
      if (seenMessages.has(messageKey)) {
        console.log(`Removing duplicate message at index ${index}: ${messageKey}`);
        return false;
      }
      
      seenMessages.add(messageKey);
      return true;
    });
    
    // If the last message has tool calls but no tool response, remove it
    const lastMsg = cleanMessages[cleanMessages.length - 1] as BaseMessage & { tool_calls?: ToolCallType[] };
    if (lastMsg && lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
      // Check if there are corresponding tool messages
      const toolCallIds = lastMsg.tool_calls.map(tc => tc.id);
      const hasToolResponses = cleanMessages.some(msg => 
        msg instanceof ToolMessage && toolCallIds.includes(msg.tool_call_id)
      );
      
      if (!hasToolResponses) {
        console.log("Removing incomplete tool call message (no tool responses found)");
        cleanMessages = cleanMessages.slice(0, -1);
      }
    }
    
    console.log("Messages after cleanup:", cleanMessages.map(m => `${m.constructor.name}: ${typeof m.content === 'string' ? m.content.substring(0, 30) : 'complex'}...`));
  }
  
  const state = {
        messages: shouldAddUserMessage 
          ? [...cleanMessages, new HumanMessage(userText)]
          : cleanMessages,
        toolCount: session.toolCount || 0,
        drawState: 0,
        iterations: 0
    };
    
    console.log("Starting agent with messages:", state.messages.length);
    console.log("Messages:", state.messages.map(m => `${m.constructor.name}: ${typeof m.content === 'string' ? m.content.substring(0, 50) : 'complex content'}...`));
    try {
        const graph = buildGraph(userConfirmation || defaultUserConfirmation);
        const runner = graph.compile();
        const result = await runner.invoke(state);
        // console.log({result}
        const messages = result.messages;
        session.messages = messages;
        session.toolCount = result.toolCount || 0;
        saveSession(sessionId, session);
        return messages.slice(-5);
    } catch (error) {
        console.error("Error in agent route:", error);
        throw error;
    }
}
  
  

