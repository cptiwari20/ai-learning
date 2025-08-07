'use client';
import React, { useState, useCallback } from 'react';
import { useConversationMode, ConversationMode } from '@/hooks/useConversationMode';

interface ConversationInterfaceProps {
  onMessage: (message: string) => Promise<void> | void;
  onResponse?: (response: string, isComplete: boolean) => void;
  className?: string;
}

export default function ConversationInterface({ 
  onMessage, 
  onResponse, 
  className = '' 
}: ConversationInterfaceProps) {
  const [selectedMode, setSelectedMode] = useState<ConversationMode>('text');

  const conversation = useConversationMode(onMessage, onResponse, {
    autoSubmitDelay: 1200, // Shorter delay for more responsive conversation
    minPhraseLength: 3,
    voiceSettings: {
      voice: 'fable',
      speed: 0.95, // Slightly faster for natural conversation
    }
  });

  const handleModeToggle = useCallback((mode: ConversationMode) => {
    if (conversation.isActive) {
      conversation.stop();
    }
    setSelectedMode(mode);
  }, [conversation]);

  const handleStart = useCallback(() => {
    if (selectedMode === 'voice') {
      conversation.startVoiceMode();
    } else {
      conversation.startTextMode(true); // Text mode with voice input
    }
  }, [selectedMode, conversation]);

  const getModeIcon = (mode: ConversationMode) => {
    if (mode === 'voice') {
      return conversation.isActive && conversation.mode === 'voice' ? '🎙️' : '🎤';
    } else {
      return conversation.isActive && conversation.mode === 'text' ? '💬' : '📝';
    }
  };

  const getModeDescription = (mode: ConversationMode) => {
    if (mode === 'voice') {
      return 'Voice Mode - Talk naturally like to a human';
    } else {
      return 'Text Mode - Type or speak to input text';
    }
  };

  const getStatusText = () => {
    if (!conversation.isSupported) return 'Voice not supported';
    if (conversation.error) return 'Error occurred';
    if (conversation.isProcessing) return 'Processing...';
    
    if (conversation.isActive) {
      if (conversation.mode === 'voice') {
        if (conversation.isSpeaking) return 'AI is speaking...';
        if (conversation.isListening && conversation.currentTranscript) return 'You said...';
        if (conversation.isListening) return 'Listening...';
        return 'Voice chat active';
      } else {
        if (conversation.isListening && conversation.currentTranscript) return 'Voice input ready';
        if (conversation.isListening) return 'Ready for voice input';
        return 'Text mode active';
      }
    }
    
    return 'Choose a mode to start';
  };

  const getButtonColor = (mode: ConversationMode) => {
    const isSelected = selectedMode === mode;
    const isActive = conversation.isActive && conversation.mode === mode;
    
    if (isActive) {
      if (conversation.isSpeaking) return 'bg-green-100 text-green-700 border-green-300';
      if (conversation.isListening) return 'bg-blue-100 text-blue-700 border-blue-300';
      return 'bg-purple-100 text-purple-700 border-purple-300';
    }
    
    if (isSelected) return 'bg-gray-200 text-gray-800 border-gray-400';
    return 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100';
  };

  const getMainButtonColor = () => {
    if (!conversation.isSupported) return 'bg-gray-100 text-gray-400';
    if (conversation.error) return 'bg-red-100 text-red-600';
    if (conversation.isActive) {
      if (conversation.isSpeaking) return 'bg-green-100 text-green-700';
      return 'bg-blue-100 text-blue-700';
    }
    return 'bg-blue-500 text-white hover:bg-blue-600';
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Mode Selection */}
      <div className="flex gap-2">
        <button
          onClick={() => handleModeToggle('voice')}
          disabled={conversation.isActive}
          className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border transition-colors ${getButtonColor('voice')}`}
        >
          <span className="text-xl">{getModeIcon('voice')}</span>
          <div className="text-left">
            <div>Voice Mode</div>
            <div className="text-xs opacity-75">Natural conversation</div>
          </div>
        </button>
        
        <button
          onClick={() => handleModeToggle('text')}
          disabled={conversation.isActive}
          className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border transition-colors ${getButtonColor('text')}`}
        >
          <span className="text-xl">{getModeIcon('text')}</span>
          <div className="text-left">
            <div>Text Mode</div>
            <div className="text-xs opacity-75">Type or voice input</div>
          </div>
        </button>
      </div>

      {/* Main Control Button */}
      <button
        onClick={conversation.isActive ? conversation.stop : handleStart}
        disabled={!conversation.isSupported || conversation.isProcessing}
        className={`flex items-center justify-center gap-3 px-6 py-4 rounded-lg text-lg font-medium transition-colors ${getMainButtonColor()}`}
      >
        <span className="text-2xl">
          {conversation.isActive ? '🛑' : selectedMode === 'voice' ? '🎙️' : '💬'}
        </span>
        <div className="text-left">
          <div>{conversation.isActive ? 'Stop' : 'Start'} {selectedMode === 'voice' ? 'Voice Chat' : 'Text Chat'}</div>
          <div className="text-sm opacity-75">{getStatusText()}</div>
        </div>

        {/* Activity indicators */}
        {conversation.isActive && (
          <div className="flex items-center gap-1">
            {conversation.ttsQueueLength > 0 && (
              <div className="flex items-center gap-1 text-sm">
                <span>🎵</span>
                <span>{conversation.ttsQueueLength}</span>
              </div>
            )}
            {conversation.isListening && (
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 h-4 rounded-full transition-all ${
                      conversation.isSpeaking
                        ? 'bg-green-500 animate-pulse'
                        : 'bg-blue-500 animate-bounce'
                    }`}
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </button>

      {/* Current Transcript Display */}
      {conversation.isActive && conversation.currentTranscript && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium mb-2">
            {conversation.mode === 'voice' ? 'You said:' : 'Voice input:'}
          </div>
          <div className="text-blue-800">
            {conversation.currentTranscript}
            {conversation.isListening && (
              <span className="inline-block w-2 h-4 bg-blue-600 ml-1 animate-pulse" />
            )}
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-blue-600">
              Confidence: {Math.round(conversation.confidence * 100)}%
            </div>
            {conversation.mode === 'text' && conversation.currentTranscript.trim().length >= 3 && (
              <button
                onClick={conversation.submitCurrentTranscript}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Send
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mode Description */}
      {!conversation.isActive && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-700">
            <div className="font-medium mb-2">{getModeDescription(selectedMode)}</div>
            <div className="text-xs text-gray-600 space-y-1">
              {selectedMode === 'voice' ? (
                <>
                  <div>• Speak naturally and I&apos;ll respond with voice</div>
                  <div>• Automatic speech detection and response</div>
                  <div>• Minimal latency for real-time conversation</div>
                  <div>• Say &quot;stop&quot; or click button to end</div>
                </>
              ) : (
                <>
                  <div>• Type messages or use voice to dictate</div>
                  <div>• Manual send control</div>
                  <div>• Best for detailed responses</div>
                  <div>• Voice input helps with longer texts</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {conversation.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-sm text-red-600">
            <div className="font-medium">Error:</div>
            <div>{conversation.error}</div>
          </div>
        </div>
      )}

      {/* Voice Mode Instructions */}
      {conversation.isActive && conversation.mode === 'voice' && !conversation.currentTranscript && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-sm text-green-700">
            <div className="font-medium mb-1">🎙️ Voice Mode Active</div>
            <div className="text-xs">
              Start speaking - I&apos;ll listen and respond naturally. The conversation flows like talking to a human.
            </div>
          </div>
        </div>
      )}

      {/* Browser Support Warning */}
      {!conversation.isSupported && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm text-yellow-800">
            <div className="font-medium mb-2">⚠️ Voice features not available</div>
            <div className="text-xs space-y-1">
              <div>• Chrome/Edge: Enable microphone permissions</div>
              <div>• Safari: Enable speech recognition in settings</div>
              <div>• Use HTTPS or localhost for voice features</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}