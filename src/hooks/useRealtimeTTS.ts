import { useCallback, useRef, useEffect } from 'react';
import { useAgentTTS } from './useAgentTTS';

interface RealtimeTTSOptions {
  enabled?: boolean;
  sentenceDelay?: number; // Delay between sentences
  minSentenceLength?: number;
}

export function useRealtimeTTS(options: RealtimeTTSOptions = {}) {
  const { 
    speakEducationalResponse, 
    streamEducationalResponse,
    clearSpeech, 
    pauseSpeech,
    isPlaying,
    queueLength,
    isMuted,
    mute,
    unmute,
    toggleMute
  } = useAgentTTS();
  
  const { 
    enabled = true, 
    sentenceDelay = 0,
    minSentenceLength = 10 
  } = options;

  const accumulatedTextRef = useRef<string>('');
  const processedTextRef = useRef<string>('');
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Process text stream in real-time with aggressive immediate processing
  const processTextStream = useCallback((newText: string, isComplete: boolean = false) => {
    if (!enabled) return;

    // Accumulate the new text
    accumulatedTextRef.current = newText;
    
    // Clear existing timeout
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }

    const processNow = () => {
      const fullText = accumulatedTextRef.current;
      const alreadyProcessed = processedTextRef.current;
      
      // Get only the new text since last processing
      const newContent = fullText.slice(alreadyProcessed.length);
      
      if (!newContent.trim()) return;

      // More aggressive processing - even partial sentences for immediate voice
      const sentences = extractCompleteSentences(newContent, isComplete);
      
      // Also check for partial phrases that can be spoken immediately
      const partialPhrases = extractPartialPhrases(newContent);
      
      if (sentences.length > 0) {
        console.log('🌊 Processing', sentences.length, 'complete sentences for immediate TTS');
        
        sentences.forEach((sentence, index) => {
          const trimmedSentence = sentence.trim();
          
          if (trimmedSentence.length >= Math.max(5, minSentenceLength / 2)) { // Lower threshold
            // NO DELAY - immediate processing for continuous flow
            streamEducationalResponse(trimmedSentence, index === sentences.length - 1 && isComplete);
            
            // Update processed text to include this sentence
            processedTextRef.current += sentence;
          }
        });
      } else if (partialPhrases.length > 0 && !isComplete) {
        // Process partial phrases for continuous speaking
        console.log('🌊 Processing', partialPhrases.length, 'partial phrases for immediate TTS');
        partialPhrases.forEach((phrase) => {
          const trimmedPhrase = phrase.trim();
          if (trimmedPhrase.length >= 10) { // Minimum phrase length
            streamEducationalResponse(trimmedPhrase, false);
            processedTextRef.current += phrase;
          }
        });
      }
      
      // If complete and there's remaining text, process it immediately
      if (isComplete && newContent.trim().length > 0) {
        const remainingText = newContent.slice(sentences.join('').length);
        if (remainingText.trim().length >= 5) {
          streamEducationalResponse(remainingText.trim(), true);
          processedTextRef.current = fullText;
        }
      }
    };

    if (isComplete) {
      // Process immediately if complete
      processNow();
    } else {
      // Reduce delay for faster streaming - 50ms instead of 100ms
      processingTimeoutRef.current = setTimeout(processNow, 50);
    }
  }, [enabled, minSentenceLength, sentenceDelay, streamEducationalResponse]);

  // Extract complete sentences from text
  const extractCompleteSentences = useCallback((text: string, isComplete: boolean): string[] => {
    if (!text) return [];
    
    // Split on sentence endings but keep the punctuation
    const sentences = text.split(/([.!?]+\s+)/).filter(s => s.trim());
    const completeSentences: string[] = [];
    
    for (let i = 0; i < sentences.length - 1; i += 2) {
      const sentence = sentences[i];
      const punctuation = sentences[i + 1] || '';
      
      if (sentence && sentence.trim().length > 0) {
        completeSentences.push(sentence + punctuation);
      }
    }
    
    // If text is complete and there's a final sentence without ending punctuation
    if (isComplete && sentences.length % 2 === 1) {
      const lastSentence = sentences[sentences.length - 1];
      if (lastSentence && lastSentence.trim().length > 0) {
        completeSentences.push(lastSentence);
      }
    }
    
    return completeSentences;
  }, []);

  // Extract partial phrases for immediate speaking (commas, short clauses)
  const extractPartialPhrases = useCallback((text: string): string[] => {
    if (!text) return [];
    
    // Split on commas, semicolons, and natural pause points
    const phrases = text.split(/([,;]\s+|\s+and\s+|\s+but\s+|\s+or\s+|\s+so\s+)/).filter(s => s.trim());
    const speakablePhrases: string[] = [];
    
    for (let i = 0; i < phrases.length; i += 2) {
      const phrase = phrases[i];
      const connector = phrases[i + 1] || '';
      
      if (phrase && phrase.trim().length >= 10) {
        speakablePhrases.push(phrase + connector);
      }
    }
    
    return speakablePhrases;
  }, []);

  // Process complete response (fallback for non-streaming)
  const processCompleteResponse = useCallback((text: string) => {
    if (!enabled) return;
    
    console.log('📝 Processing complete response for TTS');
    speakEducationalResponse(text, { streaming: true });
  }, [enabled, speakEducationalResponse]);

  // Reset processing state
  const reset = useCallback(() => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    
    accumulatedTextRef.current = '';
    processedTextRef.current = '';
    clearSpeech();
  }, [clearSpeech]);

  // Pause current processing
  const pause = useCallback(() => {
    pauseSpeech();
  }, [pauseSpeech]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  return {
    processTextStream,
    processCompleteResponse,
    reset,
    pause,
    isPlaying,
    queueLength,
    isEnabled: enabled,
    isMuted,
    mute,
    unmute,
    toggleMute,
  };
}