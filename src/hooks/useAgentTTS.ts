import { useCallback, useRef, useState } from 'react';
import { useTTS } from './useTTS';

interface LearningContext {
  currentTopic?: string;
  lastAction?: string;
  elementsCreated: number;
  learningPhase: 'introduction' | 'demonstration' | 'explanation' | 'nextSteps';
}

export function useAgentTTS() {
  const { speak, speakStream, cancel, clearQueue, isPlaying, isLoading, queueLength } = useTTS();
  const lastSpokenRef = useRef<string>('');
  const speakTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const learningContextRef = useRef<LearningContext>({
    elementsCreated: 0,
    learningPhase: 'introduction'
  });
  const processingStreamRef = useRef<boolean>(false);

  // Generate educational narration focused on the topic, not technical events
  const generateEducationalNarration = useCallback((data: { type: string; content?: string; elements?: unknown[]; message?: string }): string | null => {
    // Skip technical drawing events - focus only on educational content
    // The user wants to learn the topic, not hear about drawing actions
    return null;
  }, []);

  // Generate educational response narration - focus on content, not events
  const generateEducationalResponse = useCallback((text: string): string | null => {
    console.log('🔍 Analyzing text for educational content:', text.substring(0, 100) + '...');
    
    // Filter out technical and event messages completely
    const cleanText = text
      .replace(/[🎨🧹✅❌⚠️📡🔧]/g, '')
      .replace(/WebSocket|Canvas|API|Element|Drawing|updated|broadcast|added/gi, '')
      .replace(/Drawing updated/gi, '')
      .trim();

    console.log('🧽 Cleaned text:', cleanText.substring(0, 100) + '...');

    // More lenient filtering for conversational content
    if (cleanText.length < 15 || 
        /^(ok|okay|yes|no|sure|done|complete|finished)$/i.test(cleanText) ||
        /^[\w\s]{1,10}$/i.test(cleanText)) {
      console.log('❌ Skipping - too short or simple confirmation');
      return null;
    }

    console.log('✅ Educational content found:', cleanText.length, 'characters');
    // Only speak meaningful educational content
    return cleanText;
  }, []);

  const speakAsLearningAssistant = useCallback((data: { type: string; content?: string; elements?: unknown[]; message?: string }) => {
    const narration = generateEducationalNarration(data);
    
    if (!narration) {
      return; // Skip if no educational value
    }

    // Clear any pending speech
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
    }

    // Wait briefly before speaking for smoother experience
    speakTimeoutRef.current = setTimeout(() => {
      if (narration !== lastSpokenRef.current) {
        lastSpokenRef.current = narration;
        speak(narration, { 
          voice: 'fable', // Use warm, educational British voice
          speed: 0.9, // Slower for educational clarity
          autoPlay: true 
        });
      }
    }, 300); // Reduced delay for more responsive experience
  }, [generateEducationalNarration, speak]);

  // Stream text as it comes in for real-time conversation
  const streamEducationalResponse = useCallback((textChunk: string, isComplete: boolean = false) => {
    if (processingStreamRef.current && !isComplete) {
      return; // Skip if already processing
    }

    processingStreamRef.current = true;
    
    const educationalText = generateEducationalResponse(textChunk);
    
    if (!educationalText) {
      processingStreamRef.current = false;
      return;
    }

    console.log('🌊 Streaming TTS for chunk:', educationalText.substring(0, 50) + '...');
    
    speakStream(educationalText, { 
      voice: 'fable',
      speed: 0.9, // Faster for conversation flow
      autoPlay: true,
      priority: 'high'
    });

    if (isComplete) {
      processingStreamRef.current = false;
    } else {
      setTimeout(() => { processingStreamRef.current = false; }, 500);
    }
  }, [generateEducationalResponse, speakStream]);

  const speakEducationalResponse = useCallback((text: string, options: { streaming?: boolean } = {}) => {
    if (options.streaming) {
      streamEducationalResponse(text, true);
      return;
    }

    const educationalText = generateEducationalResponse(text);
    
    if (!educationalText) {
      console.log('🔇 Skipping TTS - no educational content');
      return;
    }

    // Check similarity to avoid near-duplicates
    const similarity = lastSpokenRef.current ? 
      calculateSimilarity(educationalText, lastSpokenRef.current) : 0;
    
    if (similarity > 0.8) {
      console.log('🔇 Skipping TTS - too similar to last response');
      return;
    }

    console.log('🎓 Speaking educational response:', educationalText.substring(0, 100) + '...');

    learningContextRef.current.learningPhase = 'explanation';
    lastSpokenRef.current = educationalText;
    
    speakStream(educationalText, { 
      voice: 'fable',
      speed: 0.88, // Conversational speed
      autoPlay: true,
      priority: 'high'
    });
  }, [generateEducationalResponse, speakStream, streamEducationalResponse]);

  // Helper function to calculate text similarity
  const calculateSimilarity = useCallback((text1: string, text2: string): number => {
    if (!text1 || !text2) return 0;
    
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = Math.max(words1.length, words2.length);
    
    return totalWords > 0 ? commonWords.length / totalWords : 0;
  }, []);

  const startLearningSession = useCallback((topic: string) => {
    learningContextRef.current = {
      currentTopic: topic,
      elementsCreated: 0,
      learningPhase: 'introduction'
    };
    
    const introduction = `Hello! I'm your visual learning assistant. Today we'll explore ${topic} together. I'll create diagrams and explain each step so you can understand both the concepts and how to visualize them effectively.`;
    
    speak(introduction, {
      voice: 'fable',
      speed: 0.85,
      autoPlay: true
    });
  }, [speak]);

  const clearSpeech = useCallback(() => {
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    cancel();
    processingStreamRef.current = false;
    lastSpokenRef.current = '';
    console.log('🗑️ Cleared all TTS speech and queue');
  }, [cancel]);

  const pauseSpeech = useCallback(() => {
    clearQueue(); // Clear pending items
    console.log('⏸️ Paused TTS speech (cleared queue)');
  }, [clearQueue]);

  const testSpeak = useCallback((testText: string = "Hello! This is a test of the learning assistant voice system.") => {
    console.log('🧪 Testing TTS system with:', testText);
    speak(testText, { 
      voice: 'fable',
      speed: 0.85,
      autoPlay: true 
    });
  }, [speak]);

  return {
    speakAsLearningAssistant,
    speakEducationalResponse,
    streamEducationalResponse,
    startLearningSession,
    clearSpeech,
    pauseSpeech,
    testSpeak,
    isPlaying,
    isLoading,
    queueLength,
  };
}