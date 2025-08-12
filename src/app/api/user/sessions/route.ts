import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { MongoClient } from 'mongodb';
import { COLLECTIONS, type LearningSession, type ChatMessage } from '@/lib/auth/user.models';

const client = new MongoClient(process.env.MONGODB_URI!);

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    await client.connect();
    
    // Get learning sessions
    const sessionsCollection = client.db().collection<LearningSession>(COLLECTIONS.LEARNING_SESSIONS);
    const sessions = await sessionsCollection
      .find({ userId: session.user.id })
      .sort({ startedAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // Get total count
    const totalSessions = await sessionsCollection.countDocuments({ 
      userId: session.user.id 
    });

    // Get recent messages for each session (first few)
    const sessionsWithMessages = await Promise.all(
      sessions.map(async (sessionData) => {
        const messagesCollection = client.db().collection<ChatMessage>(COLLECTIONS.CHAT_MESSAGES);
        const messages = await messagesCollection
          .find({ 
            userId: session.user.id, 
            sessionId: sessionData.sessionId 
          })
          .sort({ timestamp: 1 })
          .limit(5)
          .toArray();

        return {
          ...sessionData,
          recentMessages: messages,
        };
      })
    );

    return NextResponse.json({
      sessions: sessionsWithMessages,
      totalSessions,
      hasMore: offset + limit < totalSessions,
    });

  } catch (error) {
    console.error('Error fetching user sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}

// Create a new learning session
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId, topic } = await request.json();

    if (!sessionId || !topic) {
      return NextResponse.json(
        { error: 'Session ID and topic are required' },
        { status: 400 }
      );
    }

    await client.connect();
    const sessionsCollection = client.db().collection<LearningSession>(COLLECTIONS.LEARNING_SESSIONS);

    const newSession: Omit<LearningSession, '_id'> = {
      userId: session.user.id,
      sessionId,
      topic,
      startedAt: new Date(),
      totalMessages: 0,
      elementsCreated: 0,
      learningProgress: {
        currentChunk: 0,
        totalChunks: 5,
        completionPercentage: 0,
      },
    };

    const result = await sessionsCollection.insertOne(newSession);

    return NextResponse.json({
      sessionId: result.insertedId,
      message: 'Session created successfully',
    });

  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}