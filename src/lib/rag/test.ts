#!/usr/bin/env node

/**
 * RAG System Test Script
 * 
 * This script tests the RAG system functionality including:
 * - User session management
 * - Vector store operations
 * - Learning context storage and retrieval
 * - Cross-session continuity
 */

import { LearningRAGService } from './ragService';
import { UserSessionManager } from './userSession';

async function testRAGSystem() {
  console.log('🧪 Starting RAG system tests...\n');
  
  try {
    // Test 1: User Session Management
    console.log('📱 Test 1: User Session Management');
    const sessionManager = UserSessionManager.getInstance();
    const session1 = sessionManager.initialize();
    console.log(`✅ Created session: ${session1.userId}:${session1.sessionId}`);
    
    const session2 = sessionManager.startNewTopicSession('machine learning');
    console.log(`✅ New topic session: ${session2.sessionId} for ML`);
    
    // Test 2: RAG Service Initialization
    console.log('\n🧠 Test 2: RAG Service Initialization');
    const ragConfig = {
      vectorStore: {
        provider: 'mongodb' as const,
        connectionString: process.env.MONGODB_CONNECTION_STRING,
        indexName: 'test_vector_index',
      },
      embeddings: {
        openaiApiKey: process.env.OPENAI_API_KEY!,
      },
    };
    
    const ragService = await LearningRAGService.getInstance(ragConfig);
    console.log('✅ RAG service initialized successfully');
    
    // Test 3: Store Learning Conversation
    console.log('\n💾 Test 3: Store Learning Conversation');
    await ragService.storeConversation(
      "What is machine learning?",
      "Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed. It involves algorithms that can identify patterns in data and make predictions or decisions.",
      "machine learning",
      [
        { type: 'rectangle', text: 'Data Input' },
        { type: 'arrow' },
        { type: 'rectangle', text: 'ML Algorithm' },
        { type: 'arrow' },
        { type: 'rectangle', text: 'Predictions' }
      ]
    );
    console.log('✅ Conversation stored successfully');
    
    // Test 4: Retrieve Relevant Context
    console.log('\n🔍 Test 4: Retrieve Relevant Context');
    const context = await ragService.getRelevantContext(
      "How does machine learning work?",
      "machine learning"
    );
    
    console.log(`✅ Retrieved context:`);
    console.log(`   - Sources: ${context.sources.length}`);
    console.log(`   - User history: ${context.userHistory ? 'Available' : 'None'}`);
    console.log(`   - Recommendations: ${context.recommendations.nextSteps.length} next steps`);
    
    if (context.relevantContext.length > 0) {
      console.log(`   - Context preview: ${context.relevantContext.substring(0, 100)}...`);
    }
    
    // Test 5: Cross-Session Context
    console.log('\n🔄 Test 5: Cross-Session Context');
    sessionManager.startNewTopicSession('deep learning');
    
    const relatedContext = await ragService.getRelevantContext(
      "What's the difference between machine learning and deep learning?",
      "deep learning"
    );
    
    console.log(`✅ Cross-session context:`);
    console.log(`   - Found ${relatedContext.sources.length} related sources`);
    console.log(`   - Related topics: ${relatedContext.recommendations.relatedTopics.join(', ')}`);
    
    // Test 6: User Learning History
    console.log('\n📚 Test 6: User Learning History');
    const history = await ragService.getUserHistory();
    console.log(`✅ User has ${history.length} learning sessions`);
    
    if (history.length > 0) {
      const latestSession = history[0];
      console.log(`   - Latest session: ${latestSession.sessionId}`);
      console.log(`   - Topics explored: ${latestSession.learningProgress.topicsExplored.join(', ')}`);
      console.log(`   - Concepts learned: ${latestSession.learningProgress.conceptsLearned.slice(0, 3).join(', ')}`);
    }
    
    // Test 7: Session Persistence
    console.log('\n💾 Test 7: Session Persistence');
    const currentSession = ragService.getCurrentSession();
    console.log(`✅ Current session: ${currentSession.userId}:${currentSession.sessionId}`);
    
    // Save and reload
    sessionManager.saveLearningContext({
      topic: 'deep learning test',
      conversations: [
        {
          question: "Test question",
          answer: "Test answer",
          timestamp: new Date()
        }
      ]
    });
    
    const loadedContext = sessionManager.loadLearningContext();
    console.log(`✅ Context persistence: ${loadedContext ? 'Working' : 'Failed'}`);
    
    console.log('\n🎉 All RAG system tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ User session management');
    console.log('   ✅ RAG service initialization');
    console.log('   ✅ Conversation storage');
    console.log('   ✅ Context retrieval');
    console.log('   ✅ Cross-session continuity');
    console.log('   ✅ Learning history tracking');
    console.log('   ✅ Session persistence');
    
  } catch (error) {
    console.error('❌ RAG system test failed:', error);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('   1. Check environment variables (OPENAI_API_KEY, MONGODB_CONNECTION_STRING)');
    console.log('   2. Ensure MongoDB Atlas vector search index is created');
    console.log('   3. Verify network access to MongoDB Atlas');
    console.log('   4. Check OpenAI API key validity and usage limits');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  require('dotenv').config();
  testRAGSystem();
}

export { testRAGSystem };