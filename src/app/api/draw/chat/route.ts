import { NextRequest, NextResponse } from 'next/server';
import { streamDrawingAgent } from '@/lib/drawing/agent';

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    console.log('Drawing API called:', { message, sessionId });

    // Create a readable stream for server-sent events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial start event
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({ type: 'start' }) + '\n\n'));

          // Run the streaming agent
          await streamDrawingAgent(
            message,
            sessionId,
            (data) => {
              console.log('Sending stream data:', data);
              controller.enqueue(
                encoder.encode('data: ' + JSON.stringify(data) + '\n\n')
              );
            }
          );

          // Send completion event
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({ type: 'end' }) + '\n\n'));
        } catch (error) {
          console.error('Error in drawing stream:', error);
          controller.enqueue(
            encoder.encode('data: ' + JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            }) + '\n\n')
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error in drawing API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}