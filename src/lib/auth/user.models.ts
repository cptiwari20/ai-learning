import { ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId;
  email: string;
  name?: string;
  password?: string; // Only for email/password auth
  image?: string;
  provider: 'credentials' | 'google';
  googleId?: string; // For Google OAuth
  emailVerified?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningSession {
  _id?: ObjectId;
  userId: string;
  sessionId: string;
  topic: string;
  startedAt: Date;
  endedAt?: Date;
  totalMessages: number;
  elementsCreated: number;
  learningProgress: {
    currentChunk: number;
    totalChunks: number;
    completionPercentage: number;
  };
  canvasState?: unknown[]; // Final canvas elements
  summary?: string;
}

export interface ChatMessage {
  _id?: ObjectId;
  userId: string;
  sessionId: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    drawingAction?: string;
    elementCount?: number;
    learningChunk?: number;
  };
}

export interface UserSettings {
  _id?: ObjectId;
  userId: string;
  preferences: {
    autoTTS: boolean;
    voiceSpeed: number;
    conversationMode: 'simple' | 'advanced';
    theme: 'light' | 'dark' | 'system';
  };
  createdAt: Date;
  updatedAt: Date;
}

// Database collections
export const COLLECTIONS = {
  USERS: 'users',
  LEARNING_SESSIONS: 'learning_sessions', 
  CHAT_MESSAGES: 'chat_messages',
  USER_SETTINGS: 'user_settings',
} as const;