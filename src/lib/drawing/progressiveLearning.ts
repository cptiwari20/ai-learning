// Progressive Learning System for Step-by-Step Diagram Building

export interface LearningChunk {
  id: string;
  title: string;
  explanation: string;
  diagramElements: DiagramElementSpec[];
  position: 'start' | 'continue' | 'connect' | 'expand';
  connections?: ConnectionSpec[];
}

export interface DiagramElementSpec {
  type: 'rectangle' | 'circle' | 'diamond' | 'text' | 'arrow';
  text?: string;
  color?: string;
  backgroundColor?: string;
  relativeTo?: string; // ID of existing element to position relative to
  direction?: 'right' | 'below' | 'left' | 'above' | 'diagonal';
  size?: 'small' | 'medium' | 'large';
}

export interface ConnectionSpec {
  from: string;
  to: string;
  type: 'arrow' | 'line';
  label?: string;
}

// Break down learning topics into progressive chunks
export function createLearningProgression(topic: string, complexity: 'simple' | 'medium' | 'complex' = 'medium'): LearningChunk[] {
  // This will be enhanced with AI-driven topic breakdown
  const chunkCount = complexity === 'simple' ? 3 : complexity === 'medium' ? 5 : 7;
  
  return [
    {
      id: '1',
      title: `Introduction to ${topic}`,
      explanation: `Let me start by introducing the core concept of ${topic}. This is the foundation we'll build upon.`,
      diagramElements: [
        {
          type: 'circle',
          text: topic,
          color: '#1971c2',
          backgroundColor: '#e3f2fd',
          size: 'large'
        }
      ],
      position: 'start'
    },
    {
      id: '2',
      title: 'Key Components',
      explanation: `Now let me show you the main components that make up ${topic}. Each of these plays an important role.`,
      diagramElements: [
        {
          type: 'rectangle',
          text: 'Component A',
          relativeTo: '1',
          direction: 'right',
          backgroundColor: '#fff3e0'
        },
        {
          type: 'rectangle',
          text: 'Component B',
          relativeTo: 'Component A',
          direction: 'below',
          backgroundColor: '#f3e5f5'
        }
      ],
      position: 'expand',
      connections: [
        { from: topic, to: 'Component A', type: 'arrow' },
        { from: topic, to: 'Component B', type: 'arrow' }
      ]
    }
    // More chunks would be generated dynamically based on the specific topic
  ];
}

// Generate contextual follow-up questions to continue building
export function generateFollowUpQuestions(currentChunk: LearningChunk, topic: string): string[] {
  const questions = [
    `Would you like me to show how ${currentChunk.title.toLowerCase()} connects to other aspects of ${topic}?`,
    `Should I add more details about any of these components?`,
    `Let me know if you want to dive deeper into any particular part!`,
    `Would you like to see how this applies to a real-world example?`,
    `Should I show you the next step in this process?`
  ];
  
  return questions;
}

// Determine optimal positioning for new elements
export function calculateProgressivePosition(
  existingElements: any[],
  newElement: DiagramElementSpec,
  canvasWidth = 1400,
  canvasHeight = 1000
): { x: number; y: number } {
  
  if (!existingElements.length) {
    // First element - top-left starting position with margin
    return { x: 150, y: 150 };
  }

  // Try relative positioning first if specified
  if (newElement.relativeTo) {
    const referenceElement = existingElements.find(el => 
      el.text === newElement.relativeTo || 
      el.id === newElement.relativeTo ||
      (el.text && el.text.includes(newElement.relativeTo))
    );
    
    if (referenceElement) {
      const position = calculateRelativePosition(referenceElement, newElement.direction || 'right');
      // Ensure position is within canvas bounds
      return {
        x: Math.max(50, Math.min(canvasWidth - 200, position.x)),
        y: Math.max(50, Math.min(canvasHeight - 150, position.y))
      };
    }
  }

  // Use progressive flow positioning
  return findNextProgressivePosition(existingElements, canvasWidth, canvasHeight);
}

function calculateRelativePosition(
  referenceElement: any,
  direction: 'right' | 'below' | 'left' | 'above' | 'diagonal'
): { x: number; y: number } {
  // More reasonable padding for better visual flow
  const padding = 100;
  const elementWidth = referenceElement.width || 120;
  const elementHeight = referenceElement.height || 80;
  
  // Add slight randomization to avoid perfect grid layout (more natural)
  const jitter = () => (Math.random() - 0.5) * 20;

  switch (direction) {
    case 'right':
      return {
        x: referenceElement.x + elementWidth + padding,
        y: referenceElement.y + jitter()
      };
    case 'below':
      return {
        x: referenceElement.x + jitter(),
        y: referenceElement.y + elementHeight + padding
      };
    case 'left':
      return {
        x: Math.max(50, referenceElement.x - elementWidth - padding), // Ensure not too far left
        y: referenceElement.y + jitter()
      };
    case 'above':
      return {
        x: referenceElement.x + jitter(),
        y: Math.max(50, referenceElement.y - elementHeight - padding) // Ensure not too far up
      };
    case 'diagonal':
      return {
        x: referenceElement.x + elementWidth + padding/2,
        y: referenceElement.y + elementHeight + padding/2
      };
    default:
      return { x: referenceElement.x + elementWidth + padding, y: referenceElement.y };
  }
}

function findNextProgressivePosition(
  existingElements: any[],
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  if (!existingElements.length) {
    return { x: 150, y: 150 };
  }

  // Analyze the existing layout pattern
  const elements = existingElements.filter(el => el.x != null && el.y != null);
  
  // Find the most recent element (likely the last one added)
  const lastElement = elements[elements.length - 1];
  
  // Calculate flow direction based on existing elements
  const isHorizontalFlow = detectFlowDirection(elements) === 'horizontal';
  const padding = 120;
  
  if (isHorizontalFlow) {
    // Try to continue horizontally first
    const nextX = lastElement.x + (lastElement.width || 120) + padding;
    const nextY = lastElement.y;
    
    // Check if we have room on the right
    if (nextX + 150 <= canvasWidth - 100) {
      return { x: nextX, y: nextY };
    } else {
      // Wrap to next row - find the leftmost x and go below the current row
      const currentRowY = lastElement.y;
      const elementsInRow = elements.filter(el => Math.abs(el.y - currentRowY) < 50);
      const leftmostX = Math.min(...elementsInRow.map(el => el.x));
      const maxHeightInRow = Math.max(...elementsInRow.map(el => el.height || 80));
      
      return {
        x: leftmostX,
        y: currentRowY + maxHeightInRow + padding
      };
    }
  } else {
    // Vertical flow - continue downward
    const nextX = lastElement.x;
    const nextY = lastElement.y + (lastElement.height || 80) + padding;
    
    // Check if we have room below
    if (nextY + 100 <= canvasHeight - 100) {
      return { x: nextX, y: nextY };
    } else {
      // Start new column to the right
      const rightmost = Math.max(...elements.map(el => el.x + (el.width || 120)));
      return {
        x: rightmost + padding,
        y: 150 // Start from top
      };
    }
  }
}

// Detect the primary flow direction of existing elements
function detectFlowDirection(elements: any[]): 'horizontal' | 'vertical' | 'mixed' {
  if (elements.length < 2) return 'horizontal'; // Default to horizontal for single elements
  
  const xSpread = Math.max(...elements.map(el => el.x)) - Math.min(...elements.map(el => el.x));
  const ySpread = Math.max(...elements.map(el => el.y)) - Math.min(...elements.map(el => el.y));
  
  if (xSpread > ySpread * 1.5) return 'horizontal';
  if (ySpread > xSpread * 1.5) return 'vertical';
  return 'mixed';
}

// Create learning-optimized prompts for the AI with enhanced progression
export function createProgressiveLearningPrompt(
  topic: string,
  currentChunk: number,
  totalChunks: number,
  existingElements: any[]
): string {
  const isStart = currentChunk === 1;
  const isEnd = currentChunk === totalChunks;
  const elementCount = existingElements.length;
  const phase = determineLearningPhase(currentChunk, totalChunks);
  const flowDirection = detectFlowDirection(existingElements);

  let prompt = `🎓 PROGRESSIVE LEARNING: Teaching "${topic}" step-by-step (Part ${currentChunk}/${totalChunks}). `;
  
  // Add canvas layout context
  prompt += `Canvas currently has ${elementCount} elements with ${flowDirection} flow pattern. `;

  if (isStart) {
    prompt += `🌟 FOUNDATION PHASE: Introduce the core concept with 1-2 central elements. Position at (200, 200) to leave room for expansion. Create a strong foundation that can be expanded in all directions. `;
  } else if (isEnd) {
    prompt += `🎯 COMPLETION PHASE: Add final elements that tie everything together. Connect with arrows to show relationships. Show real-world applications. Complete the learning journey with summary elements. `;
  } else {
    switch (phase) {
      case 'components':
        prompt += `🔧 COMPONENTS PHASE: Add 1-2 main components of ${topic}. Use sequential positioning (${flowDirection === 'horizontal' ? 'right of last element' : 'below last element'}). Connect with arrows to show relationships. `;
        break;
      case 'connections':
        prompt += `🔗 CONNECTIONS PHASE: Show how components relate and interact. Add connecting arrows between existing elements. Use connect_elements action for clear relationships. `;
        break;
      case 'details':
        prompt += `📋 DETAILS PHASE: Add specific features, properties, or examples around existing elements. Use relative positioning to create satellite information around main concepts. `;
        break;
      default:
        prompt += `📈 BUILD PHASE: Expand on the existing ${elementCount} elements with logical ${flowDirection} progression. Add 1-2 elements that build upon what's already there. `;
    }
  }

  prompt += `
CRITICAL PROGRESSIVE RULES:
- Add ONLY 1-2 new elements maximum per turn
- Use smart positioning: elements will auto-flow ${flowDirection === 'horizontal' ? 'left-to-right, then wrap to next row' : 'top-to-bottom, then start new column'}
- Connect new elements to existing ones with arrows when relationships exist
- Text boxes will auto-resize based on content length
- Narrate while drawing: "Now I'll add [element] to show [concept]..."
- End with specific next step: "Next, should I show you [specific concept]?"
- Elements will be positioned sequentially with proper spacing and connections
`;

  return prompt;
}

// Determine the current learning phase with enhanced granularity
function determineLearningPhase(currentChunk: number, totalChunks: number): 'foundation' | 'components' | 'connections' | 'details' | 'applications' {
  const progress = currentChunk / totalChunks;
  
  if (progress <= 0.15) return 'foundation';    // First 15% - core concepts
  if (progress <= 0.4) return 'components';     // 15-40% - main components  
  if (progress <= 0.6) return 'connections';    // 40-60% - relationships
  if (progress <= 0.85) return 'details';       // 60-85% - details & examples
  return 'applications';                        // 85-100% - real-world applications
}