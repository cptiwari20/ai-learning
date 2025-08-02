import { OpenAIEmbeddings } from "@langchain/openai";
import { LearningVectorStore, LearningDocument, UserLearningContext, createLearningVectorStore } from "./vectorStore";
import { UserSessionManager } from "./userSession";

export interface RAGConfig {
  vectorStore: {
    provider: 'mongodb' | 'pinecone';
    connectionString?: string;
    indexName?: string;
    apiKey?: string;
  };
  embeddings: {
    openaiApiKey: string;
    model?: string;
  };
}

export interface LearningRAGResult {
  relevantContext: string;
  userHistory: UserLearningContext | null;
  recommendations: {
    relatedTopics: string[];
    nextSteps: string[];
    reviewConcepts: string[];
  };
  sources: LearningDocument[];
}

export class LearningRAGService {
  private static instance: LearningRAGService;
  private vectorStore: LearningVectorStore | null = null;
  private embeddings: OpenAIEmbeddings;
  private sessionManager: UserSessionManager;
  private isInitialized = false;

  private constructor(config: RAGConfig) {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.embeddings.openaiApiKey,
      modelName: config.embeddings.model || "text-embedding-ada-002",
    });
    
    this.sessionManager = UserSessionManager.getInstance();
  }

  static async getInstance(config?: RAGConfig): Promise<LearningRAGService> {
    if (!LearningRAGService.instance) {
      if (!config) {
        throw new Error("RAG config is required for first initialization");
      }
      LearningRAGService.instance = new LearningRAGService(config);
      await LearningRAGService.instance.initialize(config);
    }
    return LearningRAGService.instance;
  }

  private async initialize(config: RAGConfig): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log(`🚀 Initializing RAG with ${config.vectorStore.provider}...`);
      
      this.vectorStore = await createLearningVectorStore(
        config.vectorStore,
        this.embeddings
      );

      // Initialize vector store if it has an initialize method
      if ('initialize' in this.vectorStore && typeof this.vectorStore.initialize === 'function') {
        await this.vectorStore.initialize();
      }

      this.isInitialized = true;
      console.log("✅ RAG service initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize RAG service:", error);
      throw error;
    }
  }

  // Store user conversation in RAG
  async storeConversation(
    question: string,
    answer: string,
    topic: string,
    diagrams?: unknown[]
  ): Promise<void> {
    if (!this.vectorStore) throw new Error("RAG service not initialized");

    const session = this.sessionManager.getCurrentSession();

    try {
      // Create learning documents
      const documents: LearningDocument[] = [
        {
          pageContent: `Question: ${question}\nAnswer: ${answer}`,
          metadata: {
            userId: session.userId,
            sessionId: session.sessionId,
            type: 'conversation',
            topic,
            timestamp: new Date(),
            importance: 7
          }
        }
      ];

      // Add diagram context if provided
      if (diagrams && diagrams.length > 0) {
        documents.push({
          pageContent: `Topic: ${topic}\nDiagram elements: ${JSON.stringify(diagrams)}`,
          metadata: {
            userId: session.userId,
            sessionId: session.sessionId,
            type: 'diagram',
            topic,
            timestamp: new Date(),
            importance: 8
          }
        });
      }

      // Store in vector database
      await this.vectorStore.storeLearningDocuments(documents);

      // Update user context
      await this.updateUserContext(topic, question, answer, diagrams);

      console.log(`📚 Stored conversation about ${topic} for user ${session.userId}`);
    } catch (error) {
      console.error("❌ Failed to store conversation:", error);
      // Don't throw - RAG storage shouldn't break the main flow
    }
  }

  // Get relevant context for a query
  async getRelevantContext(query: string, topic?: string): Promise<LearningRAGResult> {
    if (!this.vectorStore) {
      return this.getEmptyResult();
    }

    const session = this.sessionManager.getCurrentSession();

    try {
      // Search for relevant content
      const searchOptions = {
        topK: 5,
        filter: topic ? { "metadata.topic": topic } : {},
        includeUserContext: true
      };

      const searchResult = await this.vectorStore.searchLearningContent(
        query,
        session.userId,
        searchOptions
      );

      // Get recommendations
      const recommendations = await this.vectorStore.getContextualRecommendations(
        session.userId,
        topic || "General"
      );

      // Build relevant context string
      const relevantContext = this.buildContextString(searchResult.documents);

      console.log(`🔍 Retrieved context for query: "${query}" (${searchResult.documents.length} documents)`);

      return {
        relevantContext,
        userHistory: searchResult.userContext || null,
        recommendations,
        sources: searchResult.documents
      };
    } catch (error) {
      console.error("❌ Failed to get relevant context:", error);
      return this.getEmptyResult();
    }
  }

  // Update user learning context
  private async updateUserContext(
    topic: string,
    question: string,
    answer: string,
    diagrams?: unknown[]
  ): Promise<void> {
    if (!this.vectorStore) return;

    const session = this.sessionManager.getCurrentSession();

    try {
      // Get existing context or create new one
      let userContext = await this.vectorStore.getUserContext(session.userId, session.sessionId);

      if (!userContext) {
        userContext = {
          userId: session.userId,
          sessionId: session.sessionId,
          topic,
          diagrams: [],
          conversations: [],
          learningProgress: {
            topicsExplored: [],
            conceptsLearned: [],
            lastActivity: new Date()
          }
        };
      }

      // Update context
      userContext.conversations.push({
        question,
        answer,
        timestamp: new Date()
      });

      if (diagrams && diagrams.length > 0) {
        userContext.diagrams.push({
          id: `diagram_${Date.now()}`,
          elements: diagrams,
          description: `Diagram for: ${question}`,
          timestamp: new Date()
        });
      }

      // Update learning progress
      if (!userContext.learningProgress.topicsExplored.includes(topic)) {
        userContext.learningProgress.topicsExplored.push(topic);
      }

      // Extract concepts from the answer (simple keyword extraction)
      const concepts = this.extractConcepts(answer);
      for (const concept of concepts) {
        if (!userContext.learningProgress.conceptsLearned.includes(concept)) {
          userContext.learningProgress.conceptsLearned.push(concept);
        }
      }

      userContext.learningProgress.lastActivity = new Date();

      // Store updated context
      await this.vectorStore.storeUserContext(userContext);

      // Also save to browser storage
      this.sessionManager.saveLearningContext(userContext);

      console.log(`📝 Updated user context for ${session.userId}:${session.sessionId}`);
    } catch (error) {
      console.error("❌ Failed to update user context:", error);
    }
  }

  // Extract concepts from text (simple implementation)
  private extractConcepts(text: string): string[] {
    // Simple concept extraction - in production, you'd use NLP
    const concepts: string[] = [];
    const words = text.toLowerCase().split(/\s+/);
    
    // Look for important terms (this is a basic implementation)
    const importantTerms = [
      'algorithm', 'data', 'structure', 'function', 'variable', 'loop',
      'condition', 'class', 'object', 'method', 'property', 'inheritance',
      'polymorphism', 'encapsulation', 'abstraction', 'database', 'query',
      'table', 'relationship', 'primary key', 'foreign key', 'index',
      'machine learning', 'neural network', 'api', 'rest', 'http',
      'javascript', 'python', 'react', 'component', 'state', 'props'
    ];

    for (const term of importantTerms) {
      if (text.toLowerCase().includes(term)) {
        concepts.push(term);
      }
    }

    return [...new Set(concepts)]; // Remove duplicates
  }

  // Build context string from documents
  private buildContextString(documents: LearningDocument[]): string {
    if (documents.length === 0) {
      return "No previous learning context found.";
    }

    const contextParts = documents.map((doc, index) => {
      const { type, topic, timestamp } = doc.metadata;
      const date = new Date(timestamp).toLocaleDateString();
      return `[${index + 1}] ${type.toUpperCase()} (${topic}, ${date}): ${doc.pageContent}`;
    });

    return contextParts.join('\n\n');
  }

  // Get empty result when RAG is not available
  private getEmptyResult(): LearningRAGResult {
    return {
      relevantContext: "No previous learning context available.",
      userHistory: null,
      recommendations: {
        relatedTopics: [],
        nextSteps: ["Continue exploring this topic"],
        reviewConcepts: []
      },
      sources: []
    };
  }

  // Get user's learning history
  async getUserHistory(): Promise<UserLearningContext[]> {
    if (!this.vectorStore) {
      return this.sessionManager.getUserHistory();
    }

    const session = this.sessionManager.getCurrentSession();

    try {
      const context = await this.vectorStore.getUserContext(session.userId);
      return context ? [context] : [];
    } catch (error) {
      console.error("❌ Failed to get user history:", error);
      return this.sessionManager.getUserHistory();
    }
  }

  // Clear user data
  async clearUserData(): Promise<void> {
    const session = this.sessionManager.getCurrentSession();
    
    // Clear browser storage
    this.sessionManager.clearUserData();

    console.log(`🗑️ Cleared user data for ${session.userId}`);
  }

  // Get current session info
  getCurrentSession() {
    return this.sessionManager.getCurrentSession();
  }

  // Start new learning session
  startNewSession(topic?: string) {
    if (topic) {
      return this.sessionManager.startNewTopicSession(topic);
    }
    return this.sessionManager.createNewSession();
  }
}