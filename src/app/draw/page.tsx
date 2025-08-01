'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import type { ExcalidrawImperativeAPI, ExcalidrawElement } from '@excalidraw/excalidraw/types/types';
import ExcalidrawCanvas from '@/components/ExcalidrawCanvas';

import "@excalidraw/excalidraw/index.css";

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface WSMessage {
  type: 'drawing' | 'clear' | 'update' | 'sync' | 'connect' | 'disconnect';
  elements?: ExcalidrawElement[];
  message?: string;
  clientId?: string;
  timestamp?: number;
}

export default function DrawPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15));
  const excalidrawRef = useRef<ExcalidrawImperativeAPI>(null);
  const [excalidrawReady, setExcalidrawReady] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const pendingDrawingMessages = useRef<WSMessage[]>([]);
  
  // WebSocket state
  const wsRef = useRef<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [clientId, setClientId] = useState<string>('');

  // Set client-side rendering flag
  useEffect(() => {
    console.log('🖥️ Setting client-side flag');
    setIsClient(true);
  }, []);

  // Function to handle drawing messages - processes them if Excalidraw is ready, otherwise queues them
  const handleDrawingMessage = useCallback((message: WSMessage) => {
    console.log('🎨 Handling drawing message:', message.type);
    console.log('🎨 Excalidraw ready:', excalidrawReady);
    console.log('🎨 Excalidraw ref exists:', !!excalidrawRef.current);
    
    if (!excalidrawReady || !excalidrawRef.current) {
      console.log('⏳ Excalidraw not ready, queuing message');
      pendingDrawingMessages.current.push(message);
      return;
    }
    
    switch (message.type) {
      case 'sync':
      case 'drawing':
        if (message.elements) {
          console.log('🎨 Processing drawing elements:', message.elements.length);
          
          // Validate and clean elements for Excalidraw
          const validElements = message.elements.filter(el => {
            const isValid = el && el.id && el.type && typeof el.x === 'number' && typeof el.y === 'number';
            if (!isValid) {
              console.warn('❌ Invalid element filtered out:', el);
            }
            return isValid;
          });
          
          if (validElements.length > 0) {
            console.log('✅ Updating Excalidraw with', validElements.length, 'valid elements');
            
            try {
              // Replace all elements with new drawing from backend
              excalidrawRef.current.updateScene({ 
                elements: validElements,
                appState: {
                  viewBackgroundColor: '#ffffff'
                }
              });
              console.log('✅ Excalidraw scene updated successfully');
              
              // Auto-fit the view to show all elements
              setTimeout(() => {
                if (excalidrawRef.current && validElements.length > 0) {
                  try {
                    excalidrawRef.current.scrollToContent(validElements, {
                      fitToContent: true,
                      animate: true
                    });
                    console.log('📐 Auto-fitted view to content');
                  } catch (error) {
                    console.warn('Failed to auto-fit view:', error);
                  }
                }
              }, 500);
            } catch (error) {
              console.error('❌ Failed to update Excalidraw scene:', error);
            }
          }
        }
        
        if (message.message) {
          setMessages(prev => [...prev, {
            id: Math.random().toString(36).substring(2, 15),
            type: 'assistant' as const,
            content: `🎨 ${message.message}`,
            timestamp: new Date()
          }]);
        }
        break;
        
      case 'update':
        if (message.elements && excalidrawRef.current) {
          console.log('➕ Adding elements to existing drawing');
          const currentElements = excalidrawRef.current.getSceneElements();
          const validNewElements = message.elements.filter(el => 
            el && el.id && el.type && typeof el.x === 'number' && typeof el.y === 'number'
          );
          const newElements = [...currentElements, ...validNewElements];
          
          excalidrawRef.current.updateScene({ 
            elements: newElements,
            appState: {
              viewBackgroundColor: '#ffffff'
            }
          });
          
          if (message.message) {
            setMessages(prev => [...prev, {
              id: Math.random().toString(36).substring(2, 15),
              type: 'assistant' as const,
              content: `🎨 ${message.message}`,
              timestamp: new Date()
            }]);
          }
        }
        break;
        
      case 'clear':
        if (excalidrawRef.current) {
          console.log('🧹 Clearing canvas');
          excalidrawRef.current.updateScene({ elements: [] });
          if (message.message) {
            setMessages(prev => [...prev, {
              id: Math.random().toString(36).substring(2, 15),
              type: 'assistant' as const,
              content: `🧹 ${message.message}`,
              timestamp: new Date()
            }]);
          }
        }
        break;
    }
  }, [excalidrawReady]);

  // Fallback mechanism to detect when Excalidraw is ready
  useEffect(() => {
    if (!excalidrawReady) {
      const checkExcalidrawReady = () => {
        console.log('🔍 Checking Excalidraw readiness:', {
          hasRef: !!excalidrawRef.current,
          hasUpdateScene: excalidrawRef.current && typeof excalidrawRef.current.updateScene === 'function',
          hasGetSceneElements: excalidrawRef.current && typeof excalidrawRef.current.getSceneElements === 'function'
        });
        
        if (excalidrawRef.current && 
            typeof excalidrawRef.current.updateScene === 'function' &&
            typeof excalidrawRef.current.getSceneElements === 'function') {
          console.log('🎯 Excalidraw detected as ready via fallback mechanism!');
          setExcalidrawReady(true);
          return true;
        }
        return false;
      };

      // Check immediately
      if (checkExcalidrawReady()) return;

      // Poll every 1000ms for up to 15 seconds (give more time for dynamic import)
      const interval = setInterval(() => {
        if (checkExcalidrawReady()) {
          clearInterval(interval);
        }
      }, 1000);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        console.warn('⏰ Excalidraw ready timeout - checking final state');
        console.warn('Final ref state:', {
          hasRef: !!excalidrawRef.current,
          refMethods: excalidrawRef.current ? Object.keys(excalidrawRef.current) : []
        });
        
        // Only force ready if ref actually exists
        if (excalidrawRef.current) {
          console.warn('🔧 Forcing ready state despite timeout');
          setExcalidrawReady(true);
        } else {
          console.error('❌ Excalidraw ref never became available');
        }
      }, 15000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [excalidrawReady]);

  // Process pending messages when Excalidraw becomes ready
  useEffect(() => {
    if (excalidrawReady && excalidrawRef.current && pendingDrawingMessages.current.length > 0) {
      console.log('🚀 Processing', pendingDrawingMessages.current.length, 'pending drawing messages');
      const messages = [...pendingDrawingMessages.current];
      pendingDrawingMessages.current = [];
      
      messages.forEach(message => handleDrawingMessage(message));
    }
  }, [excalidrawReady, handleDrawingMessage]);

  // Initialize WebSocket connection - run only once
  useEffect(() => {
    console.log('🚀 Initializing WebSocket connection...');
    
    const connectWebSocket = async () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('⚠️ WebSocket already connected, skipping');
        return;
      }
      
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      setWsStatus('connecting');
      
      try {
        // First, ensure the WebSocket server is initialized by calling the API
        console.log('🔧 Initializing WebSocket server...');
        try {
          const initResponse = await fetch('/api/draw/ws');
          const initResult = await initResponse.json();
          console.log('📡 WebSocket server status:', initResult);
        } catch (error) {
          console.warn('⚠️ Failed to initialize WebSocket server:', error);
        }
        
        // Wait a moment for server to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try multiple WebSocket connection strategies
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        
        // Use standalone WebSocket server on port 8080
        const wsUrl = `${protocol}//localhost:8080`;
        
        // Alternative same-origin connection (doesn't work with Next.js API routes)
        // const wsUrl = `${protocol}//${window.location.host}/api/ws`;
        
        console.log('🔌 Creating WebSocket connection to', wsUrl);
        console.log('Current page details:', {
          protocol: window.location.protocol,
          host: window.location.host,
          hostname: window.location.hostname,
          port: window.location.port,
          origin: window.location.origin
        });
        
        // Test if WebSocket is supported
        if (typeof WebSocket === 'undefined') {
          console.error('❌ WebSocket not supported in this browser');
          setWsStatus('error');
          return;
        }
        
        console.log('✅ WebSocket is supported, attempting connection...');
        
        wsRef.current = new WebSocket(wsUrl);
        
        // Set a timeout for connection
        const connectionTimeout = setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CONNECTING) {
            console.log('⏰ WebSocket connection timeout');
            wsRef.current.close();
            setWsStatus('error');
          }
        }, 5000); // 5 second timeout
        
        wsRef.current.onopen = () => {
          clearTimeout(connectionTimeout);
          setWsStatus('connected');
          console.log('✅ Connected to Excalidraw WebSocket');
          console.log('WebSocket readyState:', wsRef.current?.readyState);
          console.log('WebSocket URL:', wsRef.current?.url);
        };
        
        wsRef.current.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            console.log('📨 Raw WebSocket message received:', message);
            console.log('📨 Message type:', message.type);
            console.log('📨 Elements count:', message.elements?.length || 0);
            console.log('📨 Excalidraw ref exists:', !!excalidrawRef.current);
            
            // Handle message using the new handleDrawingMessage function
            switch (message.type) {
              case 'connect':
                if (message.clientId) {
                  setClientId(message.clientId);
                  console.log('🔗 Connected with client ID:', message.clientId);
                }
                break;
                
              case 'sync':
              case 'drawing':
              case 'update':
              case 'clear':
                handleDrawingMessage(message);
                break;
                
              case 'disconnect':
                console.log('👋 Client disconnected:', message.clientId);
                break;
                
              default:
                console.log('❓ Unknown message type:', message.type);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        wsRef.current.onclose = (event) => {
          console.log('🔌 WebSocket closed:', event.code, event.reason);
          console.log('Close event details:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            type: event.type
          });
          setWsStatus('disconnected');
          
          // Only attempt to reconnect if it wasn't a clean close
          if (event.code !== 1000) {
            console.log('🔄 Attempting to reconnect in 3 seconds...');
            setTimeout(() => {
              connectWebSocket();
            }, 3000);
          }
        };
        
        wsRef.current.onerror = (error) => {
          setWsStatus('error');
          console.error('❌ WebSocket error:', error);
          console.error('WebSocket error details:', {
            readyState: wsRef.current?.readyState,
            url: wsRef.current?.url,
            error: error,
            errorType: typeof error,
            errorMessage: error.message || 'No error message'
          });
          
          // Try to get more detailed error info
          if (wsRef.current) {
            console.error('WebSocket state details:', {
              readyState: wsRef.current.readyState,
              url: wsRef.current.url,
              protocol: wsRef.current.protocol,
              extensions: wsRef.current.extensions
            });
          }
        };
        
      } catch (error) {
        setWsStatus('error');
        console.error('❌ Failed to connect to WebSocket:', error);
      }
    };
    
    // Initial connection
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        console.log('🔌 Cleaning up WebSocket connection');
        wsRef.current.close(1000, 'Component unmounting'); // Clean close
      }
    };
  }, [handleDrawingMessage]); // Include handleDrawingMessage dependency

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
              console.log({data})
              
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
                // if (data.elements && excalidrawRef.current) {
                //   console.log('🎨 Processing drawing elements:', data.elements.length);
                  
                //   // Validate and clean elements for Excalidraw
                //   const validElements = data.elements.filter(el => {
                //     const isValid = el && el.id && el.type && typeof el.x === 'number' && typeof el.y === 'number';
                //     if (!isValid) {
                //       console.warn('❌ Invalid element filtered out:', el);
                //     }
                //     return isValid;
                //   });
                  
                //   if (validElements.length > 0) {
                //     console.log('✅ Updating Excalidraw with', validElements.length, 'valid elements');
                    
                //     // Replace all elements with new drawing from backend
                //     excalidrawRef.current.updateScene({ 
                //       elements: validElements,
                //       appState: {
                //         viewBackgroundColor: '#ffffff'
                //       }
                //     });
                    
                //     // Auto-fit the view to show all elements
                //     setTimeout(() => {
                //       if (excalidrawRef.current && validElements.length > 0) {
                //         try {
                //           excalidrawRef.current.scrollToContent(validElements, {
                //             fitToContent: true,
                //             animate: true
                //           });
                //           console.log('📐 Auto-fitted view to content');
                //         } catch (error) {
                //           console.warn('Failed to auto-fit view:', error);
                //         }
                //       }
                //     }, 500);
                //   }
                  
                //   if (data.message) {
                //     setMessages(prev => [...prev, {
                //       id: Math.random().toString(36).substring(2, 15),
                //       type: 'assistant' as const,
                //       content: `🎨 ${data.message}`,
                //       timestamp: new Date()
                //     }]);
                //   }
                // }
                // Drawing handled via WebSocket, just add message to chat
                if (data.message) {
                  assistantMessage += '\n🎨 ' + data.message;
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
          
          {/* WebSocket Status */}
          <div className="mt-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                wsStatus === 'connected' ? 'bg-green-500' : 
                wsStatus === 'connecting' ? 'bg-yellow-500' : 
                wsStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
              }`}></div>
              <span className="text-gray-500">
                Real-time: {wsStatus}
                {clientId && ` (${clientId.substring(0, 8)}...)`}
              </span>
            </div>
            
            {(wsStatus === 'disconnected' || wsStatus === 'error') && (
              <button
                onClick={() => {
                  console.log('🔄 Manual reconnect triggered');
                  // Force reconnection by reloading the page or triggering reconnect
                  window.location.reload();
                }}
                className="px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs hover:bg-blue-200"
              >
                🔄 Reconnect
              </button>
            )}
          </div>
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
          <div className="flex gap-2">
            <button
              onClick={async () => {
                // Clear via WebSocket API so all clients get updated
                try {
                  await fetch('/api/draw/ws', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'clear',
                      message: 'Canvas cleared by user'
                    })
                  });
                } catch (error) {
                  console.error('Failed to clear canvas:', error);
                  // Fallback to local clear
                  if (excalidrawRef.current) {
                    excalidrawRef.current.updateScene({ elements: [] });
                    addMessage('assistant', '🧹 Canvas cleared locally!');
                  }
                }
              }}
              className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
            >
              🧹 Clear Canvas
            </button>
            
            <button
              onClick={() => {
                // Test adding elements directly to Excalidraw
                if (excalidrawRef.current) {
                  const testElement = {
                    id: `test-${Date.now()}`,
                    type: 'rectangle' as const,
                    x: Math.random() * 300 + 50,
                    y: Math.random() * 200 + 50,
                    width: 100,
                    height: 80,
                    strokeColor: '#00ff00',
                    backgroundColor: 'transparent',
                    fillStyle: 'solid' as const,
                    strokeWidth: 2,
                    strokeStyle: 'solid' as const,
                    roughness: 1,
                    opacity: 100,
                    angle: 0,
                    seed: Math.floor(Math.random() * 1000000),
                    version: 1,
                    versionNonce: Math.floor(Math.random() * 1000000),
                    isDeleted: false,
                    boundElements: null,
                    updated: Date.now(),
                    link: null,
                    locked: false,
                    groupIds: [],
                    frameId: null,
                    index: 'test',
                    customData: null,
                    roundness: null
                  };
                  
                  const currentElements = excalidrawRef.current.getSceneElements();
                  excalidrawRef.current.updateScene({ 
                    elements: [...currentElements, testElement]
                  });
                  
                  console.log('🧪 Added test element directly to Excalidraw');
                  addMessage('assistant', '🧪 Added test rectangle directly to canvas');
                }
              }}
              className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
            >
              🧪 Test Element
            </button>
            
            <button
              onClick={async () => {
                // Test WebSocket broadcast
                try {
                  const response = await fetch('/api/draw/ws', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'broadcast',
                      elements: [{
                        id: `ws-test-${Date.now()}`,
                        type: 'ellipse',
                        x: Math.random() * 300 + 100,
                        y: Math.random() * 200 + 100,
                        width: 120,
                        height: 120,
                        strokeColor: '#0066ff',
                        backgroundColor: '#e6f3ff'
                      }],
                      message: 'WebSocket test element'
                    })
                  });
                  
                  const result = await response.json();
                  console.log('📡 WebSocket test result:', result);
                  
                  if (result.success) {
                    addMessage('assistant', '📡 Sent test element via WebSocket');
                  } else {
                    addMessage('assistant', '❌ WebSocket test failed');
                  }
                } catch (error) {
                  console.error('WebSocket test error:', error);
                  addMessage('assistant', '❌ WebSocket test error');
                }
              }}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
            >
              📡 Test WebSocket
            </button>
            
            <a
              href="/"
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
            >
              💬 Chat Only
            </a>
          </div>
        </div>
        <div className="flex-1">
          <ExcalidrawCanvas
            ref={excalidrawRef}
            initialData={{
              elements: [],
              appState: {
                viewBackgroundColor: '#ffffff'
              }
            }}
            onMount={(excalidrawAPI, initialData) => {
              console.log('🎯 Excalidraw onMount called from DrawPage!');
              console.log('🎯 ExcalidrawAPI:', !!excalidrawAPI);
              console.log('🎯 Ref current:', !!excalidrawRef.current);
              console.log('🎯 API methods:', excalidrawAPI ? Object.keys(excalidrawAPI) : []);
              
              // Wait a moment for the ref to be properly set
              setTimeout(() => {
                console.log('🎯 Setting Excalidraw ready after mount');
                console.log('🎯 Final ref check:', !!excalidrawRef.current);
                setExcalidrawReady(true);
              }, 100);
            }}
          />
        </div>
      </div>
    </div>
  );
}