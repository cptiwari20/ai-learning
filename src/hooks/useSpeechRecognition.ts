import { useState, useRef, useCallback, useEffect } from 'react';

export interface SpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  language?: string;
  maxAlternatives?: number;
}

export interface SpeechRecognitionState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  confidence: number;
  error: string | null;
}

export function useSpeechRecognition(options: SpeechRecognitionOptions = {}) {
  const {
    continuous = true,
    interimResults = true,
    language = 'en-US',
    maxAlternatives = 1,
  } = options;

  const [state, setState] = useState<SpeechRecognitionState>({
    isListening: false,
    isSupported: false,
    transcript: '',
    interimTranscript: '',
    confidence: 0,
    error: null,
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>('');

  // Check microphone permissions
  const checkMicrophonePermissions = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('🎤 MediaDevices API not supported');
        return false;
      }

      // Check current permission state
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log('🎤 Microphone permission status:', permissionStatus.state);
      
      return permissionStatus.state === 'granted' || permissionStatus.state === 'prompt';
    } catch (error) {
      console.warn('🎤 Could not check microphone permissions:', error);
      return true; // Assume it's available for testing
    }
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = 
        window.SpeechRecognition || 
        (window as any).webkitSpeechRecognition;

      console.log('🎤 Checking speech recognition support:', {
        hasSpeechRecognition: !!window.SpeechRecognition,
        hasWebkitSpeechRecognition: !!(window as any).webkitSpeechRecognition,
        finalSupport: !!SpeechRecognition,
        userAgent: navigator.userAgent,
        isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
        protocol: window.location.protocol
      });

      if (SpeechRecognition) {
        console.log('🎤 Speech Recognition API available, creating instance...');
        
        const recognition = new SpeechRecognition();
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.lang = language;
        recognition.maxAlternatives = maxAlternatives;

        recognition.onstart = () => {
          console.log('✅ Speech recognition successfully started');
          setState(prev => ({ 
            ...prev, 
            isListening: true, 
            error: null,
            transcript: '',
            interimTranscript: ''
          }));
          finalTranscriptRef.current = '';
        };

        recognition.onresult = (event) => {
          let interimTranscript = '';
          let finalTranscript = finalTranscriptRef.current;

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;

            if (result.isFinal) {
              finalTranscript += transcript;
              console.log('🎤 Final transcript:', transcript);
            } else {
              interimTranscript += transcript;
              console.log('🎤 Interim transcript:', transcript);
            }
          }

          finalTranscriptRef.current = finalTranscript;
          
          setState(prev => ({
            ...prev,
            transcript: finalTranscript,
            interimTranscript,
            confidence: event.results[event.results.length - 1]?.[0]?.confidence || 0,
          }));
        };

        recognition.onerror = (event) => {
          console.error('❌ Speech recognition error:', event.error, event);
          let errorMessage = `Speech recognition error: ${event.error}`;
          
          // Handle specific errors
          switch (event.error) {
            case 'not-allowed':
              errorMessage = 'Microphone access denied. Please allow microphone permissions.';
              break;
            case 'no-speech':
              errorMessage = 'No speech detected. Please try speaking.';
              break;
            case 'audio-capture':
              errorMessage = 'Audio capture failed. Check your microphone.';
              break;
            case 'network':
              errorMessage = 'Network error. Speech recognition requires internet connection.';
              break;
            case 'service-not-allowed':
              errorMessage = 'Speech service not allowed. Try refreshing the page.';
              break;
            case 'aborted':
              // Don't show error for manual aborts
              return;
            default:
              errorMessage = `Speech recognition error: ${event.error}`;
          }
          
          setState(prev => ({
            ...prev,
            isListening: false,
            error: errorMessage,
          }));
        };

        recognition.onend = () => {
          console.log('🎤 Speech recognition ended');
          setState(prev => ({ 
            ...prev, 
            isListening: false,
            transcript: finalTranscriptRef.current || prev.transcript,
            interimTranscript: ''
          }));
        };

        recognition.onabort = () => {
          console.log('🎤 Speech recognition aborted');
          setState(prev => ({
            ...prev,
            isListening: false,
            transcript: '',
            interimTranscript: '',
            error: null,
          }));
          finalTranscriptRef.current = '';
        };

        recognitionRef.current = recognition;
        
        // Check microphone permissions after setting up recognition
        checkMicrophonePermissions().then(hasPermission => {
          console.log('🎤 Microphone permission check result:', hasPermission);
          setState(prev => ({ ...prev, isSupported: true }));
        });
        
        console.log('✅ Speech recognition instance created and configured');
      } else {
        console.warn('❌ Speech recognition not supported in this browser');
        setState(prev => ({ ...prev, isSupported: false }));
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [continuous, interimResults, language, maxAlternatives]);

  const startListening = useCallback(async () => {
    console.log('🎤 startListening called, current state:', { 
      hasRecognition: !!recognitionRef.current, 
      isListening: state.isListening 
    });
    
    if (recognitionRef.current && !state.isListening) {
      try {
        // Request microphone permission first
        console.log('🎤 Requesting microphone permission...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Microphone permission granted for speech recognition');
        
        // Stop the test stream immediately
        stream.getTracks().forEach(track => track.stop());
        
        console.log('🎤 Starting speech recognition...');
        recognitionRef.current.start();
        console.log('🎤 Speech recognition.start() called');
      } catch (error) {
        console.error('❌ Failed to start speech recognition:', error);
        let errorMessage = 'Failed to start speech recognition';
        
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            errorMessage = 'Microphone permission denied. Please allow microphone access.';
          } else if (error.name === 'NotFoundError') {
            errorMessage = 'No microphone found. Please connect a microphone.';
          } else if (error.name === 'NotSupportedError') {
            errorMessage = 'Speech recognition not supported in this browser.';
          } else if (error.name === 'InvalidStateError') {
            errorMessage = 'Speech recognition already running or in invalid state.';
          } else {
            errorMessage = error.message;
          }
        }
        
        console.error('🎤 Error details:', errorMessage);
        setState(prev => ({
          ...prev,
          error: errorMessage,
        }));
      }
    } else {
      console.warn('🎤 Cannot start listening:', { 
        hasRecognition: !!recognitionRef.current, 
        isListening: state.isListening 
      });
    }
  }, [state.isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && state.isListening) {
      recognitionRef.current.stop();
    }
  }, [state.isListening]);

  const abortListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      finalTranscriptRef.current = '';
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setState(prev => ({
      ...prev,
      transcript: '',
      interimTranscript: '',
      confidence: 0,
    }));
    finalTranscriptRef.current = '';
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    abortListening,
    resetTranscript,
  };
}