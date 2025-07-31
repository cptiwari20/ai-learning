"use client"
import React, { useState, useRef, useEffect } from "react";
import ExcalidrawCanvas from "@/components/ExcalidrawCanvas";

interface Message {
  role: "user" | "ai" | string;
  content: string;
}

interface DrawingInstruction {
  type: string;
  tool: string;
  args: Record<string, unknown>;
}

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

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [enableDrawing, setEnableDrawing] = useState(false);
  const [drawingInstructions, setDrawingInstructions] = useState<DrawingInstruction[]>([]);
  const [currentDrawingElements, setCurrentDrawingElements] = useState<DrawingElement[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setDrawingInstructions([]);

    try {
      const response = await fetch("/api/agents/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessionId: "demo", 
          messages: newMessages,
          enableDrawing 
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case "start":
                    console.log("Stream started");
                    break;
                    
                  case "drawing":
                    if (enableDrawing) {
                      setDrawingInstructions(prev => [...prev, data]);
                      // Apply drawing instruction to canvas
                      applyDrawingInstruction(data);
                    }
                    break;
                    
                  case "messages":
                    // Add AI messages with streaming effect
                    for (const msg of data.messages) {
                      setMessages((prev) => {
                        if (prev.some((m) => m.content === msg.content && m.role === "ai")) return prev;
                        return [...prev, { role: "ai", content: msg.content }];
                      });
                      await new Promise((r) => setTimeout(r, 200));
                    }
                    break;
                    
                  case "end":
                    console.log("Stream ended");
                    break;
                    
                  case "error":
                    setMessages((prev) => [...prev, { role: "ai", content: "Error: " + data.error }]);
                    break;
                }
              } catch (e) {
                console.error("Error parsing SSE data:", e);
              }
            }
          }
        }
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "ai", content: "Error: " + (e as Error).message }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const applyDrawingInstruction = (instruction: DrawingInstruction) => {
    const { tool, args } = instruction;
    
    if (tool === "excalidraw_drawing") {
      const { action, text, position, color, size } = args;
      
      // Create a new drawing element based on the action
      const newElement: DrawingElement = {
        id: `drawing-${Date.now()}`,
        type: action as string,
        text: text as string || "",
        position: position as { x: number; y: number } || { x: 100, y: 100 },
        color: color as string || "#1f2937",
        size: size as number || 2,
        timestamp: Date.now()
      };
      
      setCurrentDrawingElements(prev => [...prev, newElement]);
    }
  };

  const handleDrawingUpdate = (elements: DrawingElement[]) => {
    setCurrentDrawingElements(elements);
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-8 bg-gray-50">
      <div className="w-full max-w-6xl bg-white rounded shadow p-4 flex flex-col gap-4">
        {/* Header with Drawing Toggle */}
        <div className="flex items-center justify-between mb-4 border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-800">Visual Learning AI</h1>
          <div className="flex items-center gap-4">
            <a
              href="/draw"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Try New Drawing Page
            </a>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableDrawing}
                onChange={(e) => setEnableDrawing(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Enable Drawing Mode</span>
            </label>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-4 h-[600px]">
          {/* Chat Section */}
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex-1 min-h-[400px] max-h-[500px] overflow-y-auto border rounded p-2 bg-gray-100">
              {messages.length === 0 && <div className="text-gray-400">Start the conversation...</div>}
              {messages.map((msg, i) => (
                <div key={i} className={`mb-2 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                  <span className={`inline-block px-3 py-2 rounded ${msg.role === "user" ? "bg-blue-200" : "bg-green-100"}`}>
                    <b>{msg.role === "user" ? "You" : "AI"}:</b> {msg.content}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <input
                ref={inputRef}
                className="flex-1 border rounded px-3 py-2"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                placeholder="Type your message..."
                disabled={loading}
              />
              <button
                className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
                onClick={handleSend}
                disabled={loading || !input.trim()}
              >
                {loading ? "..." : "Send"}
              </button>
            </div>
          </div>

          {/* Drawing Section */}
          <div className="flex-1">
            <ExcalidrawCanvas
              isEnabled={enableDrawing}
              onDrawingUpdate={handleDrawingUpdate}
              initialElements={currentDrawingElements}
            />
          </div>
        </div>

        {/* Drawing Instructions Debug */}
        {enableDrawing && drawingInstructions.length > 0 && (
          <div className="mt-4 p-2 bg-gray-100 rounded">
            <h3 className="text-sm font-medium mb-2">Drawing Instructions:</h3>
            <div className="text-xs space-y-1">
              {drawingInstructions.map((instruction, index) => (
                <div key={index} className="text-gray-600">
                  {instruction.tool}: {JSON.stringify(instruction.args)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
