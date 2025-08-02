'use client';
import React, { useState } from 'react';
import { useAgentTTS } from '@/hooks/useAgentTTS';

interface GlobalAudioControlsProps {
  isLearningMode: boolean;
  onLearningModeToggle: (enabled: boolean) => void;
}

export default function GlobalAudioControls({ 
  isLearningMode, 
  onLearningModeToggle 
}: GlobalAudioControlsProps) {
  const { isPlaying, isLoading, clearSpeech, testSpeak } = useAgentTTS();
  const [showSettings, setShowSettings] = useState(false);

  const handleGlobalStop = () => {
    clearSpeech();
  };

  const handleToggleMute = () => {
    if (isLearningMode) {
      // Currently unmuted, so mute
      onLearningModeToggle(false);
      clearSpeech();
    } else {
      // Currently muted, so unmute
      onLearningModeToggle(true);
    }
  };

  return (
    <div className="bg-gray-50 border-b border-gray-200 p-3">
      <div className="flex items-center justify-between">
        {/* Left side - Learning mode toggle */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={isLearningMode}
              onChange={(e) => onLearningModeToggle(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="flex items-center gap-1">
              🎙️ Learning Assistant Voice
            </span>
          </label>
          
          {isLearningMode && (
            <div className="text-xs text-gray-500">
              Voice will explain concepts as I teach
            </div>
          )}
        </div>

        {/* Right side - Audio controls */}
        <div className="flex items-center gap-2">
          {/* Audio status indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs">
              <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Generating speech...</span>
            </div>
          )}
          
          {isPlaying && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-lg text-xs">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Speaking</span>
            </div>
          )}

          {/* Control buttons */}
          {(isPlaying || isLoading) && (
            <button
              onClick={handleGlobalStop}
              className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-xs transition-colors"
              title="Stop all speech"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h12v12H6z"/>
              </svg>
              <span>Stop</span>
            </button>
          )}

          {/* Mute/Unmute Toggle Button */}
          <button
            onClick={handleToggleMute}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs transition-colors ${
              isLearningMode 
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={isLearningMode ? "Mute learning assistant" : "Unmute learning assistant"}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              {isLearningMode ? (
                // Volume on icon
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              ) : (
                // Volume off icon  
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              )}
            </svg>
            <span>{isLearningMode ? 'Mute' : 'Unmute'}</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center px-2 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-xs transition-colors"
            title="Audio Settings"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="text-sm font-medium text-gray-700 mb-2">Audio Settings</div>
          <div className="text-xs text-gray-600 space-y-1 mb-3">
            <div>• Voice: Fable (Educational British)</div>
            <div>• Speed: 0.85x (Optimized for learning)</div>
            <div>• Mode: Streaming (Low latency)</div>
            <div>• Focus: Educational content only</div>
          </div>
          
          <div className="space-y-2">
            <button
              onClick={() => testSpeak()}
              disabled={isLoading}
              className="w-full px-3 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 rounded text-xs transition-colors"
            >
              🧪 Test Voice System
            </button>
            
            <button
              onClick={() => setShowSettings(false)}
              className="w-full px-3 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}