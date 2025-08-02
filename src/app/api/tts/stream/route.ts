import { NextRequest } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'alloy', speed = 1.0 } = await request.json();

    if (!text || typeof text !== 'string') {
      return Response.json({ error: 'Text is required' }, { status: 400 });
    }

    if (text.length > 4096) {
      return Response.json({ error: 'Text too long (max 4096 characters)' }, { status: 400 });
    }

    console.log('🔊 Streaming TTS request:', { 
      textLength: text.length, 
      voice, 
      speed,
      preview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    });

    // Call OpenAI TTS API (OpenAI doesn't support true streaming, but we can return faster)
    const mp3 = await openai.audio.speech.create({
      model: "tts-1", // Use faster model for quicker generation
      voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
      input: text,
      speed: speed,
    });

    console.log('✅ TTS generated');

    // Convert to buffer and create a streaming response
    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    // Create a streaming response to start playback faster
    const stream = new ReadableStream({
      start(controller) {
        // Send the audio in chunks for better perceived performance
        const chunkSize = 1024 * 8; // 8KB chunks
        let offset = 0;
        
        const sendChunk = () => {
          if (offset >= buffer.length) {
            controller.close();
            console.log('✅ TTS streaming completed');
            return;
          }
          
          const chunk = buffer.slice(offset, offset + chunkSize);
          controller.enqueue(chunk);
          offset += chunkSize;
          
          // Send next chunk immediately (no delay for audio)
          setTimeout(sendChunk, 0);
        };
        
        sendChunk();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('❌ TTS Streaming Error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('rate_limit')) {
        return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
      }
      if (error.message.includes('invalid_api_key')) {
        return Response.json({ error: 'Invalid API key configuration' }, { status: 401 });
      }
    }

    return Response.json(
      { error: 'Failed to generate speech stream' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}