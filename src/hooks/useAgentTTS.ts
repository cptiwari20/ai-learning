import { useCallback, useRef, useState } from 'react';
import { useTTS } from './useTTS';

interface LearningContext {
  currentTopic?: string;
  lastAction?: string;
  elementsCreated: number;
  learningPhase: 'introduction' | 'demonstration' | 'explanation' | 'nextSteps';
}

export function useAgentTTS() {
  const { speak, cancel, isPlaying, isLoading } = useTTS();
  const lastSpokenRef = useRef<string>('');
  const speakTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const learningContextRef = useRef<LearningContext>({
    elementsCreated: 0,
    learningPhase: 'introduction'
  });

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

    // Skip if it's just technical noise or very short
    if (cleanText.length < 30 || 
        text.includes('Drawing updated') || 
        text.includes('WebSocket') ||
        text.includes('Canvas') ||
        text.includes('🎨')) {
      console.log('❌ Skipping - technical content or too short');
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

    // Wait for drawing to complete before speaking
    speakTimeoutRef.current = setTimeout(() => {
      if (narration !== lastSpokenRef.current) {
        lastSpokenRef.current = narration;
        speak(narration, { 
          voice: 'fable', // Use warm, educational British voice
          speed: 0.9, // Slower for educational clarity
          autoPlay: true 
        });
      }
    }, 1000); // Longer delay to sync with visual completion
  }, [generateEducationalNarration, speak]);

  const speakEducationalResponse = useCallback((text: string) => {
    const educationalText = generateEducationalResponse(text);
    
    if (!educationalText || educationalText === lastSpokenRef.current) {
      console.log('🔇 Skipping TTS - no educational content or duplicate:', { 
        hasContent: !!educationalText, 
        isDuplicate: educationalText === lastSpokenRef.current 
      });
      return;
    }

    console.log('🎓 Speaking educational response:', educationalText.substring(0, 100) + '...');

    // Set learning context
    learningContextRef.current.learningPhase = 'explanation';

    // Speak with educational tone
    lastSpokenRef.current = educationalText;
    speak(educationalText, { 
      voice: 'fable', // Consistent educational voice
      speed: 0.85, // Slower for learning
      autoPlay: true 
    });
  }, [generateEducationalResponse, speak]);

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
    lastSpokenRef.current = '';
  }, [cancel]);

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
    startLearningSession,
    clearSpeech,
    testSpeak,
    isPlaying,
    isLoading,
  };
}