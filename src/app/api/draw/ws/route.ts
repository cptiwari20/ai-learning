// src/app/api/draw/ws/route.ts
import { NextRequest } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';

// Define message types for communication
interface WSMessage {
  type: 'drawing' | 'clear' | 'update' | 'sync' | 'connect' | 'disconnect';
  data?: unknown;
  elements?: ExcalidrawElement[];
  message?: string;
  clientId?: string;
  timestamp?: number;
}

interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  strokeColor?: string;
  backgroundColor?: string;
  points?: [number, number][];
  [key: string]: unknown;
}

// Global WebSocket server instance
let wss: WebSocketServer | null = null;
const clients = new Map<string, WebSocket>();

// Store canvas state for new connections
let canvasState: ExcalidrawElement[] = [];

// Initialize WebSocket server
function initializeWSS() {
  if (!wss) {
    wss = new WebSocketServer({ 
      port: 8080,
      perMessageDeflate: false,
      // Allow browser connections
      verifyClient: (info) => {
        console.log('WebSocket connection attempt from:', info.origin);
        return true; // Allow all origins for development
      }
    });

    wss.on('connection', (ws: WebSocket) => {
      const clientId = generateClientId();
      clients.set(clientId, ws);
      
      console.log(`Client ${clientId} connected. Total clients: ${clients.size}`);

      // Send current canvas state to new client
      if (canvasState.length > 0) {
        const syncMessage: WSMessage = {
          type: 'sync',
          elements: canvasState,
          timestamp: Date.now()
        };
        ws.send(JSON.stringify(syncMessage));
      }

      // Send welcome message
      const welcomeMessage: WSMessage = {
        type: 'connect',
        message: 'Connected to Excalidraw WebSocket',
        clientId,
        timestamp: Date.now()
      };
      ws.send(JSON.stringify(welcomeMessage));

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          handleClientMessage(clientId, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        clients.delete(clientId);
        console.log(`Client ${clientId} disconnected. Total clients: ${clients.size}`);
        
        // Notify other clients
        const disconnectMessage: WSMessage = {
          type: 'disconnect',
          clientId,
          message: `Client ${clientId} disconnected`,
          timestamp: Date.now()
        };
        broadcastToOthers(clientId, disconnectMessage);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        clients.delete(clientId);
      });
    });

    wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    console.log('WebSocket server started on port 8080');
  }
}

// Generate unique client ID
function generateClientId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Handle messages from clients
function handleClientMessage(clientId: string, message: WSMessage) {
  console.log(`Received message from ${clientId}:`, message.type);
  
  switch (message.type) {
    case 'drawing':
      if (message.elements) {
        // Update canvas state
        canvasState = message.elements;
        // Broadcast to all other clients
        broadcastToOthers(clientId, {
          type: 'drawing',
          elements: message.elements,
          message: message.message || 'Canvas updated',
          timestamp: Date.now()
        });
      }
      break;
      
    case 'update':
      if (message.elements) {
        // Merge new elements with existing state
        canvasState = [...canvasState, ...message.elements];
        broadcastToOthers(clientId, {
          type: 'update',
          elements: message.elements,
          message: message.message || 'Elements added',
          timestamp: Date.now()
        });
      }
      break;
      
    case 'clear':
      canvasState = [];
      broadcastToOthers(clientId, {
        type: 'clear',
        message: 'Canvas cleared',
        timestamp: Date.now()
      });
      break;
      
    default:
      console.log(`Unknown message type: ${message.type}`);
  }
}

// Broadcast message to all clients except sender
function broadcastToOthers(senderId: string, message: WSMessage) {
  const messageStr = JSON.stringify(message);
  clients.forEach((client, clientId) => {
    if (clientId !== senderId && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// Broadcast to all clients
function broadcastToAll(message: WSMessage) {
  const messageStr = JSON.stringify(message);
  console.log(`📡 Broadcasting to ${clients.size} clients:`, message.type);
  
  let sentCount = 0;
  clients.forEach((client, clientId) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
        sentCount++;
        console.log(`✅ Sent to client ${clientId}`);
      } catch (error) {
        console.error(`❌ Failed to send to client ${clientId}:`, error);
      }
    } else {
      console.log(`⚠️ Client ${clientId} not ready (state: ${client.readyState})`);
    }
  });
  
  console.log(`📡 Broadcast completed: ${sentCount}/${clients.size} clients received message`);
}

// Utility function for LangGraph tool calls to broadcast drawings
export function broadcastDrawing(elements: ExcalidrawElement[], message = 'Drawing updated from LangGraph') {
  console.log('🎯 broadcastDrawing called with:', {
    elementsCount: elements.length,
    message,
    clientsCount: clients.size,
    wssExists: !!wss
  });
  
  if (!wss) {
    console.log('⚠️ WebSocket server not initialized, initializing now...');
    initializeWSS();
  }
  
  // Update canvas state
  canvasState = elements;
  console.log('💾 Updated canvas state with', elements.length, 'elements');
  
  // Broadcast to all connected clients
  const drawingMessage: WSMessage = {
    type: 'drawing',
    elements,
    message,
    timestamp: Date.now()
  };
  
  console.log('📤 About to broadcast drawing message:', drawingMessage.type);
  broadcastToAll(drawingMessage);
  console.log(`✅ Broadcasted ${elements.length} elements to ${clients.size} clients`);
}

// Add elements to canvas (for incremental updates)
export function addDrawingElements(elements: ExcalidrawElement[], message = 'New elements added') {
  if (!wss) {
    initializeWSS();
  }
  
  // Add to canvas state
  canvasState = [...canvasState, ...elements];
  
  // Broadcast update to all clients
  const updateMessage: WSMessage = {
    type: 'update',
    elements,
    message,
    timestamp: Date.now()
  };
  
  broadcastToAll(updateMessage);
  console.log(`Added ${elements.length} new elements to canvas`);
}

// Clear canvas
export function clearCanvas(message = 'Canvas cleared') {
  if (!wss) {
    initializeWSS();
  }
  
  canvasState = [];
  
  const clearMessage: WSMessage = {
    type: 'clear',
    message,
    timestamp: Date.now()
  };
  
  broadcastToAll(clearMessage);
  console.log('Canvas cleared for all clients');
}

// Get current canvas state
export function getCanvasState(): ExcalidrawElement[] {
  return [...canvasState];
}

// HTTP endpoints for REST API access
export async function GET() {
  // Initialize WebSocket server if not already done
  if (!wss) {
    initializeWSS();
  }
  
  return new Response(JSON.stringify({
    status: 'WebSocket server running',
    clients: clients.size,
    elementsCount: canvasState.length,
    endpoint: 'ws://localhost:8080'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, elements, message } = body;
    
    console.log('📡 WebSocket POST request:', { action, elementsCount: elements?.length, message });
    
    if (!wss) {
      initializeWSS();
    }
    
    switch (action) {
      case 'broadcast':
        if (elements) {
          console.log('📤 Broadcasting elements:', elements);
          broadcastDrawing(elements, message);
          return new Response(JSON.stringify({
            success: true,
            message: 'Elements broadcasted successfully',
            elementsCount: elements.length
          }));
        }
        break;
        
      case 'add':
        if (elements) {
          addDrawingElements(elements, message);
          return new Response(JSON.stringify({
            success: true,
            message: 'Elements added successfully',
            elementsCount: elements.length
          }));
        }
        break;
        
      case 'clear':
        clearCanvas(message);
        return new Response(JSON.stringify({
          success: true,
          message: 'Canvas cleared successfully'
        }));
        break;
        
      case 'get_state':
        return new Response(JSON.stringify({
          success: true,
          elements: canvasState,
          elementsCount: canvasState.length
        }));
        
      default:
        return new Response(JSON.stringify({
          success: false,
          message: 'Invalid action'
        }), { status: 400 });
    }
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Missing required parameters'
    }), { status: 400 });
    
  } catch (error) {
    console.error('❌ Error handling POST request:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500 });
  }
}

// Initialize WebSocket server when module loads
initializeWSS();