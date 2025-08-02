# 🧠 RAG System Setup Guide

## Overview

The Visual Learning AI now includes a sophisticated RAG (Retrieval-Augmented Generation) system that provides personalized learning experiences by storing and retrieving user context, learning history, and diagram interactions.

## 🏗️ Architecture

### Core Components

1. **Vector Store Interface** (`src/lib/rag/vectorStore.ts`)
   - Abstract interface for easy switching between MongoDB and Pinecone
   - Supports user context storage and retrieval
   - Handles learning document management

2. **MongoDB Implementation** (`src/lib/rag/mongodb.ts`)
   - Uses MongoDB Atlas Vector Search
   - Stores user learning contexts and conversations
   - Provides semantic search capabilities

3. **Pinecone Implementation** (`src/lib/rag/pinecone.ts`)
   - Alternative vector database option
   - Easy switching via environment variables
   - Production-ready scalability

4. **User Session Management** (`src/lib/rag/userSession.ts`)
   - Browser-based session persistence
   - Random user ID generation
   - Learning context tracking

5. **RAG Service** (`src/lib/rag/ragService.ts`)
   - High-level interface for RAG operations
   - Conversation storage and retrieval
   - Learning recommendations

## 🚀 Quick Setup

### 1. Choose Your Vector Database

#### Option A: MongoDB Atlas (Recommended)

```bash
# Set environment variables
VECTOR_STORE_PROVIDER=mongodb
MONGODB_CONNECTION_STRING=mongodb+srv://username:password@cluster.mongodb.net/visual_learning_ai
VECTOR_INDEX_NAME=learning_vector_index
```

**Setup Steps:**
1. Create MongoDB Atlas cluster (M10+ tier required for vector search)
2. Run setup script: `node scripts/setup-mongodb-vector-index.js`
3. Create vector search index in Atlas UI (follow script instructions)
4. Wait for index to build (5-10 minutes)

#### Option B: Pinecone

```bash
# Set environment variables
VECTOR_STORE_PROVIDER=pinecone
PINECONE_API_KEY=your_pinecone_api_key
VECTOR_INDEX_NAME=learning-vector-index
```

### 2. Update Environment Variables

Copy `.env.example` to `.env` and configure:

```env
OPENAI_API_KEY=your_openai_api_key
VECTOR_STORE_PROVIDER=mongodb  # or 'pinecone'
MONGODB_CONNECTION_STRING=your_mongodb_uri
VECTOR_INDEX_NAME=learning_vector_index
```

### 3. Install Dependencies

All required dependencies are already installed via the main npm install.

## 🎯 Features

### Personalized Learning Context

- **User Sessions**: Persistent user identification across browser sessions
- **Learning History**: Tracks topics explored and concepts learned
- **Conversation Memory**: Remembers previous discussions and diagrams
- **Progress Tracking**: Monitors learning journey and provides recommendations

### Smart Content Retrieval

- **Semantic Search**: Finds relevant previous conversations and diagrams
- **Context-Aware Responses**: Agent builds on previous learning
- **Topic Continuity**: Maintains context across learning sessions
- **Personalized Recommendations**: Suggests related topics and next steps

### Diagram Context Integration

- **Visual Memory**: Stores diagram elements with conversations
- **Spatial Awareness**: Remembers canvas layouts and connections
- **Learning Progression**: Tracks visual concept development
- **Cross-Session Continuity**: Maintains context across sessions

## 🔧 Usage

### Frontend Integration

The RAG system is automatically integrated into the main learning interface:

```typescript
// User session is managed automatically
const { userId, sessionId, startNewSession, clearUserData } = useUserSession();

// RAG context is retrieved in LangGraph agent
// Previous conversations inform new responses
// Learning history personalizes teaching approach
```

### Learning Session Management

```typescript
// Start new topic session
startNewSession("machine learning");

// Clear all user data (creates new user)
clearUserData();
```

### Agent Integration

The LangGraph agent automatically:
1. **Retrieves** relevant context before responding
2. **Personalizes** responses based on user history
3. **Stores** conversations and diagrams after completion
4. **Provides** contextual recommendations

## 📊 Data Structure

### User Learning Context

```typescript
interface UserLearningContext {
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
```

### Learning Documents

```typescript
interface LearningDocument {
  pageContent: string;
  metadata: {
    userId: string;
    sessionId: string;
    type: 'conversation' | 'diagram' | 'concept';
    topic: string;
    timestamp: Date;
    importance: number; // 1-10 scale
  };
}
```

## 🔄 Switching Vector Databases

To switch from MongoDB to Pinecone (or vice versa):

1. Update environment variable:
   ```env
   VECTOR_STORE_PROVIDER=pinecone  # or 'mongodb'
   ```

2. Add provider-specific configuration:
   ```env
   # For Pinecone
   PINECONE_API_KEY=your_api_key
   
   # For MongoDB
   MONGODB_CONNECTION_STRING=your_uri
   ```

3. Restart the application

The system automatically uses the configured provider with no code changes required.

## 🎛️ Advanced Configuration

### Vector Index Settings

**MongoDB Atlas:**
- Dimensions: 1536 (OpenAI ada-002)
- Similarity: cosine
- Dynamic mapping enabled

**Pinecone:**
- Dimensions: 1536
- Metric: cosine
- Serverless deployment

### Performance Tuning

- **Batch Size**: Adjust vector store batch operations
- **Search Results**: Configure `topK` results (default: 5)
- **Context Window**: Manage conversation history length
- **Cache Strategy**: Implement client-side caching for frequent queries

## 🔒 Privacy & Security

- **User Anonymity**: Random user IDs, no personal data collection
- **Local Storage**: Session data stored in browser localStorage
- **Data Encryption**: Vector databases support encryption at rest
- **Access Control**: Configure database authentication and network access

## 🛠️ Troubleshooting

### Common Issues

1. **Vector Index Not Found**
   - Ensure vector search index is created in MongoDB Atlas
   - Wait for index build completion (can take 5-10 minutes)
   - Verify index name matches environment variable

2. **Connection Failed**
   - Check MongoDB connection string format
   - Verify network access and IP whitelist
   - Ensure database user has proper permissions

3. **Embedding Errors**
   - Verify OpenAI API key is valid
   - Check API usage limits and quotas
   - Ensure text length is within limits (8192 tokens)

4. **Session Not Persisting**
   - Check browser localStorage availability
   - Verify session management initialization
   - Clear browser data if sessions are corrupted

### Debug Logging

Enable detailed logging by checking browser console for:
- `🔍 RAG node called - retrieving learning context`
- `📚 Retrieved RAG context: X sources`
- `💾 Storage node called - saving to RAG`
- `✅ Stored learning conversation`

## 🚀 Production Deployment

### MongoDB Atlas
- Use M10+ tier for vector search
- Configure proper network security
- Set up monitoring and alerts
- Plan for data backup and recovery

### Pinecone
- Choose appropriate plan based on usage
- Configure pod size for performance
- Set up monitoring and logging
- Plan for index scaling

### Environment Variables
```env
NODE_ENV=production
VECTOR_STORE_PROVIDER=mongodb
MONGODB_CONNECTION_STRING=mongodb+srv://...
OPENAI_API_KEY=sk-...
VECTOR_INDEX_NAME=learning_vector_index
```

## 📈 Monitoring

Track these metrics for optimal performance:
- Vector search latency
- Embedding generation time
- User session duration
- Learning context retrieval success rate
- Storage operation completion rate

The RAG system transforms the Visual Learning AI from a stateless drawing tool into a personalized, context-aware learning assistant that grows smarter with each interaction! 🎓✨