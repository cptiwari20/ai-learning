import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { Embeddings } from "@langchain/core/embeddings";
import { 
  LearningVectorStore, 
  VectorStoreConfig, 
  UserLearningContext, 
  LearningDocument 
} from "./vectorStore";

export class PineconeLearningVectorStore extends LearningVectorStore {
  private pinecone: Pinecone;
  private indexName: string;
  private contextStore: Map<string, UserLearningContext> = new Map();

  constructor(config: VectorStoreConfig, embeddings: Embeddings) {
    if (!config.apiKey) {
      throw new Error("Pinecone API key is required");
    }

    if (!config.indexName) {
      throw new Error("Pinecone index name is required");
    }

    const pinecone = new Pinecone({
      apiKey: config.apiKey,
    });

    const index = pinecone.Index(config.indexName);
    
    // Initialize Pinecone vector store
    const vectorStore = new PineconeStore(embeddings, {
      pineconeIndex: index,
      maxConcurrency: 5,
    });

    super(vectorStore, embeddings);
    
    this.pinecone = pinecone;
    this.indexName = config.indexName;
  }

  async storeUserContext(context: UserLearningContext): Promise<void> {
    try {
      // For Pinecone, we'll use metadata storage since it doesn't have a separate document store
      // In production, you'd typically use a separate database for user contexts
      const key = `${context.userId}:${context.sessionId}`;
      this.contextStore.set(key, {
        ...context,
        learningProgress: {
          ...context.learningProgress,
          lastActivity: new Date()
        }
      });

      // Also store as a document in vector store for search capability
      const contextDoc: LearningDocument = {
        pageContent: JSON.stringify({
          topic: context.topic,
          concepts: context.learningProgress.conceptsLearned,
          topics: context.learningProgress.topicsExplored
        }),
        metadata: {
          userId: context.userId,
          sessionId: context.sessionId,
          type: 'context',
          topic: context.topic,
          timestamp: new Date(),
          importance: 10 // High importance for context
        }
      };

      await this.vectorStore.addDocuments([contextDoc]);

      console.log(`✅ Stored user context for ${context.userId}:${context.sessionId}`);
    } catch (error) {
      console.error("❌ Failed to store user context:", error);
      throw error;
    }
  }

  async getUserContext(userId: string, sessionId?: string): Promise<UserLearningContext | null> {
    try {
      if (sessionId) {
        const key = `${userId}:${sessionId}`;
        const context = this.contextStore.get(key);
        if (context) {
          console.log(`✅ Retrieved user context for ${userId}:${sessionId}`);
          return context;
        }
      }

      // If no specific session, get the most recent context for the user
      let mostRecentContext: UserLearningContext | null = null;
      let mostRecentTime = 0;

      for (const [key, context] of this.contextStore.entries()) {
        if (key.startsWith(`${userId}:`)) {
          const time = context.learningProgress.lastActivity.getTime();
          if (time > mostRecentTime) {
            mostRecentTime = time;
            mostRecentContext = context;
          }
        }
      }

      if (mostRecentContext) {
        console.log(`✅ Retrieved most recent context for user ${userId}`);
      }

      return mostRecentContext;
    } catch (error) {
      console.error("❌ Failed to retrieve user context:", error);
      throw error;
    }
  }

  async storeLearningDocuments(documents: LearningDocument[]): Promise<void> {
    try {
      // Add documents to vector store
      await this.vectorStore.addDocuments(documents);

      console.log(`✅ Stored ${documents.length} learning documents in Pinecone`);
    } catch (error) {
      console.error("❌ Failed to store learning documents:", error);
      throw error;
    }
  }

  async searchLearningContent(
    query: string,
    userId: string,
    options: {
      topK?: number;
      filter?: Record<string, any>;
      includeUserContext?: boolean;
    } = {}
  ): Promise<{
    documents: LearningDocument[];
    userContext?: UserLearningContext;
  }> {
    try {
      const { topK = 5, filter = {}, includeUserContext = true } = options;

      // Add user-specific filter
      const userFilter = {
        ...filter,
        userId: { $eq: userId }
      };

      // Search vector store
      const results = await this.vectorStore.similaritySearch(query, topK, userFilter);

      // Get user context if requested
      let userContext: UserLearningContext | undefined;
      if (includeUserContext) {
        userContext = await this.getUserContext(userId) || undefined;
      }

      console.log(`✅ Found ${results.length} relevant documents for user ${userId}`);

      return {
        documents: results as LearningDocument[],
        userContext
      };
    } catch (error) {
      console.error("❌ Failed to search learning content:", error);
      throw error;
    }
  }

  async updateLearningProgress(
    userId: string,
    updates: Partial<UserLearningContext['learningProgress']>
  ): Promise<void> {
    try {
      // Update the most recent context for the user
      let contextToUpdate: UserLearningContext | null = null;
      let contextKey: string | null = null;
      let mostRecentTime = 0;

      for (const [key, context] of this.contextStore.entries()) {
        if (key.startsWith(`${userId}:`)) {
          const time = context.learningProgress.lastActivity.getTime();
          if (time > mostRecentTime) {
            mostRecentTime = time;
            contextToUpdate = context;
            contextKey = key;
          }
        }
      }

      if (contextToUpdate && contextKey) {
        const updatedContext = {
          ...contextToUpdate,
          learningProgress: {
            ...contextToUpdate.learningProgress,
            ...updates,
            lastActivity: new Date()
          }
        };

        this.contextStore.set(contextKey, updatedContext);
        console.log(`✅ Updated learning progress for user ${userId}`);
      }
    } catch (error) {
      console.error("❌ Failed to update learning progress:", error);
      throw error;
    }
  }

  async getContextualRecommendations(
    userId: string,
    currentTopic: string
  ): Promise<{
    relatedTopics: string[];
    nextSteps: string[];
    reviewConcepts: string[];
  }> {
    try {
      const userContext = await this.getUserContext(userId);
      
      if (!userContext) {
        return {
          relatedTopics: [],
          nextSteps: [`Continue exploring ${currentTopic}`],
          reviewConcepts: []
        };
      }

      // Get related topics from user's learning history
      const { topicsExplored, conceptsLearned } = userContext.learningProgress;

      // Simple recommendation logic (can be enhanced with ML)
      const relatedTopics = topicsExplored
        .filter(topic => topic !== currentTopic)
        .slice(0, 3);

      const nextSteps = [
        `Explore advanced concepts in ${currentTopic}`,
        "Try creating a complex diagram",
        "Test your understanding with examples"
      ];

      const reviewConcepts = conceptsLearned
        .slice(-3) // Last 3 concepts learned
        .reverse();

      console.log(`✅ Generated recommendations for user ${userId}`);

      return {
        relatedTopics,
        nextSteps,
        reviewConcepts
      };
    } catch (error) {
      console.error("❌ Failed to get contextual recommendations:", error);
      throw error;
    }
  }

  // Initialize Pinecone index
  async initialize(): Promise<void> {
    try {
      // Check if index exists
      const indexList = await this.pinecone.listIndexes();
      const indexExists = indexList.indexes?.some(index => index.name === this.indexName);

      if (!indexExists) {
        console.log(`Creating Pinecone index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: 1536, // OpenAI embedding dimension
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });

        // Wait for index to be ready
        console.log("Waiting for index to be ready...");
        await new Promise(resolve => setTimeout(resolve, 60000));
      }

      console.log("✅ Pinecone index initialized");
    } catch (error) {
      console.error("❌ Failed to initialize Pinecone:", error);
      throw error;
    }
  }
}