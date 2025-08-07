import { useState, useRef, useCallback, useEffect } from 'react';

export interface VADOptions {
  threshold?: number;
  debounceTime?: number;
  minSpeechDuration?: number;
  maxSilenceDuration?: number;
}

export interface VADState {
  isVoiceDetected: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  isSupported: boolean;
  error: string | null;
}

export function useVoiceActivityDetection(options: VADOptions = {}) {
  const {
    threshold = 0.01,
    debounceTime = 200,
    minSpeechDuration = 500,
    maxSilenceDuration = 1500,
  } = options;

  const [state, setState] = useState<VADState>({
    isVoiceDetected: false,
    isSpeaking: false,
    audioLevel: 0,
    isSupported: false,
    error: null,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Voice activity state
  const speechStartTimeRef = useRef<number | null>(null);
  const lastVoiceTimeRef = useRef<number>(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate RMS (Root Mean Square) for audio level
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength) / 255;
    const currentTime = Date.now();

    // Voice detection logic
    const isVoiceActive = rms > threshold;
    
    if (isVoiceActive) {
      lastVoiceTimeRef.current = currentTime;
      
      // Start speech timer if not already started
      if (!speechStartTimeRef.current) {
        speechStartTimeRef.current = currentTime;
      }
    }

    // Check if we should consider this as speaking
    const silenceDuration = currentTime - lastVoiceTimeRef.current;
    const speechDuration = speechStartTimeRef.current 
      ? currentTime - speechStartTimeRef.current 
      : 0;

    const shouldBeSpeaking = isVoiceActive || silenceDuration < maxSilenceDuration;
    const isActuallySpeaking = shouldBeSpeaking && speechDuration > minSpeechDuration;

    // Reset speech timer if silence is too long
    if (silenceDuration > maxSilenceDuration) {
      speechStartTimeRef.current = null;
    }

    setState(prev => {
      // Only update if values actually changed to prevent unnecessary re-renders
      if (prev.isVoiceDetected === isVoiceActive && 
          prev.isSpeaking === isActuallySpeaking && 
          Math.abs(prev.audioLevel - rms) < 0.01) {
        return prev;
      }
      
      return {
        ...prev,
        isVoiceDetected: isVoiceActive,
        isSpeaking: isActuallySpeaking,
        audioLevel: rms,
      };
    });

    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [threshold, minSpeechDuration, maxSilenceDuration]);

  const startDetection = useCallback(async () => {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      streamRef.current = stream;

      // Create audio context and analyzer
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      microphoneRef.current = microphone;

      setState(prev => ({ ...prev, isSupported: true, error: null }));

      // Start analysis
      analyzeAudio();

      console.log('🎙️ Voice Activity Detection started');
    } catch (error) {
      console.error('Failed to start VAD:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start voice detection',
        isSupported: false,
      }));
    }
  }, [analyzeAudio]);

  const stopDetection = useCallback(() => {
    // Stop analysis loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear timeouts
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    // Clean up audio resources
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (microphoneRef.current) {
      microphoneRef.current.disconnect();
      microphoneRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    speechStartTimeRef.current = null;
    lastVoiceTimeRef.current = 0;

    setState(prev => ({
      ...prev,
      isVoiceDetected: false,
      isSpeaking: false,
      audioLevel: 0,
    }));

    console.log('🎙️ Voice Activity Detection stopped');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🎙️ VAD cleanup on unmount');
      // Stop analysis loop
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Clean up audio resources without state updates
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (microphoneRef.current) {
        microphoneRef.current.disconnect();
        microphoneRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      analyserRef.current = null;
      speechStartTimeRef.current = null;
      lastVoiceTimeRef.current = 0;
    };
  }, []); // No dependencies to prevent infinite loops

  return {
    ...state,
    startDetection,
    stopDetection,
  };
}