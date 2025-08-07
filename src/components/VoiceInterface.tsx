'use client';
import React, { useState, useMemo } from 'react';
import { useVoiceChat } from '@/hooks/useVoiceChat';

interface VoiceInterfaceProps {
  onMessage: (message: string) => void;
  isDisabled?: boolean;
  className?: string;
}

export default function VoiceInterface({ 
  onMessage, 
  isDisabled = false, 
  className = '' 
}: VoiceInterfaceProps) {
  const [micTestResult, setMicTestResult] = useState<string | null>(null);
  
  // Debug re-renders
  console.log('🔄 VoiceInterface render:', { isDisabled, className });
  
  const voiceChatOptions = useMemo(() => ({
    pauseOnSpeech: true,
    autoSubmitOnSilence: true,
    silenceTimeout: 1500,
    minPhraseLength: 3,
    realtimeTTS: true, // Enable real-time TTS processing
  }), []);

  const voiceChat = useVoiceChat(onMessage, voiceChatOptions);

  const testMicrophone = async () => {
    try {
      setMicTestResult('Testing microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('🎤 Microphone test successful:', stream);
      setMicTestResult('✅ Microphone access granted');
      
      // Stop the stream after testing
      stream.getTracks().forEach(track => track.stop());
      
      setTimeout(() => setMicTestResult(null), 3000);
    } catch (error) {
      console.error('🎤 Microphone test failed:', error);
      let errorMsg = 'Microphone test failed';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMsg = '❌ Microphone permission denied';
        } else if (error.name === 'NotFoundError') {
          errorMsg = '❌ No microphone found';
        } else {
          errorMsg = `❌ ${error.message}`;
        }
      }
      
      setMicTestResult(errorMsg);
      setTimeout(() => setMicTestResult(null), 5000);
    }
  };

  const getMicrophoneIcon = () => {
    if (voiceChat.isListening) {
      return voiceChat.isSpeaking ? '🎤' : '🎧';
    }
    return '🎙️';
  };

  const getStatusText = () => {
    if (!voiceChat.isSupported) return 'Voice not supported';
    if (voiceChat.isProcessing) return 'Initializing...';
    if (voiceChat.error) return 'Voice error';
    if (voiceChat.isVoiceChatActive) {
      if (voiceChat.isSpeaking) return 'Speaking...';
      if (voiceChat.isListening && voiceChat.currentTranscript) return 'Processing...';
      if (voiceChat.isListening) return 'Listening...';
      return 'Voice active';
    }
    return 'Start voice chat';
  };

  const getButtonColor = () => {
    if (isDisabled || !voiceChat.isSupported) return 'bg-gray-100 text-gray-400';
    if (voiceChat.error) return 'bg-red-100 text-red-600';
    if (voiceChat.isVoiceChatActive) {
      if (voiceChat.isSpeaking) return 'bg-green-100 text-green-700';
      return 'bg-blue-100 text-blue-700';
    }
    return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Voice Chat Toggle Button */}
      <button
        onClick={voiceChat.toggleVoiceChat}
        disabled={isDisabled || !voiceChat.isSupported || voiceChat.isProcessing}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${getButtonColor()}`}
        title={voiceChat.isVoiceChatActive ? 'Stop voice chat' : 'Start voice chat'}
      >
        <span className="text-lg">{getMicrophoneIcon()}</span>
        <span>{getStatusText()}</span>
        
        {/* Real-time TTS indicator */}
        {voiceChat.isVoiceChatActive && voiceChat.ttsQueueLength > 0 && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-blue-600">🎵</span>
            <span className="text-blue-600">{voiceChat.ttsQueueLength}</span>
          </div>
        )}
        
        {/* Audio level indicator */}
        {voiceChat.isVoiceChatActive && (
          <div className="flex items-center gap-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className={`w-1 h-3 rounded-full transition-colors ${
                  voiceChat.isTTSPlaying && i <= 1
                    ? 'bg-green-500 animate-pulse' 
                    : voiceChat.audioLevel * 10 > i 
                    ? 'bg-current' 
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        )}
      </button>

      {/* Current Transcript Display */}
      {voiceChat.isVoiceChatActive && voiceChat.currentTranscript && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs text-blue-600 font-medium mb-1">Speaking:</div>
          <div className="text-sm text-blue-800">
            {voiceChat.currentTranscript}
            {voiceChat.isListening && (
              <span className="inline-block w-2 h-4 bg-blue-600 ml-1 animate-pulse" />
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-xs text-blue-600">
              Confidence: {Math.round(voiceChat.confidence * 100)}%
            </div>
            {voiceChat.currentTranscript.trim().length >= 3 && (
              <button
                onClick={voiceChat.forceSubmit}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                Send Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {voiceChat.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2">
          <div className="text-xs text-red-600">{voiceChat.error}</div>
        </div>
      )}

      {/* Voice Chat Instructions */}
      {voiceChat.isVoiceChatActive && !voiceChat.currentTranscript && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="text-xs text-gray-600">
            💡 <strong>Voice Chat Active - Real-time Streaming:</strong>
            <ul className="mt-1 ml-2 space-y-1">
              <li>• Speak naturally - I&apos;ll process in real-time</li>
              <li>• Audio streams instantly - no waiting</li>
              <li>• I&apos;ll pause when you speak</li>
              <li>• Use &quot;Send Now&quot; for immediate submission</li>
            </ul>
          </div>
        </div>
      )}

      {/* Debug Panel - Show when voice is supported but user might need help */}
      {voiceChat.isSupported && !voiceChat.isVoiceChatActive && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-sm text-green-800">
            <div className="font-medium mb-2">✅ Voice features ready!</div>
            <div className="text-xs space-y-1 mb-3">
              <div>• Click the voice button above to start</div>
              <div>• Browser will request microphone permissions</div>
              <div>• Speak after you see &quot;Listening...&quot;</div>
              <div>• Check browser console for detailed logs</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={testMicrophone}
                className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
              >
                🎤 Test Microphone
              </button>
              <button
                onClick={() => {
                  console.log('🔍 Voice Chat Debug Info:', {
                    isSupported: voiceChat.isSupported,
                    isVoiceChatActive: voiceChat.isVoiceChatActive,
                    isListening: voiceChat.isListening,
                    isSpeaking: voiceChat.isSpeaking,
                    isProcessing: voiceChat.isProcessing,
                    error: voiceChat.error,
                    audioLevel: voiceChat.audioLevel,
                    confidence: voiceChat.confidence,
                    currentTranscript: voiceChat.currentTranscript
                  });
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                🔍 Debug Info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Microphone Test Result */}
      {micTestResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
          <div className="text-sm text-blue-800">{micTestResult}</div>
        </div>
      )}

      {/* Browser Compatibility Warning */}
      {!voiceChat.isSupported && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-sm text-yellow-800">
            <div className="font-medium mb-2">⚠️ Voice features not available</div>
            <div className="text-xs space-y-1 mb-3">
              <div>• <strong>Chrome/Edge:</strong> Enable microphone permissions</div>
              <div>• <strong>Safari:</strong> Enable speech recognition in settings</div>
              <div>• <strong>Localhost:</strong> Should work without HTTPS</div>
              <div>• Check console for detailed support information</div>
            </div>
            <button
              onClick={testMicrophone}
              className="px-3 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
            >
              🎤 Test Microphone
            </button>
          </div>
        </div>
      )}
    </div>
  );
}