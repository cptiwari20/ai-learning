'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import type { ExcalidrawImperativeAPI, ExcalidrawElement } from '@excalidraw/excalidraw/types/types';
import { Excalidraw } from '@excalidraw/excalidraw';
import "@excalidraw/excalidraw/index.css";

interface WSMessage {
  type: 'drawing' | 'clear' | 'update' | 'sync' | 'connect' | 'disconnect';
  elements?: ExcalidrawElement[];
  message?: string;
  clientId?: string;
  timestamp?: number;
}

interface ExcalidrawWebSocketCanvasProps {
  onMessage?: (message: string) => void;
  className?: string;
}

// Browser storage utilities
const STORAGE_KEY = 'excalidraw-canvas-state';
const SESSION_KEY = 'excalidraw-session-id';

const saveToStorage = (elements: ExcalidrawElement[]) => {
  try {
    const data = {
      elements,
      timestamp: Date.now(),
      version: '1.0'
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
};

const loadFromStorage = (): ExcalidrawElement[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Check if data is recent (within 7 days)
      if (data.timestamp && Date.now() - data.timestamp < 7 * 24 * 60 * 60 * 1000) {
        return data.elements || [];
      }
    }
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
  }
  return [];
};

const getOrCreateSessionId = (): string => {
  try {
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    return sessionId;
  } catch (error) {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
};

export default function ExcalidrawWebSocketCanvas({ onMessage, className }: ExcalidrawWebSocketCanvasProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const pendingDrawingMessages = useRef<WSMessage[]>([]);
  const [persistentSessionId] = useState(getOrCreateSessionId);
  
  // WebSocket state
  const wsRef = useRef<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [clientId, setClientId] = useState<string>('');

  // Function to handle drawing messages - processes them if Excalidraw API is available, otherwise queues them
  const handleDrawingMessage = useCallback((message: WSMessage) => {
    if (!excalidrawAPI) {
      pendingDrawingMessages.current.push(message);
      return;
    }
    
    switch (message.type) {
      case 'sync':
      case 'drawing':
        if (message.elements) {
          console.log('🔍 Raw elements received:', message.elements.length);
          console.log('🔍 First element structure:', JSON.stringify(message.elements[0], null, 2));
          
          // Validate and clean elements for Excalidraw
          const validElements = message.elements.filter(el => {
            const isValid = el && el.id && el.type && typeof el.x === 'number' && typeof el.y === 'number';
            if (!isValid) {
              console.log('❌ Invalid element filtered out:', {
                hasElement: !!el,
                hasId: !!el?.id,
                hasType: !!el?.type,
                xType: typeof el?.x,
                yType: typeof el?.y,
                element: el
              });
            }
            return isValid;
          });
          
          if (validElements.length > 0) {
            try {
              console.log('📝 About to update scene with elements:', validElements.length);
              console.log('📝 First element sample:', JSON.stringify(validElements[0], null, 2));
              console.log('📝 ExcalidrawAPI available:', !!excalidrawAPI);
              console.log('📝 ExcalidrawAPI methods:', excalidrawAPI ? Object.keys(excalidrawAPI) : []);
              
              // Replace all elements with new drawing from backend using API
              excalidrawAPI.updateScene({ 
                elements: validElements,
                appState: {
                  viewBackgroundColor: '#ffffff'
                }
              });
              
              // Save to localStorage for persistence
              saveToStorage(validElements as ExcalidrawElement[]);
              
              console.log('✅ Scene updated successfully');
              
              // Verify the update worked
              setTimeout(() => {
                if (excalidrawAPI) {
                  const currentElements = excalidrawAPI.getSceneElements();
                  console.log('🔍 Current scene elements after update:', currentElements.length);
                }
              }, 100);
              
              // Auto-fit the view to show all elements
              setTimeout(() => {
                if (excalidrawAPI && validElements.length > 0) {
                  try {
                    excalidrawAPI.scrollToContent(validElements, {
                      fitToContent: true,
                      animate: true
                    });
                  } catch (error) {
                    console.warn('Failed to auto-fit view:', error);
                  }
                }
              }, 1000);
            } catch (error) {
              console.error('Failed to update Excalidraw scene:', error);
            }
          }
        }
        
        if (message.message && onMessage) {
          onMessage(`🎨 ${message.message}`);
        }
        break;
        
      case 'update':
        if (message.elements && excalidrawAPI) {
          const currentElements = excalidrawAPI.getSceneElements();
          const validNewElements = message.elements.filter(el => 
            el && el.id && el.type && typeof el.x === 'number' && typeof el.y === 'number'
          );
          const newElements = [...currentElements, ...validNewElements];
          
          excalidrawAPI.updateScene({ 
            elements: newElements,
            appState: {
              viewBackgroundColor: '#ffffff'
            }
          });
          
          if (message.message && onMessage) {
            onMessage(`🎨 ${message.message}`);
          }
        }
        break;
        
      case 'clear':
        if (excalidrawAPI) {
          excalidrawAPI.updateScene({ elements: [] });
          if (message.message && onMessage) {
            onMessage(`🧹 ${message.message}`);
          }
        }
        break;
    }
  }, [excalidrawAPI, onMessage]);

  // Load persisted data when Excalidraw API becomes available
  useEffect(() => {
    if (excalidrawAPI) {
      // Load persisted data from localStorage
      const persistedElements = loadFromStorage();
      if (persistedElements.length > 0) {
        console.log('🔄 Loading persisted elements:', persistedElements.length);
        excalidrawAPI.updateScene({ 
          elements: persistedElements,
          appState: {
            viewBackgroundColor: '#ffffff'
          }
        });
        
        if (onMessage) {
          onMessage(`🔄 Restored ${persistedElements.length} elements from previous session`);
        }
      }
      
      // Process any pending messages
      if (pendingDrawingMessages.current.length > 0) {
        const messages = [...pendingDrawingMessages.current];
        pendingDrawingMessages.current = [];
        
        messages.forEach(message => handleDrawingMessage(message));
      }
    }
  }, [excalidrawAPI, handleDrawingMessage, onMessage]);

  // Initialize WebSocket connection - run only once
  useEffect(() => {
    const connectWebSocket = async () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }
      
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      setWsStatus('connecting');
      
      try {
        // First, ensure the WebSocket server is initialized by calling the API
        try {
          await fetch('/api/draw/ws');
        } catch (error) {
          console.warn('Failed to initialize WebSocket server:', error);
        }
        
        // Wait a moment for server to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try multiple WebSocket connection strategies
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        
        // Use standalone WebSocket server on port 8080
        const wsUrl = `${protocol}//localhost:8080`;
        
        // Test if WebSocket is supported
        if (typeof WebSocket === 'undefined') {
          console.error('WebSocket not supported in this browser');
          setWsStatus('error');
          return;
        }
        
        wsRef.current = new WebSocket(wsUrl);
        
        // Set a timeout for connection
        const connectionTimeout = setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CONNECTING) {
            wsRef.current.close();
            setWsStatus('error');
          }
        }, 5000); // 5 second timeout
        
        wsRef.current.onopen = () => {
          clearTimeout(connectionTimeout);
          setWsStatus('connected');
        };
        
        wsRef.current.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            
            // Handle message using the new handleDrawingMessage function
            switch (message.type) {
              case 'connect':
                if (message.clientId) {
                  setClientId(message.clientId);
                }
                break;
                
              case 'sync':
              case 'drawing':
                handleDrawingMessage(message);
                break;
              case 'update':
                handleDrawingMessage(message);
                break;
              case 'clear':
                handleDrawingMessage(message);
                break;
                
              case 'disconnect':
                break;
                
              default:
                break;
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        wsRef.current.onclose = (event) => {
          setWsStatus('disconnected');
          
          // Only attempt to reconnect if it wasn't a clean close
          if (event.code !== 1000) {
            setTimeout(() => {
              connectWebSocket();
            }, 3000);
          }
        };
        
        wsRef.current.onerror = (error) => {
          setWsStatus('error');
          console.error('WebSocket error:', error);
        };
        
      } catch (error) {
        setWsStatus('error');
        console.error('Failed to connect to WebSocket:', error);
      }
    };
    
    // Initial connection
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [handleDrawingMessage]);

  // Public methods for external control
  const clearCanvas = useCallback(async () => {
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
      if (excalidrawAPI) {
        excalidrawAPI.updateScene({ elements: [] });
        if (onMessage) {
          onMessage('🧹 Canvas cleared locally!');
        }
      }
    }
  }, [excalidrawAPI, onMessage]);

  const addTestElement = useCallback(() => {
    console.log('🧪 Test element function called');
    console.log('🧪 ExcalidrawAPI available:', !!excalidrawAPI);
    
    if (excalidrawAPI) {
      console.log('🧪 Creating test element...');
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
        customData: null,
        roundness: null
      };
      
      console.log('🧪 Test element created:', testElement);
      
      const currentElements = excalidrawAPI.getSceneElements();
      console.log('🧪 Current elements before adding test:', currentElements.length);
      
      excalidrawAPI.updateScene({ 
        elements: [...currentElements, testElement]
      });
      
      console.log('🧪 updateScene called with test element');
      
      // Verify the element was added
      setTimeout(() => {
        const newElements = excalidrawAPI.getSceneElements();
        console.log('🧪 Elements count after test:', newElements.length);
      }, 100);
      
      if (onMessage) {
        onMessage('🧪 Added test rectangle directly to canvas');
      }
    } else {
      console.error('🧪 ExcalidrawAPI not available for test');
    }
  }, [excalidrawAPI, onMessage]);

  const testWebSocket = useCallback(async () => {
    console.log('📡 Testing WebSocket functionality...');
    try {
      const testElement = {
        id: `ws-test-${Date.now()}`,
        type: 'ellipse',
        x: Math.random() * 300 + 100,
        y: Math.random() * 200 + 100,
        width: 120,
        height: 120,
        strokeColor: '#0066ff',
        backgroundColor: '#e6f3ff',
        fillStyle: 'solid',
        strokeWidth: 2,
        strokeStyle: 'solid',
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
        customData: null
      };
      
      console.log('📡 Sending test element:', testElement);
      
      const response = await fetch('/api/draw/ws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'broadcast',
          elements: [testElement],
          message: 'WebSocket test element'
        })
      });
      
      const result = await response.json();
      
      if (result.success && onMessage) {
        onMessage('📡 Sent test element via WebSocket');
      } else if (onMessage) {
        onMessage('❌ WebSocket test failed');
      }
    } catch (error) {
      console.error('WebSocket test error:', error);
      if (onMessage) {
        onMessage('❌ WebSocket test error');
      }
    }
  }, [onMessage]);

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      {/* WebSocket Status Bar */}
      <div className="p-2 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-2 text-xs">
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
        
        <div className="flex gap-2">
          <button
            onClick={clearCanvas}
            className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs"
          >
            🧹 Clear
          </button>
          
          <button
            onClick={addTestElement}
            className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs"
          >
            🧪 Test
          </button>
          
          <button
            onClick={testWebSocket}
            className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs"
          >
            📡 WS Test
          </button>
          
          {(wsStatus === 'disconnected' || wsStatus === 'error') && (
            <button
              onClick={() => window.location.reload()}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs"
            >
              🔄 Reconnect
            </button>
          )}
        </div>
      </div>
      
      {/* Excalidraw Canvas */}
      <div className="flex-1">
        <Excalidraw excalidrawAPI={(api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api)} />
      </div>
    </div>
  );
}