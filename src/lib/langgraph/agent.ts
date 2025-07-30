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
import { excalidrawDrawingTool } from "./excalidrawTool";


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
});

const model = new ChatOpenAI({ 
    modelName: "gpt-4o-mini",
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
}).bindTools([
    excalidrawDrawingTool,
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

  // If the last message has tool calls, we need to handle them first
  if (last.tool_calls && last.tool_calls.length) {
    const toolCall = last.tool_calls[0];
    const confirmed = await userConfirmation(toolCall.name, toolCall.args);
    if (!confirmed) {
      state.messages = [
        ...msgs,
        new AIMessage("Understood, skipping API call."),
      ];
      return state;
    }
    // If confirmed, let the tool node handle the tool call
    return state;
  }

  // If the last message is a tool message, we can proceed with the next model invocation
  if (last instanceof ToolMessage) {
    console.log("Processing ToolMessage, invoking model with messages:", msgs.length);
    const res = await model.invoke(msgs);
    state.messages = [...msgs, res];
    return state;
  }

  // For human messages or other cases, invoke the model
  const res = await model.invoke(msgs);
  state.messages = [...msgs, res];
  return state;
}

// --- Tool Node ---
async function toolNode(state: typeof GraphState.State): Promise<typeof GraphState.State> {
  console.log("TOOL NODE CALLED", 1)
  const messages = state.messages;
  const last = messages[messages.length - 1] as BaseMessage & { tool_calls?: ToolCallType[] };
  console.log("ToolNode: Processing message with tool_calls:", last.tool_calls?.length);
  if (last.tool_calls && last.tool_calls.length) {
    const toolCall = last.tool_calls[0];
    let toolResult: string;
    if (toolCall.name === "excalidraw_drawing") {
      const args = toolCall.args as { 
        action: "draw_text" | "draw_rectangle" | "draw_circle" | "draw_line" | "clear_canvas" | "update_elements"; 
        position?: {x: number, y: number};
        [key: string]: unknown 
      };
      const result = await excalidrawDrawingTool.invoke(args);
      console.log({toolCall, result})
      toolResult = typeof result === 'string' ? result : String(result);
    } else {
      toolResult = "Unknown tool called";
    }
    
    // Use the original tool call ID from the model
    const toolCallId = toolCall.id;
    
    if (!toolCallId) {
      console.error("No tool call ID found:", toolCall);
      toolResult = "Error: No tool call ID found";
      // Use a fallback ID if none is provided
      const fallbackId = `tool_call_${Date.now()}`;
      state.messages = [
        ...messages,
        new ToolMessage(toolResult, fallbackId),
      ];
    } else {
      state.messages = [
        ...messages,
        new ToolMessage(toolResult, toolCallId),
      ];
    }
    state.toolCount = (state.toolCount || 0) + 1;
  }
  console.log({state})
  return state;
}

function shouldContinue(state: typeof GraphState.State): string {
  const messages = state.messages;
  const last = messages[messages.length - 1] as BaseMessage & { tool_calls?: ToolCallType[] };
  
  // If the last message has tool calls, go to tool node
  if (last.tool_calls && last.tool_calls.length) {
    return "toolNode";
  }
  
  // If the last message is a tool message, continue to agent to get next response
  if (last instanceof ToolMessage) {
    return "agent";
  }
  
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
    const lastMsg = cleanMessages[cleanMessages.length - 1] as BaseMessage & { tool_calls?: ToolCallType[] };
    // If the last message has tool calls but no tool response, remove it
    if (lastMsg && lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
      console.log("Removing incomplete tool call message");
      cleanMessages = cleanMessages.slice(0, -1);
    }
    
    // Remove duplicate consecutive messages
    cleanMessages = cleanMessages.filter((msg, index) => {
      if (index === 0) return true;
      const prevMsg = cleanMessages[index - 1];
      return !(msg instanceof HumanMessage && prevMsg instanceof HumanMessage && msg.content === prevMsg.content);
    });
  }
  
  const state = {
        messages: shouldAddUserMessage 
          ? [...cleanMessages, new HumanMessage(userText)]
          : cleanMessages,
        toolCount: session.toolCount || 0,
        drawState: 0
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
  
  

