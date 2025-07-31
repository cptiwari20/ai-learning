// src/app/api/ws/route.ts
import { NextRequest } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { broadcastDrawing } from '@/app/api/draw/ws/route';

// Simple WebSocket endpoint for Next.js
export async function GET(request: NextRequest) {
  // Check if this is a WebSocket upgrade request
  const upgrade = request.headers.get('upgrade');
  const connection = request.headers.get('connection');
  
  if (upgrade?.toLowerCase() === 'websocket' && connection?.toLowerCase().includes('upgrade')) {
    return new Response('WebSocket upgrade not supported via Next.js API routes. Use standalone WebSocket server on port 8080.', {
      status: 426,
      headers: {
        'Upgrade': 'websocket'
      }
    });
  }
  
  return new Response('WebSocket endpoint - upgrade required', {
    status: 400,
    headers: {
      'Content-Type': 'text/plain'
    }
  });
}