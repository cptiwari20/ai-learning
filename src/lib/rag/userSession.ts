import { UserLearningContext } from './vectorStore';

export interface UserSession {
  userId: string;
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
}

export class UserSessionManager {
  private static instance: UserSessionManager;
  private currentSession: UserSession | null = null;

  private constructor() {}

  static getInstance(): UserSessionManager {
    if (!UserSessionManager.instance) {
      UserSessionManager.instance = new UserSessionManager();
    }
    return UserSessionManager.instance;
  }

  // Generate random user ID
  private generateUserId(): string {
    return `user_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  }

  // Generate session ID
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Get or create current session
  getCurrentSession(): UserSession {
    if (!this.currentSession) {
      this.currentSession = this.createNewSession();
    }
    
    // Update last activity
    this.currentSession.lastActivity = new Date();
    this.saveSessionToStorage(this.currentSession);
    
    return this.currentSession;
  }

  // Create a new session
  createNewSession(userId?: string): UserSession {
    const newUserId = userId || this.loadUserIdFromStorage() || this.generateUserId();
    const sessionId = this.generateSessionId();
    
    const session: UserSession = {
      userId: newUserId,
      sessionId,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.currentSession = session;
    this.saveSessionToStorage(session);
    this.saveUserIdToStorage(newUserId);

    console.log(`🆔 Created new session: ${newUserId}:${sessionId}`);
    return session;
  }

  // Get current user ID
  getCurrentUserId(): string {
    return this.getCurrentSession().userId;
  }

  // Get current session ID
  getCurrentSessionId(): string {
    return this.getCurrentSession().sessionId;
  }

  // Create new session for current user (e.g., when starting a new topic)
  startNewTopicSession(topic: string): UserSession {
    const currentUserId = this.getCurrentUserId();
    const newSession = this.createNewSession(currentUserId);
    
    console.log(`📚 Started new topic session for ${topic}: ${newSession.sessionId}`);
    return newSession;
  }

  // Load session from browser storage
  private loadSessionFromStorage(): UserSession | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem('learning-session');
      if (stored) {
        const session = JSON.parse(stored);
        return {
          ...session,
          createdAt: new Date(session.createdAt),
          lastActivity: new Date(session.lastActivity)
        };
      }
    } catch (error) {
      console.warn('Failed to load session from storage:', error);
    }
    
    return null;
  }

  // Save session to browser storage
  private saveSessionToStorage(session: UserSession): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('learning-session', JSON.stringify(session));
    } catch (error) {
      console.warn('Failed to save session to storage:', error);
    }
  }

  // Load user ID from storage (persistent across sessions)
  private loadUserIdFromStorage(): string | null {
    if (typeof window === 'undefined') return null;

    try {
      return localStorage.getItem('learning-user-id');
    } catch (error) {
      console.warn('Failed to load user ID from storage:', error);
      return null;
    }
  }

  // Save user ID to storage
  private saveUserIdToStorage(userId: string): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('learning-user-id', userId);
    } catch (error) {
      console.warn('Failed to save user ID to storage:', error);
    }
  }

  // Initialize session manager (call on app startup)
  initialize(): UserSession {
    // Try to load existing session
    const storedSession = this.loadSessionFromStorage();
    
    if (storedSession) {
      // Check if session is still valid (less than 24 hours old)
      const hoursSinceLastActivity = (Date.now() - storedSession.lastActivity.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastActivity < 24) {
        this.currentSession = storedSession;
        console.log(`🔄 Restored session: ${storedSession.userId}:${storedSession.sessionId}`);
        return this.getCurrentSession(); // This will update lastActivity
      }
    }

    // Create new session if no valid existing session
    return this.createNewSession();
  }

  // Get user learning history key for localStorage
  getUserHistoryKey(): string {
    return `learning-history-${this.getCurrentUserId()}`;
  }

  // Save learning context to browser storage
  saveLearningContext(context: Partial<UserLearningContext>): void {
    if (typeof window === 'undefined') return;

    try {
      const historyKey = this.getUserHistoryKey();
      const existing = localStorage.getItem(historyKey);
      let history: UserLearningContext[] = existing ? JSON.parse(existing) : [];

      const session = this.getCurrentSession();
      const fullContext: UserLearningContext = {
        userId: session.userId,
        sessionId: session.sessionId,
        topic: context.topic || 'General Learning',
        diagrams: context.diagrams || [],
        conversations: context.conversations || [],
        learningProgress: {
          topicsExplored: [],
          conceptsLearned: [],
          lastActivity: new Date(),
          ...context.learningProgress
        }
      };

      // Update or add context
      const existingIndex = history.findIndex(
        h => h.sessionId === session.sessionId
      );

      if (existingIndex >= 0) {
        history[existingIndex] = fullContext;
      } else {
        history.push(fullContext);
      }

      // Keep only last 50 sessions
      if (history.length > 50) {
        history = history.slice(-50);
      }

      localStorage.setItem(historyKey, JSON.stringify(history));
      console.log(`💾 Saved learning context for session ${session.sessionId}`);
    } catch (error) {
      console.warn('Failed to save learning context:', error);
    }
  }

  // Load learning context from browser storage
  loadLearningContext(sessionId?: string): UserLearningContext | null {
    if (typeof window === 'undefined') return null;

    try {
      const historyKey = this.getUserHistoryKey();
      const stored = localStorage.getItem(historyKey);
      
      if (!stored) return null;

      const history: UserLearningContext[] = JSON.parse(stored);
      const targetSessionId = sessionId || this.getCurrentSessionId();
      
      const context = history.find(h => h.sessionId === targetSessionId);
      
      if (context) {
        console.log(`📖 Loaded learning context for session ${targetSessionId}`);
        return {
          ...context,
          learningProgress: {
            ...context.learningProgress,
            lastActivity: new Date(context.learningProgress.lastActivity)
          }
        };
      }
    } catch (error) {
      console.warn('Failed to load learning context:', error);
    }

    return null;
  }

  // Get all user learning history
  getUserHistory(): UserLearningContext[] {
    if (typeof window === 'undefined') return [];

    try {
      const historyKey = this.getUserHistoryKey();
      const stored = localStorage.getItem(historyKey);
      
      if (!stored) return [];

      return JSON.parse(stored);
    } catch (error) {
      console.warn('Failed to load user history:', error);
      return [];
    }
  }

  // Clear current session and create new one
  resetSession(): UserSession {
    this.currentSession = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('learning-session');
    }
    return this.createNewSession();
  }

  // Clear all user data
  clearUserData(): void {
    if (typeof window === 'undefined') return;

    const userId = this.getCurrentUserId();
    localStorage.removeItem('learning-session');
    localStorage.removeItem('learning-user-id');
    localStorage.removeItem(`learning-history-${userId}`);
    
    this.currentSession = null;
    console.log(`🗑️ Cleared all user data for ${userId}`);
  }
}