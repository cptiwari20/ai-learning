import { NextRequest } from "next/server";
import { runAgent } from "@/lib/langgraph/agent";

export async function POST(req: NextRequest) {
  const { sessionId, messages, enableDrawing } = await req.json();
  const userText = messages[messages.length - 1]?.content || "";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial response
        controller.enqueue(encoder.encode("data: " + JSON.stringify({ type: "start" }) + "\n\n"));

        // Run agent with streaming callback
        const agentMessages = await runAgent(sessionId, userText, async (toolName, toolArgs) => {
          if (toolName === "excalidraw_drawing" && enableDrawing) {
            // Send drawing instruction to client
            controller.enqueue(encoder.encode("data: " + JSON.stringify({ 
              type: "drawing", 
              tool: toolName, 
              args: toolArgs 
            }) + "\n\n"));
          }
          return true; // Always confirm for now
        });

        // Send final messages
        controller.enqueue(encoder.encode("data: " + JSON.stringify({ 
          type: "messages", 
          messages: agentMessages 
        }) + "\n\n"));

        controller.enqueue(encoder.encode("data: " + JSON.stringify({ type: "end" }) + "\n\n"));
      } catch (error) {
        controller.enqueue(encoder.encode("data: " + JSON.stringify({ 
          type: "error", 
          error: "Internal server error" 
        }) + "\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
} 