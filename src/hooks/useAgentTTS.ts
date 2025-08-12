import { useCallback, useRef, useState } from 'react';
import { useTTS } from './useTTS';

interface LearningContext {
  currentTopic?: string;
  lastAction?: string;
  elementsCreated: number;
  learningPhase: 'introduction' | 'demonstration' | 'explanation' | 'nextSteps';
}

export function useAgentTTS() {
  const { 
    speak, 
    speakStream, 
    cancel, 
    clearQueue, 
    stop,
    isPlaying, 
    isLoading, 
    queueLength, 
    unlockAudio, 
    mute, 
    unmute, 
    toggleMute, 
    isMuted,
    currentSpeed,
    setSpeed,
    increaseSpeed,
    decreaseSpeed,
    resetSpeed
  } = useTTS();
  const lastSpokenRef = useRef<string>('');
  const speakTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const learningContextRef = useRef<LearningContext>({
    elementsCreated: 0,
    learningPhase: 'introduction'
  });
  const processingStreamRef = useRef<boolean>(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());

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

    // Prefer smaller, immediate playback chunks for lower latency.
    // Split by sentence boundary or short segment.
    const segments = educationalText.split(/(?<=[.!?])\s+/).filter(Boolean);
    segments.forEach((seg, idx) => {
      const trimmed = seg.trim();
      if (!trimmed) return;
      speakStream(trimmed, {
        voice: 'fable',
        speed: 0.95,
        autoPlay: true,
        priority: idx === 0 ? 'high' : 'normal'
      });
    });

    if (isComplete) {
      processingStreamRef.current = false;
    } else {
      setTimeout(() => { processingStreamRef.current = false; }, 150);
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
    
    // best-effort unlock
    unlockAudio();

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
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }
    stop(); // Stop current audio
    cancel(); // Cancel requests  
    clearQueue(); // Clear queue
    processingStreamRef.current = false;
    lastSpokenRef.current = '';
    console.log('🗑️ Cleared all TTS speech and queue');
  }, [stop, cancel, clearQueue]);

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

  // Interactive learning engagement
  const interactionPrompts = [
    "Are you following along? Feel free to ask me to slow down or explain anything in more detail.",
    "Does this make sense so far? Let me know if you'd like me to go deeper into any part.",
    "Are you getting the concept? I can break it down further or show more examples if helpful.",
    "How are you feeling about this topic? Should we continue or would you like me to revisit something?",
    "Is the pace working for you? I can speed up or slow down based on your preference.",
    "Any questions about what we've covered? I'm here to help you understand completely.",
    "Would you like me to show a different approach or continue with this explanation?"
  ];

  const scheduleInteractionPrompt = useCallback(() => {
    // Clear existing timeout
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }

    // DISABLED: Don't automatically generate interaction prompts
    // Real teachers wait for students to ask questions, not constantly talk
    console.log('🤐 Automatic interaction prompts disabled - teacher waiting for student input');
  }, [isPlaying, speakStream, currentSpeed]);

  const resetInteractionTimer = useCallback(() => {
    lastInteractionRef.current = Date.now();
    // No longer schedule prompts - teacher waits for student
  }, []);

  // Stop learning session completely
  const stopLearningSession = useCallback(() => {
    // Clear all timeouts
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }
    
    // Stop all speech immediately
    stop(); // Stop current audio playback
    cancel(); // Cancel any requests
    clearQueue(); // Clear the queue
    
    // Reset learning context
    learningContextRef.current = {
      elementsCreated: 0,
      learningPhase: 'introduction'
    };
    
    processingStreamRef.current = false;
    lastSpokenRef.current = '';
    
    console.log('🛑 Learning session stopped completely');
  }, [stop, cancel, clearQueue]);

  // Mute learning session (keeps session active but silent)
  const muteLearningSession = useCallback(() => {
    mute();
    // Clear interaction prompts while muted
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }
    console.log('🔇 Learning session muted');
  }, [mute]);

  // Unmute and resume learning session
  const unmuteLearningSession = useCallback(() => {
    unmute();
    // Resume interaction prompts
    resetInteractionTimer();
    console.log('🔊 Learning session unmuted and resumed');
  }, [unmute, resetInteractionTimer]);

  // Enhanced learning session with speed control
  const startEnhancedLearningSession = useCallback((topic: string, preferredSpeed?: number) => {
    if (preferredSpeed) {
      setSpeed(preferredSpeed);
    }
    
    learningContextRef.current = {
      currentTopic: topic,
      elementsCreated: 0,
      learningPhase: 'introduction'
    };
    
    // best-effort unlock
    unlockAudio();

    const introduction = `Hello! I'm your visual learning assistant. Today we'll explore ${topic} together at a pace that works for you. I'll create diagrams and explain each step so you can understand both the concepts and how to visualize them effectively. If you need me to slow down or speed up, just let me know!`;
    
    speak(introduction, {
      voice: 'fable',
      speed: currentSpeed,
      autoPlay: true
    });

    // Start interaction prompts
    resetInteractionTimer();
  }, [speak, currentSpeed, unlockAudio, setSpeed, resetInteractionTimer]);

  return {
    speakAsLearningAssistant,
    speakEducationalResponse,
    streamEducationalResponse,
    startLearningSession,
    startEnhancedLearningSession,
    stopLearningSession,
    muteLearningSession,
    unmuteLearningSession,
    clearSpeech,
    pauseSpeech,
    testSpeak,
    resetInteractionTimer,
    isPlaying,
    isLoading,
    queueLength,
    isMuted,
    mute,
    unmute,
    toggleMute,
    currentSpeed,
    setSpeed,
    increaseSpeed,
    decreaseSpeed,
    resetSpeed,
  };
}