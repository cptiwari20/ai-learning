import { z } from "zod";
import { tool } from "@langchain/core/tools";
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/types';

// Generate unique ID for Excalidraw elements
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Create Excalidraw element with proper formatting
function createExcalidrawElement(
  type: 'rectangle' | 'ellipse' | 'line' | 'text' | 'arrow' | 'diamond' | 'freedraw',
  options: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    text?: string;
    strokeColor?: string;
    backgroundColor?: string;
    strokeWidth?: number;
    fontSize?: number;
    points?: [number, number][];
    endX?: number;
    endY?: number;
    arrowhead?: 'arrow' | 'triangle' | 'dot' | null;
  } = {}
): ExcalidrawElement {
  const {
    x = 100,
    y = 100,
    width = 100,
    height = 100,
    text = '',
    strokeColor = '#1971c2',
    backgroundColor = 'transparent',
    strokeWidth = 2,
    fontSize = 20,
    points,
    endX,
    endY,
    arrowhead = null
  } = options;

  const elementId = generateId();
  const seed = Math.floor(Math.random() * 2147483647);
  const versionNonce = Math.floor(Math.random() * 2147483647);

  const baseElement = {
    id: elementId,
    x,
    y,
    strokeColor,
    backgroundColor,
    fillStyle: 'solid' as const,
    strokeWidth,
    strokeStyle: 'solid' as const,
    roughness: 1,
    opacity: 100,
    angle: 0,
    width,
    height,
    roundness: type === 'rectangle' ? { type: 3 } : null,
    seed,
    version: 1,
    versionNonce,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    groupIds: [] as string[],
    frameId: null,
    customData: null
  };

  switch (type) {
    case 'rectangle':
      return {
        ...baseElement,
        type: 'rectangle',
        width,
        height,
      } as ExcalidrawElement;

    case 'ellipse':
      return {
        ...baseElement,
        type: 'ellipse',
        width,
        height,
      } as ExcalidrawElement;

    case 'diamond':
      return {
        ...baseElement,
        type: 'diamond',
        width,
        height,
      } as ExcalidrawElement;

    case 'line':
      const linePoints = points || [[0, 0], [endX ? endX - x : width, endY ? endY - y : 0]];
      return {
        ...baseElement,
        type: 'line',
        points: linePoints as [number, number][],
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: null,
        width: Math.abs(linePoints[linePoints.length - 1][0] - linePoints[0][0]),
        height: Math.abs(linePoints[linePoints.length - 1][1] - linePoints[0][1]),
      } as ExcalidrawElement;

    case 'arrow':
      const arrowPoints = points || [[0, 0], [endX ? endX - x : width, endY ? endY - y : 0]];
      return {
        ...baseElement,
        type: 'arrow',
        points: arrowPoints as [number, number][],
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: arrowhead || 'arrow',
        width: Math.abs(arrowPoints[arrowPoints.length - 1][0] - arrowPoints[0][0]),
        height: Math.abs(arrowPoints[arrowPoints.length - 1][1] - arrowPoints[0][1]),
      } as ExcalidrawElement;

    case 'text':
      const textContent = text || 'Sample text';
      const textWidth = Math.max(textContent.length * (fontSize * 0.6), 50);
      const textHeight = fontSize * 1.2;
      return {
        ...baseElement,
        type: 'text',
        text: textContent,
        fontSize,
        fontFamily: 1,
        textAlign: 'left' as const,
        verticalAlign: 'top' as const,
        containerId: null,
        originalText: textContent,
        autoResize: true,
        width: textWidth,
        height: textHeight,
        baseline: fontSize,
      } as ExcalidrawElement;

    case 'freedraw':
      return {
        ...baseElement,
        type: 'freedraw',
        points: points || [[0, 0], [10, 10], [20, 0]] as [number, number][],
        pressures: [],
        simulatePressure: true,
        lastCommittedPoint: null,
      } as ExcalidrawElement;

    default:
      throw new Error(`Unknown element type: ${type}`);
  }
}

// Create complex diagrams
function createFlowchartElements(options: {
  startX?: number;
  startY?: number;
  title?: string;
  steps?: string[];
}): ExcalidrawElement[] {
  const { startX = 100, startY = 100, title = 'Flowchart', steps = ['Step 1', 'Step 2', 'Step 3'] } = options;
  const elements: ExcalidrawElement[] = [];
  let currentY = startY;
  
  // Title
  if (title) {
    elements.push(createExcalidrawElement('text', {
      x: startX,
      y: currentY,
      text: title,
      fontSize: 24,
      strokeColor: '#1971c2'
    }));
    currentY += 60;
  }
  
  // Steps with connecting arrows
  steps.forEach((step, i) => {
    // Step box
    elements.push(createExcalidrawElement('rectangle', {
      x: startX,
      y: currentY,
      width: 200,
      height: 80,
      backgroundColor: '#e3f2fd',
      strokeColor: '#1971c2'
    }));
    
    // Step text
    elements.push(createExcalidrawElement('text', {
      x: startX + 10,
      y: currentY + 25,
      text: step,
      fontSize: 16,
      strokeColor: '#1971c2'
    }));
    
    // Arrow to next step (except for last step)
    if (i < steps.length - 1) {
      elements.push(createExcalidrawElement('arrow', {
        x: startX + 100,
        y: currentY + 80,
        endX: startX + 100,
        endY: currentY + 120,
        strokeColor: '#1971c2',
        arrowhead: 'arrow'
      }));
    }
    
    currentY += 120;
  });
  
  return elements;
}

function createMindMapElements(options: {
  centerX?: number;
  centerY?: number;
  centralTopic?: string;
  branches?: string[];
}): ExcalidrawElement[] {
  const { centerX = 400, centerY = 300, centralTopic = 'Main Topic', branches = ['Branch 1', 'Branch 2', 'Branch 3', 'Branch 4'] } = options;
  const elements: ExcalidrawElement[] = [];
  
  // Central topic
  elements.push(createExcalidrawElement('ellipse', {
    x: centerX - 100,
    y: centerY - 40,
    width: 200,
    height: 80,
    backgroundColor: '#fff3e0',
    strokeColor: '#f57c00',
    strokeWidth: 3
  }));
  
  elements.push(createExcalidrawElement('text', {
    x: centerX - 80,
    y: centerY - 10,
    text: centralTopic,
    fontSize: 18,
    strokeColor: '#f57c00'
  }));
  
  // Branches
  const angleStep = (2 * Math.PI) / branches.length;
  const radius = 200;
  
  branches.forEach((branch, i) => {
    const angle = i * angleStep;
    const branchX = centerX + Math.cos(angle) * radius;
    const branchY = centerY + Math.sin(angle) * radius;
    
    // Connection line
    elements.push(createExcalidrawElement('line', {
      x: centerX,
      y: centerY,
      endX: branchX,
      endY: branchY,
      strokeColor: '#4caf50',
      strokeWidth: 2
    }));
    
    // Branch node
    elements.push(createExcalidrawElement('rectangle', {
      x: branchX - 60,
      y: branchY - 25,
      width: 120,
      height: 50,
      backgroundColor: '#e8f5e8',
      strokeColor: '#4caf50'
    }));
    
    // Branch text
    elements.push(createExcalidrawElement('text', {
      x: branchX - 50,
      y: branchY - 8,
      text: branch,
      fontSize: 14,
      strokeColor: '#2e7d32'
    }));
  });
  
  return elements;
}

export const excalidrawTool = tool(
  async (input: {
    action: 'draw_rectangle' | 'draw_circle' | 'draw_line' | 'draw_text' | 'draw_arrow' | 'draw_diamond' | 'clear_canvas' | 'create_flowchart' | 'create_mindmap' | 'create_diagram';
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    endX?: number;
    endY?: number;
    text?: string;
    color?: string;
    backgroundColor?: string;
    strokeWidth?: number;
    fontSize?: number;
    title?: string;
    steps?: string[];
    branches?: string[];
    centralTopic?: string;
  }) => {
    const {
      action,
      x = 100,
      y = 100,
      width = 100,
      height = 100,
      endX,
      endY,
      text,
      color = '#1971c2',
      backgroundColor = 'transparent',
      strokeWidth = 2,
      fontSize = 16,
      title,
      steps,
      branches,
      centralTopic
    } = input;

    console.log('Excalidraw tool called with:', input);

    let elements: ExcalidrawElement[] = [];
    let message = '';

    try {
      switch (action) {
        case 'draw_rectangle':
          const rectangle = createExcalidrawElement('rectangle', {
            x, y, width, height, strokeColor: color, backgroundColor, strokeWidth
          });
          elements = [rectangle];
          message = `Drew a rectangle at (${x}, ${y}) with size ${width}x${height}`;
          break;

        case 'draw_circle':
          const circle = createExcalidrawElement('ellipse', {
            x, y, width: width, height: width, strokeColor: color, backgroundColor, strokeWidth
          });
          elements = [circle];
          message = `Drew a circle at (${x}, ${y}) with radius ${width/2}`;
          break;

        case 'draw_diamond':
          const diamond = createExcalidrawElement('diamond', {
            x, y, width, height, strokeColor: color, backgroundColor, strokeWidth
          });
          elements = [diamond];
          message = `Drew a diamond at (${x}, ${y}) with size ${width}x${height}`;
          break;

        case 'draw_line':
          const line = createExcalidrawElement('line', {
            x, y, endX: endX || x + width, endY: endY || y, strokeColor: color, strokeWidth
          });
          elements = [line];
          const endPosX = endX || x + width;
          const endPosY = endY || y;
          message = `Drew a line from (${x}, ${y}) to (${endPosX}, ${endPosY})`;
          break;

        case 'draw_arrow':
          const arrow = createExcalidrawElement('arrow', {
            x, y, endX: endX || x + width, endY: endY || y, strokeColor: color, strokeWidth, arrowhead: 'arrow'
          });
          elements = [arrow];
          const arrowEndX = endX || x + width;
          const arrowEndY = endY || y;
          message = `Drew an arrow from (${x}, ${y}) to (${arrowEndX}, ${arrowEndY})`;
          break;

        case 'draw_text':
          if (!text) {
            throw new Error('Text is required for draw_text action');
          }
          const textElement = createExcalidrawElement('text', {
            x, y, text, strokeColor: color, fontSize
          });
          elements = [textElement];
          message = `Added text "${text}" at (${x}, ${y})`;
          break;

        case 'create_flowchart':
          elements = createFlowchartElements({
            startX: x,
            startY: y,
            title: title || 'Process Flow',
            steps: steps || ['Start', 'Process', 'Decision', 'End']
          });
          message = `Created a flowchart with ${elements.length} elements`;
          break;

        case 'create_mindmap':
          elements = createMindMapElements({
            centerX: x + 200,
            centerY: y + 200,
            centralTopic: centralTopic || title || 'Central Topic',
            branches: branches || ['Idea 1', 'Idea 2', 'Idea 3', 'Idea 4']
          });
          message = `Created a mind map with central topic "${centralTopic || title || 'Central Topic'}" and ${branches?.length || 4} branches`;
          break;

        case 'create_diagram':
          // Generic diagram creation - can be enhanced based on context
          const diagramElements = [
            createExcalidrawElement('rectangle', {
              x, y, width: 150, height: 80, backgroundColor: '#e3f2fd', strokeColor: color
            }),
            createExcalidrawElement('text', {
              x: x + 10, y: y + 25, text: title || 'Component A', fontSize, strokeColor: color
            }),
            createExcalidrawElement('arrow', {
              x: x + 150, y: y + 40, endX: x + 250, endY: y + 40, strokeColor: color
            }),
            createExcalidrawElement('rectangle', {
              x: x + 250, y, width: 150, height: 80, backgroundColor: '#fff3e0', strokeColor: color
            }),
            createExcalidrawElement('text', {
              x: x + 260, y: y + 25, text: 'Component B', fontSize, strokeColor: color
            })
          ];
          elements = diagramElements;
          message = `Created a basic diagram with connected components`;
          break;

        case 'clear_canvas':
          elements = [];
          message = 'Canvas cleared';
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      const result = {
        success: true,
        message,
        elements,
        action
      };

      console.log('Excalidraw tool result:', result);
      return JSON.stringify(result);

    } catch (error) {
      const errorResult = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        elements: [],
        action
      };
      
      console.error('Excalidraw tool error:', error);
      return JSON.stringify(errorResult);
    }
  },
  {
    name: 'excalidraw_drawing',
    description: 'Create comprehensive visual diagrams on an Excalidraw canvas. Supports basic shapes (rectangles, circles, diamonds), connectors (lines, arrows), text, and complex diagrams (flowcharts, mind maps). Use this to create detailed visual representations based on user requests.',
    schema: z.object({
      action: z.enum(['draw_rectangle', 'draw_circle', 'draw_diamond', 'draw_line', 'draw_arrow', 'draw_text', 'create_flowchart', 'create_mindmap', 'create_diagram', 'clear_canvas']),
      x: z.number().optional().describe('X coordinate for the element (default: 100)'),
      y: z.number().optional().describe('Y coordinate for the element (default: 100)'),
      width: z.number().optional().describe('Width of the element (default: 100)'),
      height: z.number().optional().describe('Height of the element (default: 100)'),
      endX: z.number().optional().describe('End X coordinate for lines and arrows'),
      endY: z.number().optional().describe('End Y coordinate for lines and arrows'),
      text: z.string().optional().describe('Text content (required for draw_text action)'),
      color: z.string().optional().describe('Stroke color (default: #1971c2)'),
      backgroundColor: z.string().optional().describe('Background color (default: transparent)'),
      strokeWidth: z.number().optional().describe('Stroke width (default: 2)'),
      fontSize: z.number().optional().describe('Font size for text (default: 16)'),
      title: z.string().optional().describe('Title for diagrams and flowcharts'),
      steps: z.array(z.string()).optional().describe('Steps for flowcharts'),
      branches: z.array(z.string()).optional().describe('Branches for mind maps'),
      centralTopic: z.string().optional().describe('Central topic for mind maps'),
    }),
  }
);