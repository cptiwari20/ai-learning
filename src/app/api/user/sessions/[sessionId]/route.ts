import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { MongoClient } from 'mongodb';
import { COLLECTIONS, type LearningSession, type ChatMessage } from '@/lib/auth/user.models';

const client = new MongoClient(process.env.MONGODB_URI!);

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId } = params;

    await client.connect();
    
    // Get learning session details
    const sessionsCollection = client.db().collection<LearningSession>(COLLECTIONS.LEARNING_SESSIONS);
    const sessionData = await sessionsCollection.findOne({
      sessionId,
      userId: session.user.id,
    });

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Get all messages for this session
    const messagesCollection = client.db().collection<ChatMessage>(COLLECTIONS.CHAT_MESSAGES);
    const messages = await messagesCollection
      .find({ 
        userId: session.user.id, 
        sessionId 
      })
      .sort({ timestamp: 1 })
      .toArray();

    return NextResponse.json({
      session: sessionData,
      messages,
    });

  } catch (error) {
    console.error('Error fetching session details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}

// Update session (for ending session, updating progress, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId } = params;
    const updates = await request.json();

    await client.connect();
    const sessionsCollection = client.db().collection<LearningSession>(COLLECTIONS.LEARNING_SESSIONS);

    const result = await sessionsCollection.updateOne(
      {
        sessionId,
        userId: session.user.id,
      },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Session updated successfully',
    });

  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}