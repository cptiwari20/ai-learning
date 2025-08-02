import { VectorStore } from "@langchain/core/vectorstores";
import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";

// Vector store interface for easy switching between providers
export interface VectorStoreConfig {
  provider: 'mongodb' | 'pinecone';
  connectionString?: string;
  indexName?: string;
  environment?: string;
  apiKey?: string;
}

export interface UserLearningContext {
  userId: string;
  sessionId: string;
  topic: string;
  diagrams: Array<{
    id: string;
    elements: unknown[];
    description: string;
    timestamp: Date;
  }>;
  conversations: Array<{
    question: string;
    answer: string;
    timestamp: Date;
  }>;
  learningProgress: {
    topicsExplored: string[];
    conceptsLearned: string[];
    lastActivity: Date;
  };
}

export interface LearningDocument extends Document {
  metadata: {
    userId: string;
    sessionId: string;
    type: 'conversation' | 'diagram' | 'concept';
    topic: string;
    timestamp: Date;
    importance: number; // 1-10 scale
  };
}

export abstract class LearningVectorStore {
  protected vectorStore: VectorStore;
  protected embeddings: Embeddings;

  constructor(vectorStore: VectorStore, embeddings: Embeddings) {
    this.vectorStore = vectorStore;
    this.embeddings = embeddings;
  }

  // Store user learning context
  abstract storeUserContext(context: UserLearningContext): Promise<void>;

  // Retrieve user learning context
  abstract getUserContext(userId: string, sessionId?: string): Promise<UserLearningContext | null>;

  // Store learning documents (conversations, diagrams, concepts)
  abstract storeLearningDocuments(documents: LearningDocument[]): Promise<void>;

  // Search for relevant learning content
  abstract searchLearningContent(
    query: string, 
    userId: string, 
    options?: {
      topK?: number;
      filter?: Record<string, any>;
      includeUserContext?: boolean;
    }
  ): Promise<{
    documents: LearningDocument[];
    userContext?: UserLearningContext;
  }>;

  // Update user learning progress
  abstract updateLearningProgress(
    userId: string, 
    updates: Partial<UserLearningContext['learningProgress']>
  ): Promise<void>;

  // Get contextual recommendations
  abstract getContextualRecommendations(
    userId: string, 
    currentTopic: string
  ): Promise<{
    relatedTopics: string[];
    nextSteps: string[];
    reviewConcepts: string[];
  }>;
}

// Factory function to create vector store based on configuration
export async function createLearningVectorStore(
  config: VectorStoreConfig,
  embeddings: Embeddings
): Promise<LearningVectorStore> {
  switch (config.provider) {
    case 'mongodb':
      const { MongoDBLearningVectorStore } = await import('./mongodb');
      return new MongoDBLearningVectorStore(config, embeddings);
    
    case 'pinecone':
      const { PineconeLearningVectorStore } = await import('./pinecone');
      return new PineconeLearningVectorStore(config, embeddings);
    
    default:
      throw new Error(`Unsupported vector store provider: ${config.provider}`);
  }
}