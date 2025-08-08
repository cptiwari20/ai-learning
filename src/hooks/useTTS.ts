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
    if (processingRef.current || queueRef.current.length === 0) {
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
              speed: item.options.speed || 1.0 
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

        // Create and play audio
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

          if (item.options.autoPlay !== false) {
            audio.play().catch(error => {
              console.warn('Autoplay failed, will try later:', error);
              // Don't reject, just continue
              resolve();
            });
          } else {
            resolve();
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
    
    if (!text.trim()) return;

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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  }, []);

  const clearQueue = useCallback(() => {
    console.log('🗑️ Clearing TTS queue');
    queueRef.current = [];
    updateQueueLength();
  }, [updateQueueLength]);

  const cancel = useCallback(() => {
    // Cancel any ongoing request
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
      currentRequestRef.current = null;
    }

    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Clear queue
    clearQueue();
    processingRef.current = false;

    setState({
      isLoading: false,
      isPlaying: false,
      error: null,
      currentText: null,
      queueLength: 0,
    });
  }, [clearQueue]);

  const skipCurrent = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

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
  };
}