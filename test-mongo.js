const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testConnection() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING;
  
  if (!uri) {
    console.error('❌ No MongoDB URI found in environment variables');
    return;
  }
  
  console.log('🔍 Testing MongoDB connection...');
  console.log('📍 URI:', uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));
  
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });

  try {
    console.log('🔌 Attempting to connect...');
    await client.connect();
    console.log('✅ Successfully connected to MongoDB!');
    
    // Test basic operation
    const db = client.db();
    console.log('📊 Database name:', db.databaseName);
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log('📁 Collections:', collections.map(c => c.name));
    
  } catch (error) {
    console.error('❌ Connection failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.log('\n🔧 DNS Resolution Issue - Possible fixes:');
      console.log('1. Check if the cluster name in the connection string is correct');
      console.log('2. Try using a direct connection string instead of SRV');
      console.log('3. Check your internet connection');
      console.log('4. Try flushing DNS cache: sudo dscacheutil -flushcache (macOS)');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n🔧 Connection Refused - Possible fixes:');
      console.log('1. Check if your IP address is whitelisted in MongoDB Atlas');
      console.log('2. Verify the cluster is running');
    }
  } finally {
    await client.close();
    console.log('🔌 Connection closed');
  }
}

testConnection().catch(console.error);