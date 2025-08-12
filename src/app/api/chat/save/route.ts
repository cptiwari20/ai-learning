import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { MongoClient } from 'mongodb';
import { COLLECTIONS, type ChatMessage, type LearningSession } from '@/lib/auth/user.models';

const client = new MongoClient(process.env.MONGODB_URI!);

// Save chat messages and update session
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId, messages, topic, canvasState, learningProgress } = await request.json();

    if (!sessionId || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Session ID and messages are required' },
        { status: 400 }
      );
    }

    await client.connect();

    // Save chat messages
    const messagesCollection = client.db().collection<ChatMessage>(COLLECTIONS.CHAT_MESSAGES);
    const chatMessages = messages.map((msg: any) => ({
      userId: session.user.id,
      sessionId,
      type: msg.type,
      content: msg.content,
      timestamp: new Date(msg.timestamp || Date.now()),
      metadata: msg.metadata,
    }));

    // Clear existing messages for this session and insert new ones
    await messagesCollection.deleteMany({ 
      userId: session.user.id, 
      sessionId 
    });
    
    if (chatMessages.length > 0) {
      await messagesCollection.insertMany(chatMessages);
    }

    // Update or create learning session
    const sessionsCollection = client.db().collection<LearningSession>(COLLECTIONS.LEARNING_SESSIONS);
    
    const sessionUpdate = {
      userId: session.user.id,
      sessionId,
      topic: topic || 'General Learning',
      totalMessages: messages.length,
      elementsCreated: canvasState?.length || 0,
      learningProgress: learningProgress || {
        currentChunk: 0,
        totalChunks: 5,
        completionPercentage: 0,
      },
      canvasState: canvasState || [],
      updatedAt: new Date(),
    };

    const existingSession = await sessionsCollection.findOne({
      userId: session.user.id,
      sessionId,
    });

    if (existingSession) {
      await sessionsCollection.updateOne(
        { userId: session.user.id, sessionId },
        { $set: sessionUpdate }
      );
    } else {
      await sessionsCollection.insertOne({
        ...sessionUpdate,
        startedAt: new Date(),
      } as Omit<LearningSession, '_id'>);
    }

    return NextResponse.json({
      message: 'Chat data saved successfully',
      messagesCount: chatMessages.length,
    });

  } catch (error) {
    console.error('Error saving chat data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}