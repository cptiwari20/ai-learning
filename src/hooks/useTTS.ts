import { useState, useRef, useCallback } from 'react';

export interface TTSOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number;
  autoPlay?: boolean;
}

export interface TTSState {
  isLoading: boolean;
  isPlaying: boolean;
  error: string | null;
  currentText: string | null;
}

export function useTTS() {
  const [state, setState] = useState<TTSState>({
    isLoading: false,
    isPlaying: false,
    error: null,
    currentText: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentRequestRef = useRef<AbortController | null>(null);

  const speak = useCallback(async (text: string, options: TTSOptions = {}) => {
    const { voice = 'alloy', speed = 1.0, autoPlay = true } = options;

    // Cancel any existing request
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Reset state
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      currentText: text,
      isPlaying: false,
    }));

    try {
      // Create abort controller for this request
      const abortController = new AbortController();
      currentRequestRef.current = abortController;

      console.log('🔊 Streaming speech for:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));

      // Try streaming endpoint first, fallback to regular if it fails
      let response;
      try {
        response = await fetch('/api/tts/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, voice, speed }),
          signal: abortController.signal,
        });
      } catch (streamError) {
        console.warn('Streaming TTS failed, falling back to regular TTS:', streamError);
        response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, voice, speed }),
          signal: abortController.signal,
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate speech');
      }

      // Convert response to blob and create audio URL (simplified approach)
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create and configure audio element
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onloadstart = () => {
        setState(prev => ({ ...prev, isLoading: true }));
      };

      audio.oncanplay = () => {
        setState(prev => ({ ...prev, isLoading: false }));
        if (autoPlay) {
          audio.play().catch(error => {
            console.error('Autoplay failed:', error);
            setState(prev => ({ ...prev, error: 'Autoplay failed. Click play to listen.' }));
          });
        }
      };

      audio.onplay = () => {
        setState(prev => ({ ...prev, isPlaying: true, error: null }));
      };

      audio.onpause = () => {
        setState(prev => ({ ...prev, isPlaying: false }));
      };

      audio.onended = () => {
        setState(prev => ({ ...prev, isPlaying: false }));
        URL.revokeObjectURL(audioUrl); // Clean up blob URL
      };

      audio.onerror = (error) => {
        console.error('Audio playback error:', error);
        setState(prev => ({ ...prev, isPlaying: false, error: 'Audio playback failed' }));
        URL.revokeObjectURL(audioUrl);
      };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('TTS request was cancelled');
        return;
      }

      console.error('TTS Error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }));
    }
  }, []);

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

    setState({
      isLoading: false,
      isPlaying: false,
      error: null,
      currentText: null,
    });
  }, []);

  return {
    ...state,
    speak,
    play,
    pause,
    stop,
    cancel,
  };
}