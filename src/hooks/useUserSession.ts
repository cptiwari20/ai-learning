import { useState, useEffect } from 'react';
import { UserSessionManager } from '@/lib/rag/userSession';

export interface UseUserSessionReturn {
  userId: string;
  sessionId: string;
  isLoading: boolean;
  startNewSession: (topic?: string) => void;
  clearUserData: () => void;
  getUserHistory: () => any[];
}

export function useUserSession(): UseUserSessionReturn {
  const [userId, setUserId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize session manager on component mount
    const sessionManager = UserSessionManager.getInstance();
    const session = sessionManager.initialize();
    
    setUserId(session.userId);
    setSessionId(session.sessionId);
    setIsLoading(false);

    console.log(`🆔 User session initialized: ${session.userId}:${session.sessionId}`);
  }, []);

  const startNewSession = (topic?: string) => {
    const sessionManager = UserSessionManager.getInstance();
    const newSession = topic 
      ? sessionManager.startNewTopicSession(topic)
      : sessionManager.createNewSession();
    
    setUserId(newSession.userId);
    setSessionId(newSession.sessionId);
    
    console.log(`🆕 Started new session: ${newSession.sessionId}${topic ? ` for topic: ${topic}` : ''}`);
  };

  const clearUserData = () => {
    const sessionManager = UserSessionManager.getInstance();
    sessionManager.clearUserData();
    
    // Create new session after clearing
    const newSession = sessionManager.createNewSession();
    setUserId(newSession.userId);
    setSessionId(newSession.sessionId);
    
    console.log(`🗑️ Cleared user data and created new session: ${newSession.sessionId}`);
  };

  const getUserHistory = () => {
    const sessionManager = UserSessionManager.getInstance();
    return sessionManager.getUserHistory();
  };

  return {
    userId,
    sessionId,
    isLoading,
    startNewSession,
    clearUserData,
    getUserHistory,
  };
}