import { useState, useCallback, useRef, useEffect } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useRealtimeTTS } from './useRealtimeTTS';

export type ConversationMode = 'voice' | 'text';

export interface ConversationState {
  mode: ConversationMode;
  isActive: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  currentTranscript: string;
  error: string | null;
  confidence: number;
}

export interface ConversationOptions {
  autoSubmitDelay?: number; // ms to wait after silence before submitting
  minPhraseLength?: number;
  voiceSettings?: {
    voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
    speed?: number;
  };
}

export function useConversationMode(
  onMessage: (message: string) => Promise<Response | void> | Response | void,
  onResponse?: (response: string, isComplete: boolean) => void,
  options: ConversationOptions = {}
) {
  const {
    autoSubmitDelay = 1500,
    minPhraseLength = 5,
    voiceSettings = { voice: 'fable', speed: 0.9 }
  } = options;

  const speechRecognition = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    language: 'en-US',
  });

  const realtimeTTS = useRealtimeTTS({
    enabled: true,
    sentenceDelay: 0, // Immediate for conversation
    minSentenceLength: 5,
  });

  const [state, setState] = useState<ConversationState>({
    mode: 'text',
    isActive: false,
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    currentTranscript: '',
    error: null,
    confidence: 0,
  });

  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSubmittedRef = useRef<string>('');
  const processingResponseRef = useRef<boolean>(false);

  // Handle speech recognition updates
  useEffect(() => {
    const fullTranscript = speechRecognition.transcript + speechRecognition.interimTranscript;
    
    setState(prev => ({
      ...prev,
      currentTranscript: fullTranscript,
      confidence: speechRecognition.confidence,
      error: speechRecognition.error,
      isListening: speechRecognition.isListening,
    }));

    // Auto-submit logic for voice mode
    if (state.mode === 'voice' && state.isActive && speechRecognition.transcript.length > 0) {
      // Clear existing timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      // Set new timeout for auto-submit
      const finalTranscript = speechRecognition.transcript.trim();
      if (finalTranscript.length >= minPhraseLength && finalTranscript !== lastSubmittedRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          submitTranscript(finalTranscript);
        }, autoSubmitDelay);
      }
    }
  }, [
    speechRecognition.transcript,
    speechRecognition.interimTranscript,
    speechRecognition.confidence,
    speechRecognition.error,
    speechRecognition.isListening,
    state.mode,
    state.isActive,
    autoSubmitDelay,
    minPhraseLength
  ]);

  // Submit transcript
  const submitTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim() || transcript === lastSubmittedRef.current) return;

    console.log('🎤 Submitting transcript:', transcript);
    lastSubmittedRef.current = transcript;
    
    setState(prev => ({ ...prev, isProcessing: true }));
    
    // Clear speech recognition
    speechRecognition.resetTranscript();
    
    try {
      const result = await onMessage(transcript);
      
      // If onMessage returns a response (like a fetch response), handle streaming
      if (result && typeof (result as Response).body?.getReader === 'function') {
        await handleStreamingResponse(result as Response);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to process message' 
      }));
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [onMessage, speechRecognition]);

  // Handle streaming response from API
  const handleStreamingResponse = useCallback(async (response: Response) => {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let accumulatedResponse = '';

    try {
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
                accumulatedResponse += data.content;
                processStreamingResponse(accumulatedResponse, false);
              }
            } catch (e) {
              console.warn('Failed to parse streaming data:', e);
            }
          }
        }
      }

      // Mark as complete
      if (accumulatedResponse) {
        processStreamingResponse(accumulatedResponse, true);
      }
    } catch (error) {
      console.error('Streaming response error:', error);
    }
  }, []);

  // Process streaming response for voice mode
  const processStreamingResponse = useCallback((response: string, isComplete: boolean = false) => {
    if (state.mode === 'voice') {
      // In voice mode, speak the response immediately
      realtimeTTS.processTextStream(response, isComplete);
      setState(prev => ({ ...prev, isSpeaking: realtimeTTS.isPlaying }));
    }
    
    // Call the response callback if provided
    if (onResponse) {
      onResponse(response, isComplete);
    }
  }, [state.mode, realtimeTTS, onResponse]);

  // Start voice mode
  const startVoiceMode = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, mode: 'voice', isProcessing: true }));
      
      await speechRecognition.startListening();
      
      setState(prev => ({ 
        ...prev, 
        isActive: true, 
        isProcessing: false,
        error: null 
      }));
      
      console.log('🎤 Voice mode activated');
    } catch (error) {
      console.error('Failed to start voice mode:', error);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to start voice mode' 
      }));
    }
  }, [speechRecognition]);

  // Start text mode with optional voice input
  const startTextMode = useCallback(async (withVoiceInput = false) => {
    try {
      setState(prev => ({ 
        ...prev, 
        mode: 'text', 
        isProcessing: withVoiceInput 
      }));
      
      if (withVoiceInput) {
        await speechRecognition.startListening();
      }
      
      setState(prev => ({ 
        ...prev, 
        isActive: true, 
        isProcessing: false,
        error: null 
      }));
      
      console.log('📝 Text mode activated', withVoiceInput ? 'with voice input' : '');
    } catch (error) {
      console.error('Failed to start text mode:', error);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to start text mode' 
      }));
    }
  }, [speechRecognition]);

  // Stop conversation
  const stop = useCallback(() => {
    // Clear timeouts
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    // Stop speech recognition
    speechRecognition.abortListening();
    
    // Stop TTS
    realtimeTTS.reset();
    
    // Reset state
    setState(prev => ({
      ...prev,
      isActive: false,
      isListening: false,
      isSpeaking: false,
      isProcessing: false,
      currentTranscript: '',
      error: null,
    }));

    lastSubmittedRef.current = '';
    processingResponseRef.current = false;
    
    console.log('🛑 Conversation stopped');
  }, [speechRecognition, realtimeTTS]);

  // Manually submit current transcript (for text mode)
  const submitCurrentTranscript = useCallback(() => {
    const transcript = state.currentTranscript.trim();
    if (transcript.length >= minPhraseLength) {
      submitTranscript(transcript);
    }
  }, [state.currentTranscript, minPhraseLength, submitTranscript]);

  // Interrupt current speech (for voice mode)
  const interrupt = useCallback(() => {
    if (state.mode === 'voice' && state.isSpeaking) {
      realtimeTTS.reset();
      setState(prev => ({ ...prev, isSpeaking: false }));
      console.log('⏸️ Interrupted TTS');
    }
  }, [state.mode, state.isSpeaking, realtimeTTS]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,
    isSupported: speechRecognition.isSupported,
    
    // Controls
    startVoiceMode,
    startTextMode,
    stop,
    submitCurrentTranscript,
    interrupt,
    
    // Response processing
    processStreamingResponse,
    
    // TTS info
    ttsQueueLength: realtimeTTS.queueLength,
  };
}