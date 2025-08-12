'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ExcalidrawWebSocketCanvas from '@/components/ExcalidrawWebSocketCanvas';
// import GlobalAudioControls from '@/components/GlobalAudioControls';
// import VoiceInterface from '@/components/VoiceInterface';
import ConversationInterface from '@/components/ConversationInterface';
import LearningSessionControls from '@/components/LearningSessionControls';
import LearningProgressIndicator from '@/components/LearningProgressIndicator';
import { useAgentTTS } from '@/hooks/useAgentTTS';
import Link from 'next/link';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// (removed unused local session util)

// Load chat messages from localStorage
const loadMessages = (): ChatMessage[] => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('draw-chat-messages');
      if (stored) {
        const data = JSON.parse(stored) as ChatMessage[];
        // Convert timestamp strings back to Date objects
        return data.map((msg) => ({
          ...msg,
          timestamp: new Date((msg as unknown as { timestamp: string | number | Date }).timestamp)
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
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [autoTTS] = useState(true);
  const [conversationMode] = useState<'simple' | 'advanced'>('simple');
  const [learningProgress, setLearningProgress] = useState<{
    topic: string;
    currentChunk: number;
    totalChunks: number;
    isActive: boolean;
  }>({ topic: '', currentChunk: 0, totalChunks: 0, isActive: false });
  
  // Generate session ID for authenticated users
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
  
  // Refs for auto-scroll and input focus
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // TTS for learning assistant
  const { speakAsLearningAssistant, streamEducationalResponse, clearSpeech, resetInteractionTimer } = useAgentTTS();
  
  const [currentCanvasElements, setCurrentCanvasElements] = useState<unknown[]>([]);
  // Throttle persisting chat during streaming to avoid jank
  const lastPersistTsRef = useRef<number>(0);

  // Auto-scroll to bottom when messages update
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Save chat data to database periodically
  const saveChatData = useCallback(async () => {
    if (!session?.user?.id || messages.length === 0) return;

    try {
      await fetch('/api/chat/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          messages,
          topic: learningProgress.topic,
          canvasState: currentCanvasElements,
          learningProgress,
        }),
      });
    } catch (error) {
      console.error('Failed to save chat data:', error);
    }
  }, [session?.user?.id, sessionId, messages, learningProgress, currentCanvasElements]);

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

  const handleDrawingMessage = useCallback((message: string) => {
    addMessage('assistant', message);
  }, [addMessage]);

  const handleCanvasStateUpdate = useCallback((elements: unknown[]) => {
    console.log('📋 Canvas state updated:', elements.length, 'elements');
    setCurrentCanvasElements(elements);
  }, []);

  const handleSendMessage = useCallback(async (message?: string) => {
    const userMessage = message || inputValue.trim();
    if (!userMessage || isLoading) return;

    if (!message) {
      setInputValue('');
    }
    
    // Clear any ongoing TTS when user sends new message and reset interaction timer
    clearSpeech();
    resetInteractionTimer(); // Reset interaction prompts when user is active
    
    addMessage('user', userMessage);
    setIsLoading(true);

    let assistantMessage = '';
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
                
                // Use real-time TTS streaming for immediate response
                if (autoTTS) {
                  // Stream only the incremental chunk to avoid re-speaking accumulated text
                  streamEducationalResponse(data.content, false);
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
                  // Persist at most once per second during streaming to keep UI smooth
                  const now = Date.now();
                  if (now - lastPersistTsRef.current > 1000) {
                    saveMessages(updated);
                    lastPersistTsRef.current = now;
                  }
                  return updated;
                });
              } else if (data.type === 'drawing' && data.elements) {
                // Drawing event received - add to chat and trigger drawing
                console.log('🎨 Drawing event received:', data.elements?.length, 'elements');
                setIsDrawing(true);
                
                // Update learning progress if available
                if (data.learningProgress) {
                  setLearningProgress({
                    topic: data.learningProgress.topic || '',
                    currentChunk: data.learningProgress.currentChunk || 0,
                    totalChunks: data.learningProgress.totalChunks || 0,
                    isActive: true
                  });
                }
                
                // Speak learning assistant narration if auto-TTS is enabled
                if (autoTTS) {
                  speakAsLearningAssistant(data);
                }
                
                // Skip adding/broadcasting technical drawing messages from client.
                // The backend already broadcasts via WebSocket; avoid duplicate updates.
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
      
      // Mark streaming as complete for TTS
      if (autoTTS && assistantMessage) {
        streamEducationalResponse(assistantMessage, true);
      }
      
      focusInput(); // Re-focus input after completion
    }
  }, [inputValue, isLoading, sessionId, addMessage, clearSpeech, autoTTS, streamEducationalResponse, speakAsLearningAssistant, currentCanvasElements, focusInput, resetInteractionTimer]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Handle streaming response for conversation interface
  const handleConversationResponse = useCallback((response: string, isComplete: boolean) => {
    if (conversationMode === 'simple') {
      // Update the last assistant message or create new one
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        let updated;
        
        if (lastMessage && lastMessage.type === 'assistant') {
          updated = [
            ...prev.slice(0, -1),
            { ...lastMessage, content: response }
          ];
        } else {
          updated = [...prev, {
            id: Math.random().toString(36).substring(2, 15),
            type: 'assistant' as const,
            content: response,
            timestamp: new Date()
          }];
        }
        
        if (isComplete) {
          saveMessages(updated);
        }
        return updated;
      });
    }
  }, [conversationMode]);

  // Simple conversation handler for real-time voice mode
  const handleConversationMessage = useCallback(async (message: string): Promise<Response | void> => {
    if (!message.trim() || isLoading) return;
    
    console.log('🎙️ Conversation message:', message);
    
    // Clear any ongoing TTS
    clearSpeech();
    
    // Add user message
    addMessage('user', message);
    setIsLoading(true);

    try {
      const response = await fetch('/api/draw/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId,
          currentCanvasElements: currentCanvasElements || [],
          conversationMode: 'voice' // Flag for more conversational responses
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Return response for the conversation hook to handle streaming and TTS
      return response;

    } catch (error) {
      console.error('Conversation error:', error);
      addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, sessionId, addMessage, clearSpeech, currentCanvasElements]);

  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=' + encodeURIComponent('/draw'));
    }
  }, [status, router]);

  // Auto-save chat data every 30 seconds
  useEffect(() => {
    const interval = setInterval(saveChatData, 30000);
    return () => clearInterval(interval);
  }, [saveChatData]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveChatData();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveChatData]);

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

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Not authenticated (will redirect via useEffect)
  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Navigation Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Visual Learning AI
              </h1>
              {learningProgress.isActive && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Learning: {learningProgress.topic}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {session?.user?.name || session?.user?.email}
              </span>
              <Link
                href="/dashboard"
                className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Chat Panel */}
        <div className="w-1/3 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">🎓 Visual Learning</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">Talk or type. I&apos;ll teach while drawing in real time.</p>
          </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <div className="text-4xl mb-3">🎓</div>
              <p className="text-sm">Ask anything. I&apos;ll explain and draw step-by-step.</p>
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
        
        {/* Voice Controls (simple) */}
        <div className="p-3 border-b border-gray-200">
          <ConversationInterface
            onMessage={handleConversationMessage}
            onResponse={handleConversationResponse}
            className="w-full"
          />
        </div>

        {/* Learning Progress */}
        <div className="p-3 border-b border-gray-200">
          <LearningProgressIndicator 
            topic={learningProgress.topic}
            currentChunk={learningProgress.currentChunk}
            totalChunks={learningProgress.totalChunks}
            isActive={learningProgress.isActive}
            className="w-full"
          />
        </div>

        {/* Learning Session Controls */}
        <div className="p-3 border-b border-gray-200">
          <LearningSessionControls className="w-full" />
        </div>
        
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
                
                // Clear learning progress
                setLearningProgress({ topic: '', currentChunk: 0, totalChunks: 0, isActive: false });
                
                // Clear all localStorage
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('excalidraw-canvas-state');
                  localStorage.removeItem('draw-chat-messages');
                }
                
                console.log('🧹 All data cleared');
              }}
              className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
            >
              🧹 Clear All
            </button>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span>User: {session?.user?.id?.substring(0, 8)}...</span>
              <span>Session: {sessionId.substring(0, 8)}...</span>
              <button
                onClick={() => {
                  // Generate new session ID and clear state
                  window.location.reload();
                }}
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
              onClick={() => handleSendMessage()}
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
    </div>
  );
}