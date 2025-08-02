import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { MongoClient } from "mongodb";
import { Embeddings } from "@langchain/core/embeddings";
import { 
  LearningVectorStore, 
  VectorStoreConfig, 
  UserLearningContext, 
  LearningDocument 
} from "./vectorStore";

export class MongoDBLearningVectorStore extends LearningVectorStore {
  private client: MongoClient;
  private dbName: string;
  private collectionName: string;
  private contextCollectionName: string;

  constructor(config: VectorStoreConfig, embeddings: Embeddings) {
    if (!config.connectionString) {
      throw new Error("MongoDB connection string is required");
    }

    const client = new MongoClient(config.connectionString);
    const dbName = "visual_learning_ai";
    const collectionName = "learning_documents";
    const contextCollectionName = "user_contexts";

    // Initialize MongoDB Atlas Vector Search
    const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
      client,
      databaseName: dbName,
      collectionName: collectionName,
      indexName: config.indexName || "vector_index",
    });

    super(vectorStore, embeddings);
    
    this.client = client;
    this.dbName = dbName;
    this.collectionName = collectionName;
    this.contextCollectionName = contextCollectionName;
  }

  async storeUserContext(context: UserLearningContext): Promise<void> {
    try {
      const db = this.client.db(this.dbName);
      const collection = db.collection(this.contextCollectionName);

      // Upsert user context (update if exists, insert if not)
      await collection.replaceOne(
        { 
          userId: context.userId, 
          sessionId: context.sessionId 
        },
        {
          ...context,
          updatedAt: new Date()
        },
        { upsert: true }
      );

      console.log(`✅ Stored user context for ${context.userId}:${context.sessionId}`);
    } catch (error) {
      console.error("❌ Failed to store user context:", error);
      throw error;
    }
  }

  async getUserContext(userId: string, sessionId?: string): Promise<UserLearningContext | null> {
    try {
      const db = this.client.db(this.dbName);
      const collection = db.collection(this.contextCollectionName);

      let query: any = { userId };
      if (sessionId) {
        query.sessionId = sessionId;
      }

      // Get the most recent context if no sessionId specified
      const context = await collection.findOne(
        query,
        { sort: { updatedAt: -1 } }
      );

      if (context) {
        console.log(`✅ Retrieved user context for ${userId}${sessionId ? ':' + sessionId : ''}`);
        return context as UserLearningContext;
      }

      return null;
    } catch (error) {
      console.error("❌ Failed to retrieve user context:", error);
      throw error;
    }
  }

  async storeLearningDocuments(documents: LearningDocument[]): Promise<void> {
    try {
      // Add documents to vector store
      await this.vectorStore.addDocuments(documents);

      console.log(`✅ Stored ${documents.length} learning documents in vector store`);
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
        "metadata.userId": userId
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
      const db = this.client.db(this.dbName);
      const collection = db.collection(this.contextCollectionName);

      // Update learning progress in the most recent context
      await collection.updateOne(
        { userId },
        {
          $set: {
            [`learningProgress.${Object.keys(updates)[0]}`]: Object.values(updates)[0],
            "learningProgress.lastActivity": new Date(),
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );

      console.log(`✅ Updated learning progress for user ${userId}`);
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

  // Initialize MongoDB collections and indexes
  async initialize(): Promise<void> {
    try {
      await this.client.connect();
      const db = this.client.db(this.dbName);

      // Create collections if they don't exist
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);

      if (!collectionNames.includes(this.collectionName)) {
        await db.createCollection(this.collectionName);
      }

      if (!collectionNames.includes(this.contextCollectionName)) {
        await db.createCollection(this.contextCollectionName);
      }

      // Create indexes for better performance
      const contextCollection = db.collection(this.contextCollectionName);
      await contextCollection.createIndex({ userId: 1, sessionId: 1 }, { unique: true });
      await contextCollection.createIndex({ userId: 1, updatedAt: -1 });

      console.log("✅ MongoDB collections and indexes initialized");
    } catch (error) {
      console.error("❌ Failed to initialize MongoDB:", error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}