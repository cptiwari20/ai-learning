"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";

// WebSocket message interface
interface WSMessage {
  type: 'drawing' | 'clear' | 'update' | 'sync' | 'connect' | 'disconnect';
  data?: unknown;
  elements?: ExcalidrawElement[];
  message?: string;
  clientId?: string;
  timestamp?: number;
}

// Excalidraw element interface (compatible with actual Excalidraw)
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
  strokeWidth?: number;
  fontSize?: number;
  [key: string]: unknown;
}

// Legacy interface for backward compatibility
interface DrawingElement {
  id: string;
  type: string;
  text?: string;
  position: { x: number; y: number };
  color: string;
  size: number;
  timestamp: number;
  width?: number;
  height?: number;
  endPosition?: { x: number; y: number };
}

interface ExcalidrawCanvasProps {
  isEnabled: boolean;
  onDrawingUpdate?: (elements: DrawingElement[]) => void;
  initialElements?: DrawingElement[];
  enableWebSocket?: boolean;
  wsEndpoint?: string;
}

export default function ExcalidrawCanvas({ 
  isEnabled, 
  onDrawingUpdate, 
  initialElements = [],
  enableWebSocket = true,
  wsEndpoint = 'ws://localhost:8080'
}: ExcalidrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [elements, setElements] = useState<ExcalidrawElement[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [clientId, setClientId] = useState<string>('');

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((message: WSMessage) => {
    console.log('Received WebSocket message:', message.type);
    
    switch (message.type) {
      case 'connect':
        if (message.clientId) {
          setClientId(message.clientId);
        }
        break;
        
      case 'sync':
      case 'drawing':
        if (message.elements) {
          setElements(message.elements);
        }
        break;
        
      case 'update':
        if (message.elements) {
          setElements(prev => [...prev, ...message.elements]);
        }
        break;
        
      case 'clear':
        setElements([]);
        break;
        
      case 'disconnect':
        console.log('Client disconnected:', message.clientId);
        break;
        
      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }, []);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }
    
    setWsStatus('connecting');
    
    try {
      wsRef.current = new WebSocket(wsEndpoint);
      
      wsRef.current.onopen = () => {
        setWsStatus('connected');
        console.log('Connected to Excalidraw WebSocket');
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      wsRef.current.onclose = () => {
        setWsStatus('disconnected');
        console.log('Disconnected from Excalidraw WebSocket');
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (enableWebSocket && isEnabled) {
            connectWebSocket();
          }
        }, 3000);
      };
      
      wsRef.current.onerror = (error) => {
        setWsStatus('error');
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      setWsStatus('error');
      console.error('Failed to connect to WebSocket:', error);
    }
  }, [wsEndpoint, enableWebSocket, isEnabled, handleWebSocketMessage]);

  // WebSocket connection setup
  useEffect(() => {
    if (enableWebSocket && isEnabled) {
      connectWebSocket();
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [enableWebSocket, isEnabled, connectWebSocket]);


  // Initialize canvas
  useEffect(() => {
    if (canvasRef.current && isReady) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Set canvas size
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        // Clear and draw background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw all elements
        drawAllElements(ctx);
      }
    }
  }, [isReady, elements, drawAllElements]);

  // Draw all elements on canvas
  const drawAllElements = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    elements.forEach(element => {
      drawExcalidrawElement(ctx, element);
    });
  }, [elements, drawExcalidrawElement]);

  // Draw Excalidraw element
  const drawExcalidrawElement = useCallback((ctx: CanvasRenderingContext2D, element: ExcalidrawElement) => {
    ctx.strokeStyle = element.strokeColor || '#000000';
    ctx.fillStyle = element.backgroundColor || 'transparent';
    ctx.lineWidth = element.strokeWidth || 2;

    switch (element.type) {
      case 'rectangle':
        const rectWidth = element.width || 100;
        const rectHeight = element.height || 100;
        
        // Fill if background color is set
        if (element.backgroundColor && element.backgroundColor !== 'transparent') {
          ctx.fillRect(element.x, element.y, rectWidth, rectHeight);
        }
        
        // Draw stroke
        ctx.strokeRect(element.x, element.y, rectWidth, rectHeight);
        break;

      case 'ellipse':
        const ellipseWidth = element.width || 100;
        const ellipseHeight = element.height || 100;
        const centerX = element.x + ellipseWidth / 2;
        const centerY = element.y + ellipseHeight / 2;
        
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, ellipseWidth / 2, ellipseHeight / 2, 0, 0, 2 * Math.PI);
        
        if (element.backgroundColor && element.backgroundColor !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'diamond':
        const diamondWidth = element.width || 100;
        const diamondHeight = element.height || 100;
        const dCenterX = element.x + diamondWidth / 2;
        const dCenterY = element.y + diamondHeight / 2;
        
        ctx.beginPath();
        ctx.moveTo(dCenterX, element.y); // Top
        ctx.lineTo(element.x + diamondWidth, dCenterY); // Right
        ctx.lineTo(dCenterX, element.y + diamondHeight); // Bottom
        ctx.lineTo(element.x, dCenterY); // Left
        ctx.closePath();
        
        if (element.backgroundColor && element.backgroundColor !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'line':
      case 'arrow':
        if (element.points && element.points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(element.x + element.points[0][0], element.y + element.points[0][1]);
          
          for (let i = 1; i < element.points.length; i++) {
            ctx.lineTo(element.x + element.points[i][0], element.y + element.points[i][1]);
          }
          
          ctx.stroke();
          
          // Draw arrow head for arrows
          if (element.type === 'arrow' && element.points.length >= 2) {
            const lastPoint = element.points[element.points.length - 1];
            const secondLastPoint = element.points[element.points.length - 2];
            
            const endX = element.x + lastPoint[0];
            const endY = element.y + lastPoint[1];
            const startX = element.x + secondLastPoint[0];
            const startY = element.y + secondLastPoint[1];
            
            // Calculate arrow head
            const angle = Math.atan2(endY - startY, endX - startX);
            const arrowLength = 15;
            const arrowAngle = Math.PI / 6;
            
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(
              endX - arrowLength * Math.cos(angle - arrowAngle),
              endY - arrowLength * Math.sin(angle - arrowAngle)
            );
            ctx.moveTo(endX, endY);
            ctx.lineTo(
              endX - arrowLength * Math.cos(angle + arrowAngle),
              endY - arrowLength * Math.sin(angle + arrowAngle)
            );
            ctx.stroke();
          }
        }
        break;

      case 'text':
        if (element.text) {
          const fontSize = element.fontSize || 16;
          ctx.font = `${fontSize}px Arial`;
          ctx.fillStyle = element.strokeColor || '#000000';
          ctx.fillText(element.text, element.x, element.y + fontSize);
        }
        break;

      case 'freedraw':
        if (element.points && element.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(element.x + element.points[0][0], element.y + element.points[0][1]);
          
          for (let i = 1; i < element.points.length; i++) {
            ctx.lineTo(element.x + element.points[i][0], element.y + element.points[i][1]);
          }
          
          ctx.stroke();
        }
        break;

      default:
        console.warn('Unknown element type:', element.type);
    }
  }, []);

  // Handle mouse events for drawing
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEnabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newElement: DrawingElement = {
      id: `drawing-${Date.now()}`,
      type: 'draw_line',
      position: { x, y },
      color: '#1f2937',
      size: 2,
      timestamp: Date.now()
    };

    setCurrentElement(newElement);
    setIsDrawing(true);
  }, [isEnabled]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEnabled || !isDrawing || !currentElement) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const updatedElement = {
      ...currentElement,
      endPosition: { x, y }
    };

    setCurrentElement(updatedElement);

    // Redraw with current element (simplified for now)
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawAllElements(ctx);
      // Could add current element drawing here if needed
    }
  }, [isEnabled, isDrawing, currentElement, drawAllElements]);

  const handleMouseUp = useCallback(() => {
    if (!isEnabled || !currentElement) return;

    setElements(prev => [...prev, currentElement]);
    setCurrentElement(null);
    setIsDrawing(false);

    if (onDrawingUpdate) {
      onDrawingUpdate([...elements, currentElement]);
    }
  }, [isEnabled, currentElement, elements, onDrawingUpdate]);

  // Update elements when initialElements change (convert legacy format if needed)
  useEffect(() => {
    // For now, we'll just set empty array since we're using ExcalidrawElement format
    // In a real implementation, you'd convert DrawingElement to ExcalidrawElement
    if (initialElements.length > 0) {
      console.log('Converting legacy elements not implemented yet');
    }
  }, [initialElements]);

  if (!isEnabled) {
    return (
      <div className="w-full h-full bg-gray-50 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
        <div className="text-center">
          <div className="text-gray-500 text-lg mb-2">Excalidraw Disabled</div>
          <div className="text-gray-400 text-sm">Enable drawing mode to see visual responses from LangGraph</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full border rounded-lg overflow-hidden">
      {/* WebSocket Status Bar */}
      {enableWebSocket && (
        <div className="bg-gray-100 px-3 py-1 text-xs border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              wsStatus === 'connected' ? 'bg-green-500' : 
              wsStatus === 'connecting' ? 'bg-yellow-500' : 
              wsStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
            }`}></div>
            <span className="text-gray-600">
              WebSocket: {wsStatus}
              {clientId && ` (${clientId.substring(0, 8)}...)`}
            </span>
          </div>
          <div className="text-gray-500">
            Elements: {elements.length}
          </div>
        </div>
      )}
      
      {/* Canvas */}
      <div className="relative w-full h-full">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onLoad={() => setIsReady(true)}
        />
        
        {/* Loading overlay */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-gray-500">Loading canvas...</div>
          </div>
        )}
        
        {/* WebSocket connection status */}
        {enableWebSocket && wsStatus === 'connecting' && (
          <div className="absolute top-4 right-4 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-md text-sm">
            Connecting to WebSocket...
          </div>
        )}
        
        {enableWebSocket && wsStatus === 'error' && (
          <div className="absolute top-4 right-4 bg-red-100 text-red-800 px-3 py-1 rounded-md text-sm">
            WebSocket connection failed
          </div>
        )}
      </div>
    </div>
  );
} 