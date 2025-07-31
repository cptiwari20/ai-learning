'use client';
import { useState, useRef, useCallback } from 'react';
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, ExcalidrawElement } from '@excalidraw/excalidraw/types/types';

import "@excalidraw/excalidraw/index.css";

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function DrawPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15));
  const excalidrawRef = useRef<ExcalidrawImperativeAPI>(null);

  const addMessage = useCallback((type: 'user' | 'assistant', content: string) => {
    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 15),
      type,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    addMessage('user', userMessage);
    setIsLoading(true);

    try {
      const response = await fetch('/api/draw/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let assistantMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'message' && data.content) {
                assistantMessage += data.content;
                // Update the last assistant message or create a new one
                setMessages(prev => {
                  const lastMessage = prev[prev.length - 1];
                  if (lastMessage && lastMessage.type === 'assistant') {
                    return [
                      ...prev.slice(0, -1),
                      { ...lastMessage, content: assistantMessage }
                    ];
                  } else {
                    return [...prev, {
                      id: Math.random().toString(36).substring(2, 15),
                      type: 'assistant' as const,
                      content: assistantMessage,
                      timestamp: new Date()
                    }];
                  }
                });
              } else if (data.type === 'drawing' && data.elements) {
                // Update Excalidraw with new elements
                if (excalidrawRef.current) {
                  const currentElements = excalidrawRef.current.getSceneElements();
                  // Filter out any elements that might cause conflicts
                  const validNewElements = data.elements.filter((el: any) => 
                    el && el.id && el.type && typeof el.x === 'number' && typeof el.y === 'number'
                  );
                  
                  if (validNewElements.length > 0) {
                    const newElements = [...currentElements, ...validNewElements];
                    excalidrawRef.current.updateScene({ 
                      elements: newElements,
                      appState: {
                        viewBackgroundColor: '#ffffff'
                      }
                    });
                    
                    // Auto-fit the view to show all elements
                    setTimeout(() => {
                      if (excalidrawRef.current) {
                        excalidrawRef.current.scrollToContent(newElements, {
                          fitToContent: true,
                          animate: true
                        });
                      }
                    }, 100);
                  }
                }
                
                if (data.message) {
                  assistantMessage += '\n' + data.message;
                  setMessages(prev => {
                    const lastMessage = prev[prev.length - 1];
                    if (lastMessage && lastMessage.type === 'assistant') {
                      return [
                        ...prev.slice(0, -1),
                        { ...lastMessage, content: assistantMessage }
                      ];
                    } else {
                      return [...prev, {
                        id: Math.random().toString(36).substring(2, 15),
                        type: 'assistant' as const,
                        content: assistantMessage,
                        timestamp: new Date()
                      }];
                    }
                  });
                }
              } else if (data.type === 'error') {
                addMessage('assistant', data.content || 'An error occurred');
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, sessionId, addMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  return (
    <div className="flex h-screen">
      {/* Chat Panel */}
      <div className="w-1/3 bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Drawing Assistant</h2>
          <p className="text-sm text-gray-600">Ask me to draw shapes, diagrams, or illustrations!</p>
          <div className="mt-3 text-xs text-gray-500">
            <p className="font-medium mb-1">Try these commands:</p>
            <ul className="space-y-1 text-xs">
              <li>• "Draw a flowchart for user registration"</li>
              <li>• "Create a mind map about AI concepts"</li>
              <li>• "Draw a rectangle and circle"</li>
              <li>• "Create a system architecture diagram"</li>
            </ul>
          </div>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <p>Start a conversation to generate drawings!</p>
              <p className="text-sm mt-2">Try: "Draw a flowchart for a login process"</p>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs mt-1 opacity-70">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 text-gray-800 p-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe what you want to draw..."
              className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
      
      {/* Drawing Panel */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-800">Interactive Drawing Canvas</h1>
          <button
            onClick={() => {
              if (excalidrawRef.current) {
                excalidrawRef.current.updateScene({ elements: [] });
                addMessage('assistant', 'Canvas cleared! Ready for new drawings.');
              }
            }}
            className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
          >
            Clear Canvas
          </button>
        </div>
        <div className="flex-1">
          <Excalidraw
            ref={excalidrawRef}
            initialData={{
              elements: [],
              appState: {
                viewBackgroundColor: '#ffffff'
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}