import { useCallback, useRef, useState, useEffect } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useVoiceActivityDetection } from './useVoiceActivityDetection';
import { useAgentTTS } from './useAgentTTS';
import { useRealtimeTTS } from './useRealtimeTTS';

export interface VoiceChatOptions {
  pauseOnSpeech?: boolean;
  autoSubmitOnSilence?: boolean;
  silenceTimeout?: number;
  minPhraseLength?: number;
  realtimeTTS?: boolean;
}

export interface VoiceChatState {
  isVoiceChatActive: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  currentTranscript: string;
  isProcessing: boolean;
  error: string | null;
}

export function useVoiceChat(
  onMessage: (message: string) => void,
  options: VoiceChatOptions = {}
) {
  console.log('🔄 useVoiceChat hook created/recreated');
  
  const {
    pauseOnSpeech = true,
    autoSubmitOnSilence = true,
    silenceTimeout = 1500,
    minPhraseLength = 5,
    realtimeTTS = true,
  } = options;

  const speechRecognition = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    language: 'en-US',
  });

  const voiceActivity = useVoiceActivityDetection({
    threshold: 0.02, // Higher threshold to reduce false positives
    minSpeechDuration: 300,
    maxSilenceDuration: 1500,
  });

  const { clearSpeech, isPlaying: isTTSPlaying, pauseSpeech } = useAgentTTS();
  
  const realtimeTTSHook = useRealtimeTTS({
    enabled: realtimeTTS,
    sentenceDelay: 50, // Minimal delay for natural flow
    minSentenceLength: 8,
  });

  const [state, setState] = useState<VoiceChatState>({
    isVoiceChatActive: false,
    isListening: false,
    isSpeaking: false,
    currentTranscript: '',
    isProcessing: false,
    error: null,
  });

  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscriptRef = useRef<string>('');
  const hasSubmittedRef = useRef<boolean>(false);

  // Handle speech recognition results
  useEffect(() => {
    const fullTranscript = speechRecognition.transcript + speechRecognition.interimTranscript;
    
    setState(prev => ({
      ...prev,
      currentTranscript: fullTranscript,
      error: speechRecognition.error,
    }));

    // Auto-submit logic
    if (autoSubmitOnSilence && speechRecognition.transcript.length > 0) {
      // If we have a final transcript that's different from last submitted
      if (speechRecognition.transcript !== lastTranscriptRef.current && 
          speechRecognition.transcript.trim().length >= minPhraseLength) {
        
        // Clear existing timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }

        // Set new timeout for auto-submit (simplified without VAD dependency)
        silenceTimeoutRef.current = setTimeout(() => {
          if (!hasSubmittedRef.current) {
            const transcript = speechRecognition.transcript.trim();
            
            if (transcript.length >= minPhraseLength && transcript !== lastTranscriptRef.current) {
              console.log('🎤 Auto-submitting voice message:', transcript);
              
              lastTranscriptRef.current = transcript;
              hasSubmittedRef.current = true;
              
              // Clear the transcript
              speechRecognition.resetTranscript();
              
              // Submit the message
              onMessage(transcript);
              
              // Reset submission flag after a delay
              setTimeout(() => {
                hasSubmittedRef.current = false;
              }, 1000);
            }
          }
        }, silenceTimeout);
      }
    }
  }, [
    speechRecognition.transcript, 
    speechRecognition.interimTranscript, 
    speechRecognition.error,
    autoSubmitOnSilence,
    minPhraseLength,
    silenceTimeout,
    speechRecognition.resetTranscript,
    onMessage
  ]);

  // Handle voice activity for TTS pausing (disabled for now)
  useEffect(() => {
    // Skip voice activity handling to avoid infinite loops
    // if (pauseOnSpeech && state.isVoiceChatActive) {
    //   if (voiceActivity.isSpeaking && isTTSPlaying) {
    //     console.log('🎤 User speaking - pausing TTS');
    //     clearSpeech();
    //   }
    // }

    // setState(prev => ({
    //   ...prev,
    //   isSpeaking: voiceActivity.isSpeaking,
    // }));
  }, []);

  // Update listening state
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isListening: speechRecognition.isListening,
    }));
  }, [speechRecognition.isListening]);

  const submitCurrentTranscript = useCallback(() => {
    const transcript = speechRecognition.transcript.trim();
    
    if (transcript.length >= minPhraseLength && transcript !== lastTranscriptRef.current) {
      console.log('🎤 Manual submit voice message:', transcript);
      
      lastTranscriptRef.current = transcript;
      hasSubmittedRef.current = true;
      
      // Clear the transcript
      speechRecognition.resetTranscript();
      
      // Submit the message
      onMessage(transcript);
      
      // Reset submission flag after a delay
      setTimeout(() => {
        hasSubmittedRef.current = false;
      }, 1000);
    }
  }, [speechRecognition.transcript, speechRecognition.resetTranscript, onMessage, minPhraseLength]);

  const startVoiceChat = useCallback(async () => {
    try {
      console.log('🎤 Starting voice chat...');
      setState(prev => ({ ...prev, isProcessing: true, error: null }));

      console.log('🎤 Speech recognition supported:', speechRecognition.isSupported);

      // Start speech recognition only for now
      console.log('🎤 Starting speech recognition...');
      await speechRecognition.startListening();
      console.log('🎤 Speech recognition started successfully');

      // Skip voice activity detection for now to avoid infinite loops
      console.log('🎤 Skipping voice activity detection to avoid loops');

      setState(prev => ({
        ...prev,
        isVoiceChatActive: true,
        isProcessing: false,
      }));

      console.log('✅ Voice chat started successfully (speech recognition only)');
      
    } catch (error) {
      console.error('❌ Failed to start voice chat:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to start voice chat',
      }));
    }
  }, [speechRecognition]);

  const stopVoiceChat = useCallback(() => {
    console.log('🛑 stopVoiceChat called');
    
    // Clear any pending timeouts
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    // Stop speech recognition
    console.log('🎤 Stopping speech recognition...');
    speechRecognition.abortListening();

    // Clear TTS and real-time processing
    console.log('🔊 Clearing TTS...');
    clearSpeech();
    realtimeTTSHook.reset();

    // Reset state
    setState(prev => ({
      ...prev,
      isVoiceChatActive: false,
      isListening: false,
      isSpeaking: false,
      currentTranscript: '',
      isProcessing: false,
    }));

    lastTranscriptRef.current = '';
    hasSubmittedRef.current = false;

    console.log('🎤 Voice chat stopped (speech recognition only)');
  }, [speechRecognition, clearSpeech]);

  const toggleVoiceChat = useCallback(() => {
    if (state.isVoiceChatActive) {
      stopVoiceChat();
    } else {
      startVoiceChat();
    }
  }, [state.isVoiceChatActive, startVoiceChat, stopVoiceChat]);

  const forceSubmit = useCallback(() => {
    submitCurrentTranscript();
  }, [submitCurrentTranscript]);

  // Process streaming response for real-time TTS
  const processStreamingResponse = useCallback((text: string, isComplete: boolean = false) => {
    realtimeTTSHook.processTextStream(text, isComplete);
  }, [realtimeTTSHook]);

  // Process complete response
  const processCompleteResponse = useCallback((text: string) => {
    realtimeTTSHook.processCompleteResponse(text);
  }, [realtimeTTSHook]);

  // Cleanup on unmount only (no dependencies to prevent recreation)
  useEffect(() => {
    return () => {
      console.log('🎤 useVoiceChat cleanup on unmount');
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      
      // Direct cleanup without calling stopVoiceChat to avoid dependency issues
      speechRecognition.abortListening();
      clearSpeech();
    };
  }, []); // Empty dependency array - only run on mount/unmount

  return {
    ...state,
    isSupported: speechRecognition.isSupported,
    audioLevel: 0,
    confidence: speechRecognition.confidence,
    startVoiceChat,
    stopVoiceChat,
    toggleVoiceChat,
    forceSubmit,
    processStreamingResponse,
    processCompleteResponse,
    ttsQueueLength: realtimeTTSHook.queueLength,
    isTTSPlaying: realtimeTTSHook.isPlaying,
  };
}