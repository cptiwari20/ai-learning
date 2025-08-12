import { useState, useRef, useCallback, useEffect } from 'react';

export interface TTSOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number;
  autoPlay?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

export interface TTSState {
  isLoading: boolean;
  isPlaying: boolean;
  error: string | null;
  currentText: string | null;
  queueLength: number;
  isMuted: boolean;
  currentSpeed: number;
}

interface TTSQueueItem {
  id: string;
  text: string;
  options: TTSOptions;
  audio?: HTMLAudioElement;
  retries: number;
}

export function useTTS() {
  const [state, setState] = useState<TTSState>({
    isLoading: false,
    isPlaying: false,
    error: null,
    currentText: null,
    queueLength: 0,
    isMuted: false,
    currentSpeed: 0.9, // Default learning speed
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentRequestRef = useRef<AbortController | null>(null);
  const queueRef = useRef<TTSQueueItem[]>([]);
  const processingRef = useRef<boolean>(false);
  const preloadCacheRef = useRef<Map<string, Blob>>(new Map());
  
  // Audio queue management
  const updateQueueLength = useCallback(() => {
    setState(prev => ({ ...prev, queueLength: queueRef.current.length }));
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0 || state.isMuted) {
      return;
    }

    processingRef.current = true;
    
    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift()!;
      updateQueueLength();
      
      try {
        setState(prev => ({ ...prev, currentText: item.text, isLoading: true }));

        let audioBlob: Blob;
        
        // Check cache first
        const cacheKey = `${item.text}-${item.options.voice}-${item.options.speed}`;
        if (preloadCacheRef.current.has(cacheKey)) {
          audioBlob = preloadCacheRef.current.get(cacheKey)!;
          console.log('🎵 Using cached audio for:', item.text.substring(0, 50));
        } else {
          // Generate new audio
          console.log('🔊 Generating TTS for:', item.text.substring(0, 50));
          const response = await fetch('/api/tts/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              text: item.text, 
              voice: item.options.voice || 'alloy', 
              speed: item.options.speed || state.currentSpeed 
            })
          });

          if (!response.ok) {
            throw new Error('TTS generation failed');
          }

          audioBlob = await response.blob();
          
          // Cache for potential reuse
          if (item.text.length < 200) { // Only cache short texts
            preloadCacheRef.current.set(cacheKey, audioBlob);
          }
        }

        // Create and play audio (enforce sequential playback)
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        item.audio = audio;

        setState(prev => ({ ...prev, isLoading: false }));

        // Wait for audio to finish
        await new Promise<void>((resolve, reject) => {
          audio.onplay = () => {
            setState(prev => ({ ...prev, isPlaying: true, error: null }));
          };
          
          audio.onended = () => {
            setState(prev => ({ ...prev, isPlaying: false }));
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          
          audio.onerror = (error) => {
            console.error('Audio playback error:', error);
            setState(prev => ({ ...prev, isPlaying: false, error: 'Playback failed' }));
            URL.revokeObjectURL(audioUrl);
            reject(error);
          };

          // Always wait for playback to start; if autoplay fails, retry once after a user-gesture unlock
          const startPlayback = () => audio.play().catch(async error => {
            console.warn('Autoplay failed, attempting unlock:', error);
            try {
              const AnyContext = (window as any).AudioContext || (window as any).webkitAudioContext;
              if (AnyContext) {
                const ctx = new AnyContext();
                await ctx.resume();
              }
            } catch {}
            // Try play again (do not reject)
            audio.play().catch(() => {});
            // Continue regardless to avoid blocking queue
            resolve();
          });

          if (item.options.autoPlay === false) {
            // Not auto-playing, resolve immediately
            resolve();
          } else {
            startPlayback();
          }
        });

      } catch (error) {
        console.error('Queue processing error:', error);
        
        // Retry logic
        if (item.retries < 2) {
          item.retries++;
          queueRef.current.unshift(item); // Re-add to front of queue
          console.log(`Retrying TTS for: ${item.text.substring(0, 50)} (attempt ${item.retries + 1})`);
        } else {
          setState(prev => ({ 
            ...prev, 
            error: `Failed to play: ${item.text.substring(0, 30)}...` 
          }));
        }
      }
    }

    processingRef.current = false;
    setState(prev => ({ ...prev, isLoading: false, currentText: null }));
  }, [updateQueueLength]);

  // Process queue when items are added
  useEffect(() => {
    processQueue();
  }, [state.queueLength, processQueue]);

  // Add text to queue for processing
  const speak = useCallback((text: string, options: TTSOptions = {}) => {
    const { priority = 'normal', ...restOptions } = options;
    
    if (!text.trim() || state.isMuted) return;

    const queueItem: TTSQueueItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text: text.trim(),
      options: { autoPlay: true, ...restOptions },
      retries: 0
    };

    // Handle priority
    if (priority === 'high') {
      queueRef.current.unshift(queueItem); // Add to front
    } else {
      queueRef.current.push(queueItem); // Add to end
    }

    updateQueueLength();
    console.log('🎵 Added to TTS queue:', text.substring(0, 50), '(queue length:', queueRef.current.length, ')');
  }, [updateQueueLength]);

  // Stream text and break into sentences for real-time processing
  const speakStream = useCallback((text: string, options: TTSOptions = {}) => {
    if (!text.trim()) return;

    // Split text into sentences for faster processing
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    sentences.forEach((sentence, index) => {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length > 0) {
        // Add punctuation back except for last sentence if it didn't have any
        const hasEndPunctuation = /[.!?]$/.test(text);
        const finalSentence = index === sentences.length - 1 && !hasEndPunctuation 
          ? trimmedSentence 
          : trimmedSentence + '.';
        
        speak(finalSentence, {
          ...options,
          priority: index === 0 ? 'high' : 'normal' // First sentence gets priority
        });
      }
    });
  }, [speak]);

  const play = useCallback(() => {
    if (audioRef.current && !state.isPlaying) {
      audioRef.current.play().catch(error => {
        console.error('Play failed:', error);
        setState(prev => ({ ...prev, error: 'Playback failed' }));
      });
    }
  }, [state.isPlaying]);

  const pause = useCallback(() => {
    if (audioRef.current && state.isPlaying) {
      audioRef.current.pause();
    }
  }, [state.isPlaying]);

  const stop = useCallback(() => {
    // Stop current audio playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    // Force state update
    setState(prev => ({ ...prev, isPlaying: false, isLoading: false }));
    console.log('🛑 Audio stopped');
  }, []);

  const clearQueue = useCallback(() => {
    console.log('🗑️ Clearing TTS queue');
    queueRef.current = [];
    updateQueueLength();
  }, [updateQueueLength]);

  const cancel = useCallback(() => {
    console.log('🚫 Cancelling all TTS activity');
    
    // Cancel any ongoing request
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
      currentRequestRef.current = null;
    }

    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    // Clear queue and stop processing
    clearQueue();
    processingRef.current = false;

    // Reset all state
    setState(prev => ({
      ...prev,
      isLoading: false,
      isPlaying: false,
      error: null,
      currentText: null,
      queueLength: 0,
    }));
    
    console.log('✅ All TTS activity cancelled');
  }, [clearQueue]);

  const skipCurrent = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  // Mute/unmute functionality
  const mute = useCallback(() => {
    setState(prev => ({ ...prev, isMuted: true }));
    // Stop current playback if any
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // Clear queue when muting
    clearQueue();
    console.log('🔇 TTS muted');
  }, [clearQueue]);

  const unmute = useCallback(() => {
    setState(prev => ({ ...prev, isMuted: false }));
    console.log('🔊 TTS unmuted');
  }, []);

  const toggleMute = useCallback(() => {
    if (state.isMuted) {
      unmute();
    } else {
      mute();
    }
  }, [state.isMuted, mute, unmute]);

  // Speed control functionality
  const setSpeed = useCallback((speed: number) => {
    // Clamp speed between 0.25 and 2.0
    const clampedSpeed = Math.max(0.25, Math.min(2.0, speed));
    setState(prev => ({ ...prev, currentSpeed: clampedSpeed }));
    console.log('🏃 TTS speed set to:', clampedSpeed);
  }, []);

  const increaseSpeed = useCallback(() => {
    const newSpeed = Math.min(2.0, state.currentSpeed + 0.1);
    setSpeed(newSpeed);
  }, [state.currentSpeed, setSpeed]);

  const decreaseSpeed = useCallback(() => {
    const newSpeed = Math.max(0.25, state.currentSpeed - 0.1);
    setSpeed(newSpeed);
  }, [state.currentSpeed, setSpeed]);

  const resetSpeed = useCallback(() => {
    setSpeed(0.9); // Reset to default learning speed
  }, [setSpeed]);

  // Attempt to unlock audio on user gesture for autoplay-restricted environments
  const unlockAudio = useCallback(async () => {
    try {
      const AnyContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AnyContext) {
        const ctx = new AnyContext();
        await ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0; // silent
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.01);
      } else {
        // Fallback: try to play a silent audio element
        const el = new Audio();
        el.src = 'data:audio/mp3;base64,'; // minimal data URI; some browsers will just resolve
        await el.play().catch(() => {});
      }
      console.log('🔓 Audio context unlocked');
    } catch (e) {
      console.warn('Failed to unlock audio context:', e);
    }
  }, []);

  return {
    ...state,
    speak,
    speakStream,
    play,
    pause,
    stop,
    cancel,
    clearQueue,
    skipCurrent,
    unlockAudio,
    mute,
    unmute,
    toggleMute,
    setSpeed,
    increaseSpeed,
    decreaseSpeed,
    resetSpeed,
  };
}