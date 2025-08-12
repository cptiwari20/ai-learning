'use client';
import React from 'react';
import { useAgentTTS } from '@/hooks/useAgentTTS';

interface LearningSessionControlsProps {
  className?: string;
}

export default function LearningSessionControls({ className = '' }: LearningSessionControlsProps) {
  const {
    isPlaying,
    isMuted,
    currentSpeed,
    toggleMute,
    stopLearningSession,
    clearSpeech,
    setSpeed,
  } = useAgentTTS();

  const formatSpeed = (speed: number) => `${(speed || 0.9).toFixed(1)}x`;

  const getVolumeIcon = () => {
    if (isMuted) return '🔇';
    if (isPlaying) return '🔊';
    return '🔉';
  };

  return (
    <div className={`flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg ${className}`}>
      {/* Mute Control */}
      <button
        onClick={toggleMute}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
          isMuted 
            ? 'bg-red-100 text-red-700 hover:bg-red-200' 
            : 'bg-green-100 text-green-700 hover:bg-green-200'
        }`}
        title={isMuted ? 'Unmute voice' : 'Mute voice'}
      >
        <span>{getVolumeIcon()}</span>
        <span>{isMuted ? 'Muted' : 'On'}</span>
      </button>

      {/* Speed Control */}
      <div className="flex items-center gap-2 flex-1 max-w-32">
        <span className="text-xs text-gray-600 whitespace-nowrap">{formatSpeed(currentSpeed || 0.9)}</span>
        <input
          type="range"
          min="0.5"
          max="1.5"
          step="0.1"
          value={currentSpeed || 0.9}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          title={`Speed: ${formatSpeed(currentSpeed || 0.9)}`}
        />
      </div>

      {/* Quick Presets */}
      <div className="flex gap-1">
        <button
          onClick={() => setSpeed(0.7)}
          className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
          title="Slow"
        >
          🐢
        </button>
        <button
          onClick={() => setSpeed(1.2)}
          className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
          title="Fast"
        >
          ⚡
        </button>
      </div>

      {/* Stop */}
      <button
        onClick={() => {
          console.log('🛑 Stop button clicked - stopping all TTS');
          // Call both functions to ensure everything stops
          stopLearningSession();
          clearSpeech();
          // Visual confirmation
          console.log('🛑 Stop functions called, should be silent now');
        }}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors active:bg-red-300"
        title="Stop all voice immediately"
      >
        <span>🛑</span>
        <span>Stop</span>
      </button>
    </div>
  );
}