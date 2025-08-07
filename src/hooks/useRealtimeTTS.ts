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
    queueLength 
  } = useAgentTTS();
  
  const { 
    enabled = true, 
    sentenceDelay = 0,
    minSentenceLength = 10 
  } = options;

  const accumulatedTextRef = useRef<string>('');
  const processedTextRef = useRef<string>('');
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Process text stream in real-time
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

      // Find complete sentences in the new content
      const sentences = extractCompleteSentences(newContent, isComplete);
      
      if (sentences.length > 0) {
        console.log('🌊 Processing', sentences.length, 'sentences for real-time TTS');
        
        sentences.forEach((sentence, index) => {
          const trimmedSentence = sentence.trim();
          
          if (trimmedSentence.length >= minSentenceLength) {
            // Add small delay between sentences to avoid overwhelming the queue
            setTimeout(() => {
              streamEducationalResponse(trimmedSentence, index === sentences.length - 1 && isComplete);
            }, index * sentenceDelay);
            
            // Update processed text to include this sentence
            processedTextRef.current += sentence;
          }
        });
      }
      
      // If complete and there's remaining text, process it
      if (isComplete && newContent.trim().length > 0) {
        const remainingText = newContent.slice(sentences.join('').length);
        if (remainingText.trim().length >= minSentenceLength) {
          setTimeout(() => {
            streamEducationalResponse(remainingText.trim(), true);
          }, sentences.length * sentenceDelay);
          processedTextRef.current = fullText;
        }
      }
    };

    if (isComplete) {
      // Process immediately if complete
      processNow();
    } else {
      // Add small delay for streaming to allow more text to accumulate
      processingTimeoutRef.current = setTimeout(processNow, 100);
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
  };
}