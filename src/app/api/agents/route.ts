import { NextRequest } from "next/server";
import { runAgent } from "@/lib/langgraph/agent";

export async function POST(req: NextRequest) {
  const { sessionId, messages } = await req.json();
  // Get the last user message
  const userText = messages[messages.length - 1]?.content || "";
  try {
  // Call the agent
  const agentMessages = await runAgent(sessionId, userText);
  // For now, just return the last 5 messages as a JSON array (simulate streaming)
  return new Response(
    JSON.stringify({ messages: agentMessages }),
    {
      headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in agent route:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
} 