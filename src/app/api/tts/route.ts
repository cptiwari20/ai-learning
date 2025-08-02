import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'alloy', speed = 1.0 } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (text.length > 4096) {
      return NextResponse.json({ error: 'Text too long (max 4096 characters)' }, { status: 400 });
    }

    console.log('🔊 TTS request:', { 
      textLength: text.length, 
      voice, 
      speed,
      preview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    });

    // Call OpenAI TTS API
    const mp3 = await openai.audio.speech.create({
      model: "tts-1", // Use tts-1 for faster generation, tts-1-hd for higher quality
      voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
      input: text,
      speed: speed,
    });

    // Convert the response to a buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());

    console.log('✅ TTS generated successfully:', { audioSize: buffer.length });

    // Return the audio as a response
    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('❌ TTS Error:', error);
    
    if (error instanceof Error) {
      // Handle specific OpenAI errors
      if (error.message.includes('rate_limit')) {
        return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
      }
      if (error.message.includes('invalid_api_key')) {
        return NextResponse.json({ error: 'Invalid API key configuration' }, { status: 401 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate speech' },
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