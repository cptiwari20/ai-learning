'use client';
import React, { useState } from 'react';
import { useTTS, TTSOptions } from '@/hooks/useTTS';

interface TTSControlsProps {
  text: string;
  className?: string;
  autoSpeak?: boolean;
  showControls?: boolean;
}

const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy (Neutral)', description: 'Balanced and clear' },
  { value: 'echo', label: 'Echo (Male)', description: 'Deep and resonant' },
  { value: 'fable', label: 'Fable (British)', description: 'Warm and expressive' },
  { value: 'onyx', label: 'Onyx (Deep)', description: 'Rich and authoritative' },
  { value: 'nova', label: 'Nova (Female)', description: 'Bright and energetic' },
  { value: 'shimmer', label: 'Shimmer (Soft)', description: 'Gentle and soothing' },
] as const;

export default function TTSControls({ 
  text, 
  className = '', 
  autoSpeak = false,
  showControls = true 
}: TTSControlsProps) {
  const { isLoading, isPlaying, error, speak, play, pause, stop, cancel } = useTTS();
  const [voice, setVoice] = useState<TTSOptions['voice']>('alloy');
  const [speed, setSpeed] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);

  const handleSpeak = () => {
    if (!text.trim()) return;
    speak(text, { voice, speed, autoPlay: true });
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  // Auto-speak when text changes (if enabled) - only for substantial educational content
  React.useEffect(() => {
    if (autoSpeak && text.trim() && !isLoading && !isPlaying) {
      // Only auto-speak longer educational messages
      const cleanText = text.replace(/[🎨🧹✅❌⚠️📡🔧]/g, '').trim();
      if (cleanText.length > 30 && !cleanText.includes('WebSocket') && !cleanText.includes('Canvas')) {
        const timer = setTimeout(() => {
          speak(cleanText, { voice, speed, autoPlay: true });
        }, 800); // Longer delay for better synchronization
        
        return () => clearTimeout(timer);
      }
    }
  }, [text, autoSpeak, voice, speed, speak, isLoading, isPlaying]);

  if (!text.trim()) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Main TTS Button */}
      <button
        onClick={isPlaying ? handleTogglePlay : handleSpeak}
        disabled={isLoading}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
          isLoading 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : isPlaying
            ? 'bg-red-100 text-red-700 hover:bg-red-200'
            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
        }`}
        title={isLoading ? 'Generating speech...' : isPlaying ? 'Pause speech' : 'Listen to response'}
      >
        {isLoading ? (
          <>
            <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Generating...</span>
          </>
        ) : isPlaying ? (
          <>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
            <span>Pause</span>
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
            <span>Listen</span>
          </>
        )}
      </button>

      {/* Stop Button (when playing) */}
      {isPlaying && (
        <button
          onClick={stop}
          className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded text-xs transition-colors"
          title="Stop speech"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h12v12H6z"/>
          </svg>
        </button>
      )}

      {/* Settings Toggle */}
      {showControls && (
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center px-2 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded text-xs transition-colors"
          title="TTS Settings"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/>
          </svg>
        </button>
      )}

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <span>{error}</span>
          <button onClick={cancel} className="ml-1 hover:text-red-900">×</button>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute z-10 mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-lg min-w-64">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Voice
              </label>
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value as TTSOptions['voice'])}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {VOICE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {VOICE_OPTIONS.find(v => v.value === voice)?.description}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Speed: {speed}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0.5x</span>
                <span>1.0x</span>
                <span>2.0x</span>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}