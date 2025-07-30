import { BaseMessage } from "@langchain/core/messages";

// --- Session Store ---
type SessionData = {
    messages: BaseMessage[];
    toolCount: number;
  };
const sessionStore = new Map<string, SessionData>();

function loadSession(sessionId: string): SessionData {
 return sessionStore.get(sessionId) || { messages: [], toolCount: 0 };
}

function saveSession(sessionId: string, data: SessionData) {
sessionStore.set(sessionId, data);
}   

export { loadSession, saveSession };