'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import ExcalidrawWebSocketCanvas from '@/components/ExcalidrawWebSocketCanvas';
import GlobalAudioControls from '@/components/GlobalAudioControls';
import { useAgentTTS } from '@/hooks/useAgentTTS';
import { useUserSession } from '@/hooks/useUserSession';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Get or create persistent session ID
const getSessionId = () => {
  if (typeof window !== 'undefined') {
    let sessionId = sessionStorage.getItem('draw-session-id');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('draw-session-id', sessionId);
    }
    return sessionId;
  }
  return Math.random().toString(36).substring(2, 15);
};

// Load chat messages from localStorage
const loadMessages = (): ChatMessage[] => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('draw-chat-messages');
      if (stored) {
        const data = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        return data.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load chat messages:', error);
    }
  }
  return [];
};

// Save chat messages to localStorage
const saveMessages = (messages: ChatMessage[]) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('draw-chat-messages', JSON.stringify(messages));
    } catch (error) {
      console.warn('Failed to save chat messages:', error);
    }
  }
};

export default function DrawPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [autoTTS, setAutoTTS] = useState(false);
  
  // Use RAG-enabled user session
  const { userId, sessionId, isLoading: sessionLoading, startNewSession, clearUserData } = useUserSession();
  
  // Refs for auto-scroll and input focus
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // TTS for learning assistant
  const { speakAsLearningAssistant, speakEducationalResponse, startLearningSession, clearSpeech } = useAgentTTS();

  // Auto-scroll to bottom when messages update
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Focus input after each interaction
  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const addMessage = useCallback((type: 'user' | 'assistant', content: string) => {
    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 15),
      type,
      content,
      timestamp: new Date()
    };
    setMessages(prev => {
      const updated = [...prev, newMessage];
      saveMessages(updated);
      return updated;
    });
    
    // Auto-scroll after adding message
    setTimeout(scrollToBottom, 100);
  }, [scrollToBottom]);

  const [currentCanvasElements, setCurrentCanvasElements] = useState<unknown[]>([]);
  
  const handleDrawingMessage = useCallback((message: string) => {
    addMessage('assistant', message);
  }, [addMessage]);

  const handleCanvasStateUpdate = useCallback((elements: unknown[]) => {
    console.log('📋 Canvas state updated:', elements.length, 'elements');
    setCurrentCanvasElements(elements);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    
    // Clear any ongoing TTS when user sends new message
    clearSpeech();
    
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
          sessionId,
          currentCanvasElements: currentCanvasElements || []
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
                
                // Speak educational response if auto-TTS is enabled
                if (autoTTS && assistantMessage.length > 20) {
                  speakEducationalResponse(assistantMessage);
                }
                
                // Update the last assistant message or create a new one
                setMessages(prev => {
                  const lastMessage = prev[prev.length - 1];
                  let updated;
                  if (lastMessage && lastMessage.type === 'assistant') {
                    updated = [
                      ...prev.slice(0, -1),
                      { ...lastMessage, content: assistantMessage }
                    ];
                  } else {
                    updated = [...prev, {
                      id: Math.random().toString(36).substring(2, 15),
                      type: 'assistant' as const,
                      content: assistantMessage,
                      timestamp: new Date()
                    }];
                  }
                  saveMessages(updated);
                  return updated;
                });
              } else if (data.type === 'drawing' && data.elements) {
                // Drawing event received - add to chat and trigger drawing
                console.log('🎨 Drawing event received:', data.elements?.length, 'elements');
                setIsDrawing(true);
                
                // Speak learning assistant narration if auto-TTS is enabled
                if (autoTTS) {
                  speakAsLearningAssistant(data);
                }
                
                // Skip adding technical drawing messages to chat
                // User wants to focus on learning content, not drawing updates
                
                // Important: Directly broadcast to WebSocket for immediate drawing
                if (data.elements && data.elements.length > 0) {
                  console.log('🚀 Broadcasting drawing elements directly to WebSocket');
                  
                  // Use 'add' action to append elements instead of replacing
                  fetch('/api/draw/ws', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'add', // Changed from 'broadcast' to 'add' for incremental updates
                      elements: data.elements,
                      message: data.message || 'Drawing updated'
                    })
                  }).then(response => response.json())
                    .then(result => {
                      console.log('✅ WebSocket broadcast result:', result);
                      setIsDrawing(false);
                      // Don't add drawing messages to chat - user doesn't want to see technical updates
                    })
                    .catch(error => {
                      console.error('❌ WebSocket broadcast failed:', error);
                      setIsDrawing(false);
                      // Don't add error messages to chat - handle silently
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
      focusInput(); // Re-focus input after completion
    }
  }, [inputValue, isLoading, sessionId, addMessage, clearSpeech, autoTTS, speakEducationalResponse, speakAsLearningAssistant]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Focus input on component mount and when loading changes
  useEffect(() => {
    if (!isLoading) {
      focusInput();
    }
  }, [isLoading, focusInput]);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    <div className="flex h-screen">
      {/* Chat Panel */}
      <div className="w-1/3 bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-800">🎓 Visual Learning Assistant</h2>
          </div>
          <p className="text-sm text-gray-600">I'll teach you concepts through interactive visual diagrams!</p>
          
          <div className="mt-3 text-xs text-gray-500">
            <p className="font-medium mb-1">Learning topics to explore:</p>
            <ul className="space-y-1 text-xs">
              <li>• "Explain how photosynthesis works"</li>
              <li>• "Show me the software development process"</li>
              <li>• "How does machine learning work?"</li>
              <li>• "Teach me about database relationships"</li>
            </ul>
          </div>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <div className="text-4xl mb-3">🎓</div>
              <p className="font-medium">Ready to learn together!</p>
              <p className="text-sm mt-2">Ask me to explain any concept and I'll teach you through visual diagrams.</p>
              <p className="text-xs mt-3 text-blue-600">💡 Tip: Enable "Learning mode" for voice explanation!</p>
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
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                  {/* Individual message TTS removed - using centralized audio controls */}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 text-gray-800 p-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <span className="text-sm text-gray-600 ml-2">
                    {isDrawing ? 'Rendering drawing...' : 'Processing request...'}
                  </span>
                </div>
              </div>
            </div>
          )}
          {!isLoading && isDrawing && (
            <div className="flex justify-start">
              <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm">🎨 Drawing appearing on canvas...</span>
                </div>
              </div>
            </div>
          )}
          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Global Audio Controls */}
        <GlobalAudioControls 
          isLearningMode={autoTTS}
          onLearningModeToggle={setAutoTTS}
        />
        
        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex space-x-2 mb-2">
            <button
              onClick={async () => {
                try {
                  // First clear the backend/WebSocket state
                  const response = await fetch('/api/draw/ws', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'clear',
                      elements: [],
                      message: 'Canvas cleared from chat'
                    })
                  });
                  
                  if (response.ok) {
                    console.log('✅ Canvas cleared via WebSocket');
                  }
                } catch (error) {
                  console.error('❌ Failed to clear canvas via WebSocket:', error);
                }
                
                // Clear frontend state
                setMessages([]);
                saveMessages([]);
                setCurrentCanvasElements([]);
                
                // Clear RAG user data and create new session
                clearUserData();
                
                // Clear all localStorage
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('excalidraw-canvas-state');
                  localStorage.removeItem('draw-chat-messages');
                }
                
                console.log('🧹 All data cleared including RAG context');
              }}
              className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
            >
              🧹 Clear All
            </button>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span>User: {userId.substring(0, 8)}...</span>
              <span>Session: {sessionId.substring(0, 8)}...</span>
              <button
                onClick={() => startNewSession()}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs"
                title="Start new learning session"
              >
                🆕 New Session
              </button>
            </div>
          </div>
          <div className="flex space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe what you want to draw..."
              className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
              autoFocus
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading || sessionLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sessionLoading ? 'Initializing...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Drawing Panel */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-800">Interactive Drawing Canvas</h1>
        </div>
        <div className="flex-1">
          <ExcalidrawWebSocketCanvas 
            onMessage={handleDrawingMessage}
            onCanvasStateUpdate={handleCanvasStateUpdate}
          />
        </div>
      </div>
    </div>
  );
}