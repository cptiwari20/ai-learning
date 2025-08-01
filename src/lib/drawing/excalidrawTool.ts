import { z } from "zod";
import { tool } from "@langchain/core/tools";
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/types';

// Generate unique ID for Excalidraw elements
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Human-like intelligent positioning that understands context and flow
function getSmartPosition(existingElements: ExcalidrawElement[], width = 100, height = 100, context?: string): { x: number; y: number } {
  if (!existingElements || existingElements.length === 0) {
    // Empty canvas - start from upper-left area, not center (more natural)
    return { x: 150, y: 150 };
  }

  // Analyze existing elements for patterns and relationships
  const elements = existingElements.filter(el => 
    typeof el.x === 'number' && typeof el.y === 'number'
  );

  console.log('🎯 Finding smart position for new element:', {
    existingElementsCount: elements.length,
    newElementSize: `${width}x${height}`,
    context
  });

  // Calculate occupied areas to avoid overlaps
  const occupiedAreas = elements.map(el => ({
    x: el.x!,
    y: el.y!,
    width: el.width || 100,
    height: el.height || 100,
    right: el.x! + (el.width || 100),
    bottom: el.y! + (el.height || 100)
  }));

  // Find the best position using a more reliable algorithm
  const bestPosition = findOptimalPosition(occupiedAreas, width, height);
  
  console.log('✅ Smart position found:', bestPosition);
  return bestPosition;
}

// Find optimal position using spatial region analysis
function findOptimalPosition(occupiedAreas: Array<{x: number, y: number, width: number, height: number, right: number, bottom: number}>, width: number, height: number): { x: number; y: number } {
  const canvasWidth = 1400;
  const canvasHeight = 1000;
  const regionWidth = 350; // 4x4 grid
  const regionHeight = 250;
  const padding = 60;

  console.log('🗺️ Finding position using spatial region analysis');

  // Create occupancy map of regions
  const regionOccupancy: boolean[][] = Array(4).fill(null).map(() => Array(4).fill(false));
  
  occupiedAreas.forEach(area => {
    const regionCol = Math.floor(area.x / regionWidth);
    const regionRow = Math.floor(area.y / regionHeight);
    if (regionRow >= 0 && regionRow < 4 && regionCol >= 0 && regionCol < 4) {
      regionOccupancy[regionRow][regionCol] = true;
    }
  });

  console.log('🗺️ Region occupancy map:', regionOccupancy);

  // Find first empty region (reading order: left-to-right, top-to-bottom)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (!regionOccupancy[row][col]) {
        const position = {
          x: col * regionWidth + 50,
          y: row * regionHeight + 50
        };
        console.log(`✅ Found empty region [${row}][${col}] at position:`, position);
        return position;
      }
    }
  }

  // If all regions occupied, use alternative strategies
  console.log('⚠️ All regions occupied, using alternative positioning');

  // Strategy 1: Find region with least density
  let minElements = Infinity;
  let bestRegion = { row: 0, col: 0 };
  
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const regionBounds = {
        left: col * regionWidth,
        right: (col + 1) * regionWidth,
        top: row * regionHeight,
        bottom: (row + 1) * regionHeight
      };
      
      const elementsInRegion = occupiedAreas.filter(area => 
        area.x >= regionBounds.left && area.x < regionBounds.right &&
        area.y >= regionBounds.top && area.y < regionBounds.bottom
      ).length;
      
      if (elementsInRegion < minElements) {
        minElements = elementsInRegion;
        bestRegion = { row, col };
      }
    }
  }

  // Find empty space within the least dense region
  const regionBounds = {
    left: bestRegion.col * regionWidth,
    right: (bestRegion.col + 1) * regionWidth,
    top: bestRegion.row * regionHeight,
    bottom: (bestRegion.row + 1) * regionHeight
  };

  // Grid search within the region
  for (let y = regionBounds.top + 20; y < regionBounds.bottom - height - 20; y += 30) {
    for (let x = regionBounds.left + 20; x < regionBounds.right - width - 20; x += 30) {
      const overlaps = occupiedAreas.some(area => {
        return !(x > area.right + padding || 
                x + width < area.x - padding || 
                y > area.bottom + padding || 
                y + height < area.y - padding);
      });

      if (!overlaps) {
        console.log(`✅ Found space in region [${bestRegion.row}][${bestRegion.col}] at:`, { x, y });
        return { x, y };
      }
    }
  }

  // Final fallback: extend canvas to the right
  const fallbackX = occupiedAreas.length > 0 ? 
    Math.max(...occupiedAreas.map(area => area.right)) + padding : 
    150;
  const fallbackY = 150;
  
  console.log('🚨 Using final fallback position:', { x: fallbackX, y: fallbackY });
  return { x: fallbackX, y: fallbackY };
}

// Find natural continuation points based on diagram flow and human logic
function findNaturalContinuation(elements: ExcalidrawElement[], width: number, height: number, context?: string): { x: number; y: number } | null {
  if (elements.length === 0) return null;

  // Sort elements by position to understand flow
  const sortedByX = [...elements].sort((a, b) => a.x! - b.x!);
  const sortedByY = [...elements].sort((a, b) => a.y! - b.y!);
  
  // Detect if it's a horizontal flow (flowchart, process)
  const isHorizontalFlow = detectHorizontalFlow(elements);
  // Detect if it's a vertical flow (list, steps)
  const isVerticalFlow = detectVerticalFlow(elements);
  // Detect if it's a radial pattern (mind map)
  const isRadialPattern = detectRadialPattern(elements);

  const padding = 60; // More human-like spacing

  if (isHorizontalFlow) {
    // Continue horizontally, but add some natural variation
    const rightmostElement = sortedByX[sortedByX.length - 1];
    const nextX = rightmostElement.x! + (rightmostElement.width || 100) + padding;
    
    // Add slight vertical variation to make it feel more natural
    const verticalVariation = (Math.random() - 0.5) * 20; // ±10px variation
    const baseY = rightmostElement.y! + verticalVariation;
    
    // Don't go too far right - wrap to next row if needed
    if (nextX > 1000) {
      const lowestElement = sortedByY[sortedByY.length - 1];
      return {
        x: 150 + Math.random() * 50, // Start new row with slight variation
        y: lowestElement.y! + (lowestElement.height || 100) + padding
      };
    }
    
    return { x: nextX, y: baseY };
  }

  if (isVerticalFlow) {
    // Continue vertically with slight horizontal variation
    const bottomElement = sortedByY[sortedByY.length - 1];
    const nextY = bottomElement.y! + (bottomElement.height || 100) + padding;
    
    // Add slight horizontal variation for natural feel
    const horizontalVariation = (Math.random() - 0.5) * 30; // ±15px variation
    const baseX = bottomElement.x! + horizontalVariation;
    
    return { x: Math.max(50, baseX), y: nextY };
  }

  if (isRadialPattern) {
    // Add to radial pattern by finding open space around center
    const center = findCenter(elements);
    return findRadialPosition(center, elements, width, height);
  }

  return null;
}

// Detect horizontal flow patterns (like flowcharts)
function detectHorizontalFlow(elements: ExcalidrawElement[]): boolean {
  if (elements.length < 2) return false;
  
  // Check for arrows pointing horizontally
  const arrows = elements.filter(el => el.type === 'arrow');
  const horizontalArrows = arrows.filter(el => {
    if (!el.points || el.points.length < 2) return false;
    const [start, end] = el.points as [number, number][];
    return Math.abs(end[0] - start[0]) > Math.abs(end[1] - start[1]); // More horizontal than vertical
  });
  
  if (horizontalArrows.length > 0) return true;
  
  // Check for elements arranged more horizontally than vertically
  const xSpread = Math.max(...elements.map(el => el.x!)) - Math.min(...elements.map(el => el.x!));
  const ySpread = Math.max(...elements.map(el => el.y!)) - Math.min(...elements.map(el => el.y!));
  
  return xSpread > ySpread * 1.5; // Significantly more horizontal spread
}

// Detect vertical flow patterns (like lists or vertical processes)
function detectVerticalFlow(elements: ExcalidrawElement[]): boolean {
  if (elements.length < 2) return false;
  
  // Check for arrows pointing vertically
  const arrows = elements.filter(el => el.type === 'arrow');
  const verticalArrows = arrows.filter(el => {
    if (!el.points || el.points.length < 2) return false;
    const [start, end] = el.points as [number, number][];
    return Math.abs(end[1] - start[1]) > Math.abs(end[0] - start[0]); // More vertical than horizontal
  });
  
  if (verticalArrows.length > 0) return true;
  
  // Check for elements stacked vertically
  const xSpread = Math.max(...elements.map(el => el.x!)) - Math.min(...elements.map(el => el.x!));
  const ySpread = Math.max(...elements.map(el => el.y!)) - Math.min(...elements.map(el => el.y!));
  
  return ySpread > xSpread * 1.5; // Significantly more vertical spread
}

// Detect radial patterns (like mind maps)
function detectRadialPattern(elements: ExcalidrawElement[]): boolean {
  if (elements.length < 3) return false;
  
  // Check if elements are roughly arranged around a center point
  const center = findCenter(elements);
  const distances = elements.map(el => 
    Math.sqrt(Math.pow(el.x! - center.x, 2) + Math.pow(el.y! - center.y, 2))
  );
  
  // If most elements are at similar distances from center, it's likely radial
  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
  const closeToAvg = distances.filter(d => Math.abs(d - avgDistance) < avgDistance * 0.3);
  
  return closeToAvg.length >= elements.length * 0.6; // 60% of elements at similar distance
}

// Find geometric center of elements
function findCenter(elements: ExcalidrawElement[]): { x: number; y: number } {
  const avgX = elements.reduce((sum, el) => sum + el.x!, 0) / elements.length;
  const avgY = elements.reduce((sum, el) => sum + el.y!, 0) / elements.length;
  return { x: avgX, y: avgY };
}

// Find position in radial pattern
function findRadialPosition(center: { x: number; y: number }, elements: ExcalidrawElement[], width: number, height: number): { x: number; y: number } {
  const radius = 200; // Distance from center
  const angles = elements.map(el => Math.atan2(el.y! - center.y, el.x! - center.x));
  
  // Find the largest gap between existing angles
  angles.sort((a, b) => a - b);
  let bestAngle = 0;
  let maxGap = 0;
  
  for (let i = 0; i < angles.length; i++) {
    const gap = (angles[(i + 1) % angles.length] - angles[i] + 2 * Math.PI) % (2 * Math.PI);
    if (gap > maxGap) {
      maxGap = gap;
      bestAngle = angles[i] + gap / 2;
    }
  }
  
  return {
    x: center.x + Math.cos(bestAngle) * radius,
    y: center.y + Math.sin(bestAngle) * radius
  };
}

// Find best available space when no clear pattern exists
function findBestAvailableSpace(elements: ExcalidrawElement[], width: number, height: number): { x: number; y: number } {
  const padding = 50;
  const canvasWidth = 1200;
  const canvasHeight = 800;
  
  // Create a grid of potential positions
  const gridSize = 80;
  const positions: { x: number; y: number; score: number }[] = [];
  
  for (let x = 100; x < canvasWidth - width; x += gridSize) {
    for (let y = 100; y < canvasHeight - height; y += gridSize) {
      // Check if this position overlaps with existing elements
      const overlaps = elements.some(el => {
        const elRight = el.x! + (el.width || 100);
        const elBottom = el.y! + (el.height || 100);
        const newRight = x + width;
        const newBottom = y + height;
        
        return !(x > elRight + padding || newRight < el.x! - padding || 
                y > elBottom + padding || newBottom < el.y! - padding);
      });
      
      if (!overlaps) {
        // Score based on distance from existing elements (closer is better for flow)
        const avgDistance = elements.reduce((sum, el) => {
          return sum + Math.sqrt(Math.pow(x - el.x!, 2) + Math.pow(y - el.y!, 2));
        }, 0) / elements.length;
        
        // Prefer positions that are not too far from existing content
        const score = 1000 - avgDistance;
        positions.push({ x, y, score });
      }
    }
  }
  
  if (positions.length === 0) {
    // If no good position found, go to the right of everything
    const rightmost = Math.max(...elements.map(el => el.x! + (el.width || 100)));
    return { x: rightmost + padding, y: 200 };
  }
  
  // Return position with best score (closest to existing content but not overlapping)
  positions.sort((a, b) => b.score - a.score);
  return positions[0];
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
      const textHeight = fontSize * 1.5; // Increased for better visibility
      return {
        ...baseElement,
        type: 'text',
        text: textContent,
        fontSize,
        fontFamily: 1, // Virgil (default Excalidraw font)
        textAlign: 'left' as const,
        verticalAlign: 'top' as const,
        containerId: null,
        originalText: textContent,
        autoResize: true,
        width: textWidth,
        height: textHeight,
        baseline: fontSize * 0.8, // Better baseline calculation
        lineHeight: 1.25, // Added line height for better text spacing
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
  
  console.log('🔄 Creating flowchart at position:', { startX, startY, stepsCount: steps.length });
  
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
  
  console.log('🧠 Creating mind map at position:', { centerX, centerY, branchCount: branches.length });
  
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

// Create smart arrow connecting two elements at their optimal connection points
function createSmartArrow(fromElement: ExcalidrawElement, toElement: ExcalidrawElement, color = '#1971c2'): ExcalidrawElement {
  // Calculate centers of both elements
  const fromCenter = {
    x: fromElement.x! + (fromElement.width || 100) / 2,
    y: fromElement.y! + (fromElement.height || 100) / 2
  };
  
  const toCenter = {
    x: toElement.x! + (toElement.width || 100) / 2,
    y: toElement.y! + (toElement.height || 100) / 2
  };

  // Calculate optimal connection points on the edges of the elements
  const connectionPoints = calculateConnectionPoints(fromElement, toElement);
  
  console.log('🏹 Creating smart arrow:', {
    from: `${fromElement.type} at (${Math.round(fromCenter.x)}, ${Math.round(fromCenter.y)})`,
    to: `${toElement.type} at (${Math.round(toCenter.x)}, ${Math.round(toCenter.y)})`,
    connectionPoints
  });

  // Create arrow with calculated connection points
  return createExcalidrawElement('arrow', {
    x: connectionPoints.start.x,
    y: connectionPoints.start.y,
    endX: connectionPoints.end.x,
    endY: connectionPoints.end.y,
    strokeColor: color,
    strokeWidth: 2,
    arrowhead: 'arrow'
  });
}

// Calculate optimal connection points between two elements
function calculateConnectionPoints(fromElement: ExcalidrawElement, toElement: ExcalidrawElement): {
  start: { x: number; y: number };
  end: { x: number; y: number };
} {
  const fromBounds = {
    left: fromElement.x!,
    right: fromElement.x! + (fromElement.width || 100),
    top: fromElement.y!,
    bottom: fromElement.y! + (fromElement.height || 100),
    centerX: fromElement.x! + (fromElement.width || 100) / 2,
    centerY: fromElement.y! + (fromElement.height || 100) / 2
  };

  const toBounds = {
    left: toElement.x!,
    right: toElement.x! + (toElement.width || 100),
    top: toElement.y!,
    bottom: toElement.y! + (toElement.height || 100),
    centerX: toElement.x! + (toElement.width || 100) / 2,
    centerY: toElement.y! + (toElement.height || 100) / 2
  };

  let startPoint: { x: number; y: number };
  let endPoint: { x: number; y: number };

  // Determine the relative position and choose appropriate connection points
  const dx = toBounds.centerX - fromBounds.centerX;
  const dy = toBounds.centerY - fromBounds.centerY;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection (left-right)
    if (dx > 0) {
      // From element to right element
      startPoint = { x: fromBounds.right, y: fromBounds.centerY };
      endPoint = { x: toBounds.left, y: toBounds.centerY };
    } else {
      // From element to left element
      startPoint = { x: fromBounds.left, y: fromBounds.centerY };
      endPoint = { x: toBounds.right, y: toBounds.centerY };
    }
  } else {
    // Vertical connection (top-bottom)
    if (dy > 0) {
      // From element to bottom element
      startPoint = { x: fromBounds.centerX, y: fromBounds.bottom };
      endPoint = { x: toBounds.centerX, y: toBounds.top };
    } else {
      // From element to top element
      startPoint = { x: fromBounds.centerX, y: fromBounds.top };
      endPoint = { x: toBounds.centerX, y: toBounds.bottom };
    }
  }

  return { start: startPoint, end: endPoint };
}

export const excalidrawTool = tool(
  async (input: {
    action: 'draw_rectangle' | 'draw_circle' | 'draw_line' | 'draw_text' | 'draw_arrow' | 'draw_diamond' | 'clear_canvas' | 'create_flowchart' | 'create_mindmap' | 'create_diagram' | 'connect_elements';
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
    fromElementIndex?: number; // Index of element to connect from
    toElementIndex?: number; // Index of element to connect to
    existingElements?: ExcalidrawElement[]; // Add existing elements for smart positioning
  }) => {
    const {
      action,
      x,
      y,
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
      centralTopic,
      fromElementIndex,
      toElementIndex,
      existingElements = []
    } = input;

    // Use smart positioning if x,y not provided
    const smartPos = (x === undefined || y === undefined) ? 
      getSmartPosition(existingElements, width, height) : 
      { x: x || 100, y: y || 100 };
    
    const finalX = x !== undefined ? x : smartPos.x;
    const finalY = y !== undefined ? y : smartPos.y;

    console.log('Excalidraw tool called with:', input);

    let elements: ExcalidrawElement[] = [];
    let message = '';

    try {
      switch (action) {
        case 'draw_rectangle':
          const rectangle = createExcalidrawElement('rectangle', {
            x: finalX, y: finalY, width, height, strokeColor: color, backgroundColor, strokeWidth
          });
          elements = [rectangle];
          message = `Drew a rectangle at (${finalX}, ${finalY}) with size ${width}x${height}`;
          break;

        case 'draw_circle':
          const circle = createExcalidrawElement('ellipse', {
            x: finalX, y: finalY, width: width, height: width, strokeColor: color, backgroundColor, strokeWidth
          });
          elements = [circle];
          message = `Drew a circle at (${finalX}, ${finalY}) with radius ${width/2}`;
          break;

        case 'draw_diamond':
          const diamond = createExcalidrawElement('diamond', {
            x: finalX, y: finalY, width, height, strokeColor: color, backgroundColor, strokeWidth
          });
          elements = [diamond];
          message = `Drew a diamond at (${finalX}, ${finalY}) with size ${width}x${height}`;
          break;

        case 'draw_line':
          const line = createExcalidrawElement('line', {
            x: finalX, y: finalY, endX: endX || finalX + width, endY: endY || finalY, strokeColor: color, strokeWidth
          });
          elements = [line];
          const endPosX = endX || finalX + width;
          const endPosY = endY || finalY;
          message = `Drew a line from (${finalX}, ${finalY}) to (${endPosX}, ${endPosY})`;
          break;

        case 'draw_arrow':
          const arrow = createExcalidrawElement('arrow', {
            x: finalX, y: finalY, endX: endX || finalX + width, endY: endY || finalY, strokeColor: color, strokeWidth, arrowhead: 'arrow'
          });
          elements = [arrow];
          const arrowEndX = endX || finalX + width;
          const arrowEndY = endY || finalY;
          message = `Drew an arrow from (${finalX}, ${finalY}) to (${arrowEndX}, ${arrowEndY})`;
          break;

        case 'draw_text':
          if (!text) {
            throw new Error('Text is required for draw_text action');
          }
          const textElement = createExcalidrawElement('text', {
            x: finalX, y: finalY, text, strokeColor: color, fontSize
          });
          elements = [textElement];
          message = `Added text "${text}" at (${finalX}, ${finalY})`;
          break;

        case 'create_flowchart':
          elements = createFlowchartElements({
            startX: finalX,
            startY: finalY,
            title: title || 'Process Flow',
            steps: steps || ['Start', 'Process', 'Decision', 'End']
          });
          message = `Created a flowchart with ${elements.length} elements at (${finalX}, ${finalY})`;
          break;

        case 'create_mindmap':
          elements = createMindMapElements({
            centerX: finalX + 200,
            centerY: finalY + 200,
            centralTopic: centralTopic || title || 'Central Topic',
            branches: branches || ['Idea 1', 'Idea 2', 'Idea 3', 'Idea 4']
          });
          message = `Created a mind map with central topic "${centralTopic || title || 'Central Topic'}" and ${branches?.length || 4} branches at (${finalX}, ${finalY})`;
          break;

        case 'create_diagram':
          // Generic diagram creation - can be enhanced based on context
          const diagramElements = [
            createExcalidrawElement('rectangle', {
              x: finalX, y: finalY, width: 150, height: 80, backgroundColor: '#e3f2fd', strokeColor: color
            }),
            createExcalidrawElement('text', {
              x: finalX + 10, y: finalY + 25, text: title || 'Component A', fontSize, strokeColor: color
            }),
            createExcalidrawElement('arrow', {
              x: finalX + 150, y: finalY + 40, endX: finalX + 250, endY: finalY + 40, strokeColor: color
            }),
            createExcalidrawElement('rectangle', {
              x: finalX + 250, y: finalY, width: 150, height: 80, backgroundColor: '#fff3e0', strokeColor: color
            }),
            createExcalidrawElement('text', {
              x: finalX + 260, y: finalY + 25, text: 'Component B', fontSize, strokeColor: color
            })
          ];
          elements = diagramElements;
          message = `Created a basic diagram with connected components`;
          break;

        case 'connect_elements':
          if (fromElementIndex !== undefined && toElementIndex !== undefined && 
              fromElementIndex < existingElements.length && toElementIndex < existingElements.length) {
            const fromElement = existingElements[fromElementIndex];
            const toElement = existingElements[toElementIndex];
            const connectingArrow = createSmartArrow(fromElement, toElement, color);
            elements = [connectingArrow];
            message = `Connected element ${fromElementIndex + 1} to element ${toElementIndex + 1}`;
          } else {
            throw new Error('Invalid element indices for connection');
          }
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
      action: z.enum(['draw_rectangle', 'draw_circle', 'draw_diamond', 'draw_line', 'draw_arrow', 'draw_text', 'create_flowchart', 'create_mindmap', 'create_diagram', 'connect_elements', 'clear_canvas']),
      x: z.number().optional().describe('X coordinate for the element (auto-positioned if not provided)'),
      y: z.number().optional().describe('Y coordinate for the element (auto-positioned if not provided)'),
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
      fromElementIndex: z.number().optional().describe('Index of element to connect from (for connect_elements action)'),
      toElementIndex: z.number().optional().describe('Index of element to connect to (for connect_elements action)'),
    }),
  }
);