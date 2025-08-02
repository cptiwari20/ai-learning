#!/usr/bin/env node

/**
 * MongoDB Atlas Vector Search Index Setup Script
 * 
 * This script creates the required vector search index for the RAG system.
 * Run this once after setting up your MongoDB Atlas cluster.
 * 
 * Prerequisites:
 * 1. MongoDB Atlas cluster with M10+ tier (vector search requires this)
 * 2. Database user with read/write permissions
 * 3. Network access configured (IP whitelist)
 * 
 * Usage:
 * node scripts/setup-mongodb-vector-index.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_CONNECTION_STRING;
const DB_NAME = 'visual_learning_ai';
const COLLECTION_NAME = 'learning_documents';
const INDEX_NAME = process.env.VECTOR_INDEX_NAME || 'learning_vector_index';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_CONNECTION_STRING environment variable is required');
  process.exit(1);
}

async function setupVectorIndex() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔗 Connecting to MongoDB Atlas...');
    await client.connect();
    
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    // Create the collection if it doesn't exist
    console.log('📁 Ensuring collection exists...');
    const collections = await db.listCollections({ name: COLLECTION_NAME }).toArray();
    if (collections.length === 0) {
      await db.createCollection(COLLECTION_NAME);
      console.log(`✅ Created collection: ${COLLECTION_NAME}`);
    }
    
    // Vector search index definition
    const vectorIndexDefinition = {
      name: INDEX_NAME,
      definition: {
        mappings: {
          dynamic: true,
          fields: {
            embedding: {
              type: "knnVector",
              dimensions: 1536, // OpenAI text-embedding-ada-002 dimensions
              similarity: "cosine"
            },
            metadata: {
              type: "document",
              dynamic: true,
              fields: {
                userId: { type: "string" },
                sessionId: { type: "string" },
                type: { type: "string" },
                topic: { type: "string" },
                timestamp: { type: "date" },
                importance: { type: "number" }
              }
            }
          }
        }
      }
    };
    
    console.log('🔍 Creating vector search index...');
    console.log('⏳ This may take several minutes...');
    
    // Note: Vector search index creation is typically done through MongoDB Atlas UI
    // or Atlas Admin API, not through the MongoDB driver
    console.log(`
📋 MANUAL SETUP REQUIRED:

Please create the vector search index manually in MongoDB Atlas:

1. Go to your MongoDB Atlas dashboard
2. Navigate to your cluster
3. Click on "Search" tab
4. Click "Create Search Index"
5. Choose "Vector Search"
6. Use the following configuration:

Index Name: ${INDEX_NAME}
Database: ${DB_NAME}
Collection: ${COLLECTION_NAME}

Index Definition (JSON):
${JSON.stringify(vectorIndexDefinition.definition, null, 2)}

7. Click "Next" and then "Create Search Index"

Alternative: Use the Atlas Admin API to create the index programmatically.
    `);
    
    // Create regular indexes for better performance
    console.log('📊 Creating regular indexes...');
    
    await collection.createIndex({ "metadata.userId": 1 });
    await collection.createIndex({ "metadata.sessionId": 1 });
    await collection.createIndex({ "metadata.type": 1 });
    await collection.createIndex({ "metadata.topic": 1 });
    await collection.createIndex({ "metadata.timestamp": -1 });
    await collection.createIndex({ "metadata.userId": 1, "metadata.timestamp": -1 });
    
    console.log('✅ Regular indexes created successfully');
    
    // Create user contexts collection and indexes
    const contextCollection = db.collection('user_contexts');
    await contextCollection.createIndex({ userId: 1, sessionId: 1 }, { unique: true });
    await contextCollection.createIndex({ userId: 1, updatedAt: -1 });
    
    console.log('✅ User context indexes created successfully');
    
    console.log(`
🎉 Setup completed!

Next steps:
1. Create the vector search index in MongoDB Atlas UI (see instructions above)
2. Wait for the index to be built (can take 5-10 minutes)
3. Update your .env file with the correct MONGODB_CONNECTION_STRING
4. Start your application

Configuration summary:
- Database: ${DB_NAME}
- Collection: ${COLLECTION_NAME}
- Vector Index: ${INDEX_NAME}
- Embedding dimensions: 1536 (OpenAI ada-002)
- Similarity metric: cosine
    `);
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

setupVectorIndex();