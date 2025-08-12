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

    // Use tts-1 (faster) for real-time conversation, tts-1-hd for quality
    const model = text.length > 200 ? "tts-1-hd" : "tts-1";
    
    console.log('🎵 Generating TTS with model:', model);
    
    // Call OpenAI TTS API with optimizations
    const mp3 = await openai.audio.speech.create({
      model: model,
      voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
      input: text,
      speed: speed,
      response_format: "mp3", // MP3 is faster to generate than other formats
    });

    console.log('✅ TTS generated');

    // Convert to buffer and create an optimized streaming response
    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    // Create a streaming response optimized for real-time playback
    const stream = new ReadableStream({
      start(controller) {
        // Use smaller chunks to start playback faster
        const chunkSize = 1024; // 1KB chunks for minimal initial latency
        let offset = 0;
        
        const sendChunk = () => {
          if (offset >= buffer.length) {
            controller.close();
            console.log('✅ TTS streaming completed:', buffer.length, 'bytes');
            return;
          }
          
          const remainingBytes = buffer.length - offset;
          const currentChunkSize = Math.min(chunkSize, remainingBytes);
          const chunk = buffer.slice(offset, offset + currentChunkSize);
          
          controller.enqueue(chunk);
          offset += currentChunkSize;
          
          // Send chunks as fast as possible for lowest latency
          setImmediate(sendChunk);
        };
        
        // Start immediately
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