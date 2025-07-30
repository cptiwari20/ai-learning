"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";

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
}

export default function ExcalidrawCanvas({ 
  isEnabled, 
  onDrawingUpdate, 
  initialElements = [] 
}: ExcalidrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [elements, setElements] = useState<DrawingElement[]>(initialElements);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);

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
  }, [isReady, elements]);

  // Draw all elements on canvas
  const drawAllElements = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    elements.forEach(element => {
      drawElement(ctx, element);
    });
  }, [elements]);

  // Draw a single element
  const drawElement = useCallback((ctx: CanvasRenderingContext2D, element: DrawingElement) => {
    ctx.strokeStyle = element.color;
    ctx.fillStyle = element.color;
    ctx.lineWidth = element.size;

    switch (element.type) {
      case 'draw_text':
        if (element.text) {
          ctx.font = `${element.size * 8}px Arial`;
          ctx.fillText(element.text, element.position.x, element.position.y);
        }
        break;

      case 'draw_rectangle':
        const width = element.width || 100;
        const height = element.height || 60;
        ctx.strokeRect(element.position.x, element.position.y, width, height);
        break;

      case 'draw_circle':
        const radius = element.size * 10;
        ctx.beginPath();
        ctx.arc(element.position.x, element.position.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;

      case 'draw_line':
        if (element.endPosition) {
          ctx.beginPath();
          ctx.moveTo(element.position.x, element.position.y);
          ctx.lineTo(element.endPosition.x, element.endPosition.y);
          ctx.stroke();
        }
        break;

      case 'clear_canvas':
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        break;
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

    // Redraw with current element
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawAllElements(ctx);
      drawElement(ctx, updatedElement);
    }
  }, [isEnabled, isDrawing, currentElement, drawAllElements, drawElement]);

  const handleMouseUp = useCallback(() => {
    if (!isEnabled || !currentElement) return;

    setElements(prev => [...prev, currentElement]);
    setCurrentElement(null);
    setIsDrawing(false);

    if (onDrawingUpdate) {
      onDrawingUpdate([...elements, currentElement]);
    }
  }, [isEnabled, currentElement, elements, onDrawingUpdate]);

  // Update elements when initialElements change
  useEffect(() => {
    setElements(initialElements);
  }, [initialElements]);

  if (!isEnabled) {
    return (
      <div className="w-full h-full bg-gray-50 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
        <div className="text-center">
          <div className="text-gray-500 text-lg mb-2">Excalidraw Disabled</div>
          <div className="text-gray-400 text-sm">Enable drawing mode to see visual responses</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full border rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onLoad={() => setIsReady(true)}
      />
    </div>
  );
} 