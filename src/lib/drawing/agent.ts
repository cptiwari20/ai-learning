import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, BaseMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { excalidrawTool } from "./excalidrawTool";
import { LearningRAGService } from "../rag/ragService";
import { createProgressiveLearningPrompt, calculateProgressivePosition } from "./progressiveLearning";
// Import broadcastDrawing dynamically to avoid circular dependency
// import { broadcastDrawing } from "@/app/api/draw/ws/route";

// Define the state structure
const DrawingState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  sessionId: Annotation<string>({
    reducer: (x, _y) => x,
  }),
  iterations: Annotation<number>({
    reducer: (x, _y) => (x || 0) + 1,
  }),
  currentElements: Annotation<unknown[]>({
    reducer: (x, y) => y || x || [],
  }),
  conversationContext: Annotation<string>({
    reducer: (x, y) => y || x || '',
  }),
  ragContext: Annotation<string>({
    reducer: (x, y) => y || x || '',
  }),
  userLearningHistory: Annotation<string>({
    reducer: (x, y) => y || x || '',
  }),
  learningProgress: Annotation<{
    topic: string;
    currentChunk: number;
    totalChunks: number;
    lastUpdate: number;
  }>({
    reducer: (x, y) => y || x || { topic: '', currentChunk: 0, totalChunks: 0, lastUpdate: 0 },
  }),
});

// Initialize the model with tools - use higher temperature for more tool usage
const model = new ChatOpenAI({
  modelName: "gpt-4o-mini", 
  temperature: 0.3,
  apiKey: process.env.OPENAI_API_KEY,
}).bindTools([excalidrawTool]);

// RAG node - retrieves relevant learning context before agent processing
async function ragNode(state: typeof DrawingState.State) {
  console.log('🔍 RAG node called - RAG retrieval temporarily disabled');
  
  // TEMPORARILY DISABLE RAG RETRIEVAL to prevent MongoDB errors
  // The learning experience will continue without historical context
  console.log('💡 Continuing without RAG context - fresh learning session');
  return { ragContext: '', userLearningHistory: '' };
}

// Extract topic from user query (simple implementation)
function extractTopicFromQuery(query: string): string {
  const lowerQuery = query.toLowerCase();
  
  // Common educational topics
  const topics = [
    'machine learning', 'data structures', 'algorithms', 'database', 'networking',
    'programming', 'javascript', 'python', 'react', 'api', 'software engineering',
    'computer science', 'mathematics', 'physics', 'chemistry', 'biology',
    'photosynthesis', 'economics', 'business', 'marketing', 'design'
  ];
  
  for (const topic of topics) {
    if (lowerQuery.includes(topic)) {
      return topic;
    }
  }
  
  // Default topic extraction
  const words = query.split(' ').filter(word => word.length > 3);
  return words[0] || 'General Learning';
}

// Agent node - handles conversation and decides when to use tools
async function agentNode(state: typeof DrawingState.State) {
  console.log(`Agent node called - iteration ${state.iterations || 0}`);
  
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  
  console.log(`Last message type: ${lastMessage?.constructor.name}`);
  console.log(`Total messages: ${messages.length}`);
  console.log(`Current elements in state: ${state.currentElements?.length || 0}`);

  // Enhanced system prompt with context awareness and RAG
  let messagesToSend = messages;
  if (messages.length === 1 && messages[0] instanceof HumanMessage) {
    const currentElementsCount = state.currentElements?.length || 0;
    const conversationSummary = state.conversationContext || '';
    const canvasDescription = describeCanvasElements(state.currentElements || []);
    const ragContext = state.ragContext || '';
    const userHistory = state.userLearningHistory || '';
    const learningProgress = state.learningProgress || { topic: '', currentChunk: 0, totalChunks: 0, lastUpdate: 0 };
    
    // Detect if this is a new topic or continuation
    const userMessage = messages[0] as HumanMessage;
    const currentTopic = extractTopicFromQuery(userMessage.content.toString());
    const isNewTopic = !learningProgress.topic || learningProgress.topic !== currentTopic;
    const isProgressive = currentElementsCount > 0 && !isNewTopic;
    
    console.log('🎨 Canvas description for AI:', canvasDescription);
    console.log('📚 RAG context available:', ragContext.length > 0);
    console.log('👤 User history available:', userHistory.length > 0);
    console.log('📈 Learning progress:', learningProgress);
    console.log('🔄 Is progressive learning:', isProgressive);
    
    // Create progressive learning context with enhanced step-by-step guidance
    let progressiveContext = '';
    if (isProgressive) {
      const nextChunk = learningProgress.currentChunk + 1;
      progressiveContext = `
🎓 PROGRESSIVE LEARNING MODE - PART ${nextChunk}:
You are continuing to teach "${learningProgress.topic}" step-by-step.
Current canvas: ${currentElementsCount} elements already exist.

CRITICAL PROGRESSIVE RULES:
1. Add ONLY 1-2 NEW elements maximum per response
2. Build logically upon what's already there - don't repeat existing concepts
3. Explain WHY you're adding each element and HOW it connects to previous elements
4. Use spatial positioning to show relationships (connect related concepts)
5. After drawing, ask specific follow-up: "Next, should I show how [new concept] affects [existing concept]?"

STEP-BY-STEP NARRATION FORMAT:
- "Now let me add [specific element] to show [specific concept]..."
- "I'm placing this [position] to demonstrate [relationship]..."
- "This connects to our previous [element] because [reason]..."
- "Next, we could explore [specific next step]. Shall I add that?"

PROGRESSIVE POSITIONING RULES:
- Place new elements logically relative to existing ones (right for next steps, below for details, arrows for connections)
- Use the progressive positioning algorithm from progressiveLearning.ts
- Create visual flow that matches the learning progression
`;
    } else if (isNewTopic) {
      progressiveContext = `
🌟 NEW TOPIC LEARNING - FOUNDATION:
Starting progressive learning for "${currentTopic}" from the beginning.

FOUNDATION RULES:
1. Create 1-2 foundational elements that represent core concepts
2. Position them for future expansion (leave space for connections and details)
3. Use clear, simple shapes with descriptive text
4. Explain the fundamental concept before drawing
5. End with specific suggestion: "Next, I can show you [specific aspect]. Would you like me to add that?"

FOUNDATION NARRATION FORMAT:
- "Let me start by introducing the core concept of [topic]..."
- "I'll create [specific element] to represent [fundamental idea]..."
- "This foundation will let us build [specific future elements]..."
- "Should I now show you [next logical step]?"
`;
    }
    
    const systemPrompt = new AIMessage(`You are an educational visual learning assistant. The student asked about "${(messages[0] as HumanMessage).content}". 

Your role is to:
1. FIRST: Provide a clear, educational explanation about the topic
2. THEN: Call the excalidraw_drawing tool to create a visual aid

Response format:
- Start with educational content explaining the concept
- Use simple, clear language appropriate for learning
- Focus on key insights and understanding
- Then silently call the drawing tool to add visual elements

Example response:
"Photosynthesis is the amazing process plants use to make their own food! Plants take in sunlight, water, and carbon dioxide from the air, then convert these into glucose (sugar) and oxygen. This is why plants are so important - they literally create the oxygen we breathe while making food for themselves.

The process happens mainly in the leaves, where special cells called chloroplasts contain chlorophyll - the green substance that captures sunlight. It's like nature's solar panels!"

Then call excalidraw_drawing with action: "draw_circle" and text: "Photosynthesis Process"

Canvas currently has ${currentElementsCount} elements. Focus on teaching the concept first, then add visual elements to support learning.`);
    
    messagesToSend = [systemPrompt, ...messages];
  }

  try {
    // Allow the model to provide educational content and then use tools as needed
    const response = await model.invoke(messagesToSend);
    console.log(`Model response type: ${response.constructor.name}`);
    console.log(`Has tool calls: ${(response as AIMessage & { tool_calls?: unknown[] }).tool_calls?.length || 0}`);
    
    // Keep educational explanations - don't clear content for learning assistant
    // The user wants to learn the topic, so preserve the educational explanation
    
    // Extract topic and determine if this is a new topic or continuation
    const userMessage = messages.find(m => m instanceof HumanMessage);
    const currentTopic = userMessage ? extractTopicFromQuery(userMessage.content.toString()) : 'General Learning';
    const learningProgress = state.learningProgress || { topic: '', currentChunk: 0, totalChunks: 0, lastUpdate: 0 };
    const isNewTopic = !learningProgress.topic || learningProgress.topic !== currentTopic;
    
    // Update learning progress
    const newProgress = isNewTopic ? {
      topic: currentTopic,
      currentChunk: 1,
      totalChunks: 5, // Default - could be made dynamic
      lastUpdate: Date.now()
    } : {
      ...learningProgress,
      currentChunk: Math.min(learningProgress.currentChunk + 1, learningProgress.totalChunks),
      lastUpdate: Date.now()
    };

    return {
      messages: [response],
      iterations: 1,
      learningProgress: newProgress
    };
  } catch (error) {
    console.error('Error in agent node:', error);
    const errorMessage = new AIMessage("I encountered an error while processing your request. Please try again.");
    return {
      messages: [errorMessage],
      iterations: 1
    };
  }
}

// Tool node - executes tools when called by the agent
async function toolNode(state: typeof DrawingState.State) {
  console.log('Tool node called');
  
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1] as AIMessage;
  
  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    console.log('No tool calls found in last message');
    return { messages: [] };
  }

  const toolMessages: ToolMessage[] = [];

  for (const toolCall of lastMessage.tool_calls) {
    console.log(`Executing tool: ${toolCall.name} with ID: ${toolCall.id}`);
    
    try {
      if (toolCall.name === 'excalidraw_drawing') {
        // Always fetch the latest canvas state to avoid overlaps
        const latestElements = await getCurrentCanvasState();
        
        // Get user context from the most recent human message
        const userMessage = state.messages.find(m => m instanceof HumanMessage);
        const userContext = userMessage ? userMessage.content.toString() : '';
        
        const enhancedArgs = {
          ...toolCall.args,
          existingElements: (latestElements || []) as unknown[],
          userContext: userContext // Pass user context for focus positioning
        };
        
        const result = await excalidrawTool.invoke(enhancedArgs);
        console.log('Tool execution result:', result);
        
        const toolMessage = new ToolMessage(result, toolCall.id);
        toolMessages.push(toolMessage);
      } else {
        console.warn(`Unknown tool: ${toolCall.name}`);
        const errorMessage = new ToolMessage(
          JSON.stringify({ success: false, message: `Unknown tool: ${toolCall.name}`, elements: [] }),
          toolCall.id
        );
        toolMessages.push(errorMessage);
      }
    } catch (error) {
      console.error(`Error executing tool ${toolCall.name}:`, error);
      const errorMessage = new ToolMessage(
        JSON.stringify({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Tool execution failed',
          elements: [] 
        }),
        toolCall.id
      );
      toolMessages.push(errorMessage);
    }
  }

  console.log(`Created ${toolMessages.length} tool messages`);
  return { messages: toolMessages };
}

// Router function - decides next step based on current state
function shouldContinue(state: typeof DrawingState.State): string {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  const iterations = state.iterations || 0;

  console.log(`Router: Last message type: ${lastMessage?.constructor.name}`);
  console.log(`Router: Iterations: ${iterations}`);

  // Safety check - prevent infinite loops
  if (iterations > 10) {
    console.log('Router: Max iterations reached, ending');
    return END;
  }

  // If last message is AI with tool calls, go to tool node
  if (lastMessage instanceof AIMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    console.log('Router: Going to tool node');
    return 'tools';
  }

  // If last message is a tool message, continue conversation with agent
  if (lastMessage instanceof ToolMessage) {
    console.log('Router: Going back to agent');
    return 'agent';
  }

  // Otherwise, end the conversation
  console.log('Router: Ending conversation');
  return END;
}

// Storage node - saves the conversation to RAG after completion
async function storageNode(state: typeof DrawingState.State) {
  console.log('💾 Storage node called - RAG storage temporarily disabled');
  
  // TEMPORARILY DISABLE RAG STORAGE to prevent MongoDB errors
  // This ensures the learning experience is not interrupted
  console.log('💡 Learning session completed successfully without storage');
  return {};
}

// Build the graph with RAG integration
const graph = new StateGraph(DrawingState)
  .addNode('rag', ragNode)
  .addNode('agent', agentNode)
  .addNode('tools', toolNode)
  .addNode('storage', storageNode)
  .addEdge(START, 'rag')
  .addEdge('rag', 'agent')
  .addConditionalEdges('agent', shouldContinue, {
    tools: 'tools',
    [END]: 'storage',
  })
  .addConditionalEdges('tools', shouldContinue, {
    agent: 'agent',
    [END]: 'storage',
  })
  .addEdge('storage', END);

const compiledGraph = graph.compile();

// Session storage for context persistence
const sessionContexts = new Map<string, {
  elements: unknown[];
  conversationHistory: string;
  lastUpdate: number;
}>();

// Function to get current canvas state from WebSocket server
async function getCurrentCanvasState(): Promise<unknown[]> {
  try {
    // Import directly from WS module to avoid server-side fetch URL issues
    const { getCanvasState } = await import('@/app/api/draw/ws/route');
    const elements = getCanvasState();
    console.log('📋 Retrieved current canvas state (direct):', elements.length, 'elements');
    return elements as unknown[];
  } catch (error) {
    console.warn('Failed to get canvas state:', error);
  }
  return [];
}

// Force synchronization of canvas state before agent execution
async function syncCanvasState(sessionId: string): Promise<unknown[]> {
  console.log('🔄 Synchronizing canvas state for session:', sessionId);
  
  // Get fresh canvas state from WebSocket
  const canvasElements = await getCurrentCanvasState();
  
  // Update session context immediately
  const existingContext = sessionContexts.get(sessionId);
  if (existingContext) {
    sessionContexts.set(sessionId, {
      ...existingContext,
      elements: canvasElements,
      lastUpdate: Date.now()
    });
  }
  
  console.log('✅ Canvas state synchronized:', canvasElements.length, 'elements');
  return canvasElements;
}

// Enhanced context analysis for RAG-like capabilities
function analyzeCanvasContext(elements: unknown[]): string {
  if (!elements || elements.length === 0) {
    return 'Canvas is empty. Ready for new content.';
  }

  const analysisPoints: string[] = [];
  let textElements = 0;
  let shapeElements = 0;
  let flowchartLike = false;
  let mindmapLike = false;
  
  // Analyze element types and patterns
  elements.forEach((el: any) => {
    if (el?.type === 'text') {
      textElements++;
    } else if (['rectangle', 'ellipse', 'diamond'].includes(el?.type)) {
      shapeElements++;
    } else if (el?.type === 'arrow') {
      flowchartLike = true;
    }
  });
  
  // Detect patterns
  if (shapeElements > 2 && flowchartLike) {
    analysisPoints.push('Contains a flowchart or process diagram structure');
  }
  if (textElements > shapeElements) {
    analysisPoints.push('Text-heavy content, suitable for annotations or labels');
  }
  if (shapeElements > 0 && !flowchartLike) {
    analysisPoints.push('Contains standalone shapes, good for building diagrams');
  }
  
  analysisPoints.push(`Has ${elements.length} total elements (${textElements} text, ${shapeElements} shapes)`);
  
  return analysisPoints.join('. ') + '.';
}

// Convert canvas elements to detailed descriptions for AI context with spatial intelligence
function describeCanvasElements(elements: unknown[]): string {
  if (!elements || elements.length === 0) {
    return 'CURRENT CANVAS: Empty canvas with no elements. Start from upper-left area (150, 150) for natural flow.';
  }

  const validElements = elements.filter((el: any) => el && typeof el === 'object');
  
  // Create spatial map of the canvas
  const spatialMap = createSpatialMap(validElements);
  const descriptions: string[] = ['CURRENT CANVAS SPATIAL MAP:'];
  
  // Describe the spatial layout
  descriptions.push(`Canvas has ${validElements.length} elements distributed across ${spatialMap.regions.length} regions`);
  
  // Describe each spatial region
  spatialMap.regions.forEach((region, index) => {
    descriptions.push(`Region ${index + 1} (${region.bounds.left}-${region.bounds.right}, ${region.bounds.top}-${region.bounds.bottom}): ${region.elements.length} elements`);
    region.elements.forEach((el: any) => {
      const desc = `  - ${el.type}${el.text ? ` "${el.text}"` : ''} at (${Math.round(el.x)}, ${Math.round(el.y)})`;
      descriptions.push(desc);
    });
  });
  
  // Analyze connections and relationships
  const connections = analyzeElementConnections(validElements);
  if (connections.length > 0) {
    descriptions.push('\nEXISTING CONNECTIONS:');
    connections.forEach(conn => {
      descriptions.push(`  - ${conn.from.type} → ${conn.to.type} (${conn.relationship})`);
    });
  }
  
  // Find optimal areas for new content
  const optimalAreas = findOptimalAreasForNewContent(spatialMap);
  descriptions.push('\nOPTIMAL AREAS FOR NEW CONTENT:');
  optimalAreas.forEach((area, index) => {
    descriptions.push(`  ${index + 1}. (${area.x}, ${area.y}) - ${area.reason}`);
  });
  
  // Suggest connection opportunities
  const connectionOpportunities = suggestConnectionOpportunities(validElements);
  if (connectionOpportunities.length > 0) {
    descriptions.push('\nCONNECTION OPPORTUNITIES (USE THESE EXACT ACTIONS):');
    connectionOpportunities.forEach((opp, index) => {
      descriptions.push(`  ${index + 1}. ${opp.action}`);
      descriptions.push(`     - Connects: ${opp.from} → ${opp.to}`);
      descriptions.push(`     - Direction: ${opp.type}`);
    });
  }
  
  return descriptions.join('\n');
}

// Create spatial map dividing canvas into regions
function createSpatialMap(elements: any[]): { regions: Array<{ bounds: { left: number, right: number, top: number, bottom: number }, elements: any[] }> } {
  const canvasWidth = 1400;
  const canvasHeight = 1000;
  const regionWidth = 350; // Divide into 4x3 grid
  const regionHeight = 250;
  
  const regions: Array<{ bounds: { left: number, right: number, top: number, bottom: number }, elements: any[] }> = [];
  
  // Create grid regions
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const bounds = {
        left: col * regionWidth,
        right: (col + 1) * regionWidth,
        top: row * regionHeight,
        bottom: (row + 1) * regionHeight
      };
      
      const regionElements = elements.filter((el: any) => {
        return el.x >= bounds.left && el.x < bounds.right && 
               el.y >= bounds.top && el.y < bounds.bottom;
      });
      
      if (regionElements.length > 0) {
        regions.push({ bounds, elements: regionElements });
      }
    }
  }
  
  return { regions };
}

// Analyze connections between elements
function analyzeElementConnections(elements: any[]): Array<{ from: any, to: any, relationship: string }> {
  const connections: Array<{ from: any, to: any, relationship: string }> = [];
  const arrows = elements.filter((el: any) => el.type === 'arrow');
  
  arrows.forEach((arrow: any) => {
    // Find elements that this arrow connects
    const startPoint = { x: arrow.x, y: arrow.y };
    const endPoint = { 
      x: arrow.x + (arrow.points?.[arrow.points.length - 1]?.[0] || 0),
      y: arrow.y + (arrow.points?.[arrow.points.length - 1]?.[1] || 0)
    };
    
    // Find nearest elements to start and end points
    const fromElement = findNearestElement(startPoint, elements.filter(el => el !== arrow));
    const toElement = findNearestElement(endPoint, elements.filter(el => el !== arrow));
    
    if (fromElement && toElement) {
      connections.push({
        from: fromElement,
        to: toElement,
        relationship: 'arrow connection'
      });
    }
  });
  
  return connections;
}

// Find nearest element to a point
function findNearestElement(point: { x: number, y: number }, elements: any[]): any | null {
  let nearest = null;
  let minDistance = Infinity;
  
  elements.forEach((el: any) => {
    const centerX = el.x + (el.width || 100) / 2;
    const centerY = el.y + (el.height || 100) / 2;
    const distance = Math.sqrt(Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2));
    
    if (distance < minDistance && distance < 100) { // Within 100px
      minDistance = distance;
      nearest = el;
    }
  });
  
  return nearest;
}

// Find optimal areas for new content based on spatial map
function findOptimalAreasForNewContent(spatialMap: any): Array<{ x: number, y: number, reason: string }> {
  const areas: Array<{ x: number, y: number, reason: string }> = [];
  
  // Find empty regions
  const canvasWidth = 1400;
  const canvasHeight = 1000;
  const regionWidth = 350;
  const regionHeight = 250;
  
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const bounds = {
        left: col * regionWidth,
        right: (col + 1) * regionWidth,
        top: row * regionHeight,
        bottom: (row + 1) * regionHeight
      };
      
      const hasElements = spatialMap.regions.some((region: any) => 
        region.bounds.left === bounds.left && region.bounds.top === bounds.top
      );
      
      if (!hasElements) {
        areas.push({
          x: bounds.left + 50,
          y: bounds.top + 50,
          reason: `Empty region ${row + 1},${col + 1} - ideal for new content`
        });
      }
    }
  }
  
  // If no empty regions, suggest areas adjacent to existing content
  if (areas.length === 0 && spatialMap.regions.length > 0) {
    const lastRegion = spatialMap.regions[spatialMap.regions.length - 1];
    areas.push({
      x: lastRegion.bounds.right + 50,
      y: lastRegion.bounds.top + 50,
      reason: 'Adjacent to existing content - natural continuation'
    });
  }
  
  return areas;
}

// Suggest connection opportunities between elements
function suggestConnectionOpportunities(elements: any[]): Array<{ from: string, to: string, type: string, fromIndex: number, toIndex: number, action: string }> {
  const opportunities: Array<{ from: string, to: string, type: string, fromIndex: number, toIndex: number, action: string }> = [];
  
  // Filter to only valid, connectable elements first
  const validElements = elements.filter((el: any) => 
    el && el.type && typeof el.x === 'number' && typeof el.y === 'number'
  );
  
  const shapes = validElements.filter((el: any) => ['rectangle', 'ellipse', 'diamond'].includes(el.type));
  
  console.log('🔗 Connection analysis:', {
    totalElements: elements.length,
    validElements: validElements.length,
    connectableShapes: shapes.length
  });
  
  if (shapes.length < 2) {
    console.log('🔗 Not enough shapes for connections');
    return [];
  }
  
  // Check if elements are already connected by existing arrows
  const existingConnections = new Set();
  const arrows = validElements.filter((el: any) => el.type === 'arrow');
  
  arrows.forEach((arrow: any) => {
    // Find which elements this arrow connects
    const startPoint = { x: arrow.x, y: arrow.y };
    const endPoint = { 
      x: arrow.x + (arrow.points?.[arrow.points.length - 1]?.[0] || 0),
      y: arrow.y + (arrow.points?.[arrow.points.length - 1]?.[1] || 0)
    };
    
    const fromEl = findNearestElement(startPoint, shapes);
    const toEl = findNearestElement(endPoint, shapes);
    
    if (fromEl && toEl) {
      const fromIdx = shapes.indexOf(fromEl);
      const toIdx = shapes.indexOf(toEl);
      existingConnections.add(`${fromIdx}-${toIdx}`);
      existingConnections.add(`${toIdx}-${fromIdx}`); // Bidirectional
    }
  });
  
  // Look for disconnected elements that could be connected
  for (let i = 0; i < shapes.length - 1; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      // Skip if already connected
      if (existingConnections.has(`${i}-${j}`)) {
        continue;
      }
      
      const el1 = shapes[i];
      const el2 = shapes[j];
      
      // Check if elements are aligned horizontally or vertically
      const horizontallyAligned = Math.abs(el1.y - el2.y) < 50;
      const verticallyAligned = Math.abs(el1.x - el2.x) < 50;
      
      if (horizontallyAligned || verticallyAligned) {
        const distance = Math.sqrt(Math.pow(el1.x - el2.x, 2) + Math.pow(el1.y - el2.y, 2));
        if (distance > 100 && distance < 500) { // Good distance for connection
          // Use indices within the validElements array, not the original elements array
          const validFromIndex = validElements.indexOf(el1);
          const validToIndex = validElements.indexOf(el2);
          
          console.log('🔗 Found connection opportunity:', {
            from: validFromIndex,
            to: validToIndex,
            fromElement: el1.text || el1.type,
            toElement: el2.text || el2.type
          });
          
          opportunities.push({
            from: el1.text || `${el1.type} at (${Math.round(el1.x)}, ${Math.round(el1.y)})`,
            to: el2.text || `${el2.type} at (${Math.round(el2.x)}, ${Math.round(el2.y)})`,
            type: horizontallyAligned ? 'horizontal arrow' : 'vertical arrow',
            fromIndex: validFromIndex,
            toIndex: validToIndex,
            action: `connect_elements with fromElementIndex: ${validFromIndex}, toElementIndex: ${validToIndex}`
          });
        }
      }
    }
  }
  
  return opportunities.slice(0, 4); // Limit to top 4 suggestions
}

// Get relative position description
function getPositionDescription(x: number, y: number, elements: any[], currentIndex: number): string {
  if (currentIndex === 0) return ' (starting point)';
  
  const prevElement = elements[currentIndex - 1];
  if (!prevElement) return '';
  
  const dx = x - prevElement.x;
  const dy = y - prevElement.y;
  
  if (Math.abs(dy) < 30) { // Same row
    return dx > 0 ? ' (to the right)' : ' (to the left)';
  } else if (Math.abs(dx) < 30) { // Same column
    return dy > 0 ? ' (below)' : ' (above)';
  } else {
    return dx > 0 && dy > 0 ? ' (down-right)' : 
           dx > 0 && dy < 0 ? ' (up-right)' :
           dx < 0 && dy > 0 ? ' (down-left)' : ' (up-left)';
  }
}

// Analyze the pattern and flow of existing elements
function analyzePatternAndFlow(elements: any[]): string {
  if (elements.length < 2) {
    return '\nPATTERN: Single element - can expand in any logical direction';
  }
  
  const arrows = elements.filter((el: any) => el.type === 'arrow');
  const shapes = elements.filter((el: any) => ['rectangle', 'ellipse', 'diamond'].includes(el.type));
  const texts = elements.filter((el: any) => el.type === 'text');
  
  // Analyze spatial arrangement
  const xPositions = elements.map((el: any) => el.x).sort((a, b) => a - b);
  const yPositions = elements.map((el: any) => el.y).sort((a, b) => a - b);
  
  const xSpread = xPositions[xPositions.length - 1] - xPositions[0];
  const ySpread = yPositions[yPositions.length - 1] - yPositions[0];
  
  let pattern = '\nPATTERN: ';
  
  if (arrows.length > 0 && shapes.length > 1) {
    if (xSpread > ySpread * 1.5) {
      pattern += 'Horizontal flowchart/process - continues rightward or wraps to next row';
    } else if (ySpread > xSpread * 1.5) {
      pattern += 'Vertical flowchart/process - continues downward';
    } else {
      pattern += 'Multi-directional diagram - can expand in multiple directions';
    }
  } else if (shapes.length > 2 && arrows.length === 0) {
    pattern += 'Collection of shapes - good for connecting with arrows or grouping';
  } else if (texts.length > shapes.length) {
    pattern += 'Text-heavy content - good for adding visual elements or structure';
  } else {
    pattern += 'Mixed content - can be extended logically based on context';
  }
  
  return pattern;
}

// Suggest natural continuation areas
function suggestContinuationAreas(elements: any[]): string {
  if (elements.length === 0) return '';
  
  const xPositions = elements.map((el: any) => el.x + (el.width || 100));
  const yPositions = elements.map((el: any) => el.y + (el.height || 100));
  
  const rightmost = Math.max(...xPositions);
  const bottommost = Math.max(...yPositions);
  const leftmost = Math.min(...elements.map((el: any) => el.x));
  const topmost = Math.min(...elements.map((el: any) => el.y));
  
  const suggestions: string[] = [];
  
  // Suggest continuation areas based on existing layout
  if (rightmost < 1000) {
    suggestions.push(`right of (${rightmost + 60}, ${topmost + 50})`);
  }
  
  if (bottommost < 600) {
    suggestions.push(`below (${leftmost + 50}, ${bottommost + 60})`);
  }
  
  // Check for gaps in the middle
  const midX = (leftmost + rightmost) / 2;
  const midY = (topmost + bottommost) / 2;
  
  const hasElementInMiddle = elements.some((el: any) => 
    Math.abs(el.x - midX) < 100 && Math.abs(el.y - midY) < 100
  );
  
  if (!hasElementInMiddle && elements.length > 2) {
    suggestions.push(`center area (${Math.round(midX)}, ${Math.round(midY)})`);
  }
  
  return `\nNATURAL CONTINUATION: Best areas - ${suggestions.join(', ')}`;
}

// Main function to run the drawing agent
export async function runDrawingAgent(
  message: string,
  sessionId: string,
  onDrawingEvent?: (elements: unknown[], message: string) => void,
  frontendCanvasElements?: unknown[]
): Promise<{ messages: BaseMessage[] }> {
  console.log('Starting drawing agent for session:', sessionId);
  console.log('User message:', message);

  // Use frontend canvas elements if provided, otherwise sync from WebSocket server
  const currentCanvasElements = frontendCanvasElements && frontendCanvasElements.length > 0 ? 
    frontendCanvasElements : 
    await syncCanvasState(sessionId);
  
  console.log('🎯 Using canvas elements:', { 
    fromFrontend: !!frontendCanvasElements && frontendCanvasElements.length > 0,
    elementsCount: currentCanvasElements.length 
  });
  const existingContext = sessionContexts.get(sessionId);
  
  // Enhanced context analysis using RAG-like approach
  const actualElementCount = currentCanvasElements.length;
  const canvasAnalysis = analyzeCanvasContext(currentCanvasElements);
  const conversationSummary = existingContext ? 
    `Previous requests: ${existingContext.conversationHistory}. Canvas analysis: ${canvasAnalysis}` : 
    `First request in session. Canvas analysis: ${canvasAnalysis}`;

  const initialState = {
    messages: [new HumanMessage(message)],
    sessionId,
    iterations: 0,
    currentElements: currentCanvasElements, // Use real canvas state
    conversationContext: conversationSummary,
    ragContext: '',
    userLearningHistory: '',
    learningProgress: { topic: '', currentChunk: 0, totalChunks: 0, lastUpdate: 0 },
  };

  try {
    const result = await compiledGraph.invoke(initialState);
    console.log('Agent completed with', result.messages.length, 'total messages');

    // Extract drawing events from tool results and call the callback
    let allElements: unknown[] = existingContext?.elements || [];
    
    if (onDrawingEvent) {
      for (const msg of result.messages) {
        if (msg instanceof ToolMessage) {
          try {
            const toolResult = JSON.parse(msg.content) as { success: boolean; elements?: unknown[]; message: string };
            if (toolResult.success && toolResult.elements && toolResult.elements.length > 0) {
              // APPEND new elements instead of replacing all elements
              const newElements = toolResult.elements as unknown[];
              allElements = [...allElements, ...newElements]; // Append, don't replace
              
              // Broadcast ONLY the new elements to WebSocket clients (append mode)
              console.log('🚀 Adding NEW drawing elements via WebSocket (append only):', newElements.length);
              try {
                const { addDrawingElements } = await import("@/app/api/draw/ws/route");
                addDrawingElements(newElements, toolResult.message || 'Elements added');
              } catch (error) {
                console.error('❌ Non-streaming WebSocket add failed:', error);
              }
              
              // Send only new elements to callback (frontend will append) - no message to avoid chat clutter
              onDrawingEvent(newElements, '');
            }
          } catch (e) {
            console.warn('Failed to parse tool result:', e);
          }
        }
      }
    }

    // Update session context with final canvas state
    const finalCanvasState = await getCurrentCanvasState();
    const currentContext = sessionContexts.get(sessionId) || { elements: [], conversationHistory: '', lastUpdate: 0 };
    sessionContexts.set(sessionId, {
      elements: finalCanvasState, // Use actual final canvas state
      conversationHistory: currentContext.conversationHistory + ` | ${message}`,
      lastUpdate: Date.now()
    });

    return { messages: result.messages };
  } catch (error) {
    console.error('Error running drawing agent:', error);
    const errorMessage = new AIMessage("I encountered an error while processing your drawing request. Please try again.");
    return { messages: [new HumanMessage(message), errorMessage] };
  }
}

// Stream version for real-time updates
export async function streamDrawingAgent(
  message: string,
  sessionId: string,
  onUpdate: (data: { type: string; content?: string; elements?: unknown[]; message?: string }) => void,
  frontendCanvasElements?: unknown[]
): Promise<void> {
  console.log('Starting streaming drawing agent for session:', sessionId);

  // Use frontend canvas elements if provided, otherwise sync from WebSocket server
  const currentCanvasElements = frontendCanvasElements && frontendCanvasElements.length > 0 ? 
    frontendCanvasElements : 
    await syncCanvasState(sessionId);
  
  console.log('🎯 Using canvas elements:', { 
    fromFrontend: !!frontendCanvasElements && frontendCanvasElements.length > 0,
    elementsCount: currentCanvasElements.length 
  });
  const existingContext = sessionContexts.get(sessionId);
  
  // Enhanced context analysis using RAG-like approach
  const actualElementCount = currentCanvasElements.length;
  const canvasAnalysis = analyzeCanvasContext(currentCanvasElements);
  const conversationSummary = existingContext ? 
    `Previous requests: ${existingContext.conversationHistory}. Canvas analysis: ${canvasAnalysis}` : 
    `First request in session. Canvas analysis: ${canvasAnalysis}`;

  const initialState = {
    messages: [new HumanMessage(message)],
    sessionId,
    iterations: 0,
    currentElements: currentCanvasElements, // Use real canvas state
    conversationContext: conversationSummary,
    ragContext: '',
    userLearningHistory: '',
    learningProgress: { topic: '', currentChunk: 0, totalChunks: 0, lastUpdate: 0 },
  };

  try {
    const stream = await compiledGraph.stream(initialState);
    let allElements: unknown[] = existingContext?.elements || [];

    for await (const chunk of stream) {
      console.log('🌊 Stream chunk received:', Object.keys(chunk));
      console.log('🌊 Chunk details:', JSON.stringify(chunk, null, 2));

      // Handle agent responses - stream text IMMEDIATELY, don't wait for tools
      if (chunk.agent) {
        const messages = chunk.agent.messages;
        for (const msg of messages) {
          if (msg instanceof AIMessage && typeof msg.content === 'string') {
            if (msg.content.trim()) {
              // Send message immediately for continuous narration
              onUpdate({ 
                type: 'message', 
                content: msg.content,
                syncData: {
                  timestamp: Date.now(),
                  shouldNarrate: true,
                  priority: 'immediate' // High priority for continuous flow
                }
              });
            }
          }
        }
      }

      // Handle tool results
      if (chunk.tools) {
        console.log('🔧 Processing tools chunk with', chunk.tools.messages.length, 'messages');
        const messages = chunk.tools.messages;
        for (const msg of messages) {
          console.log('🔧 Processing message:', msg.constructor.name);
          if (msg instanceof ToolMessage) {
            console.log('🔧 Found ToolMessage, processing...');
            try {
              console.log('🔍 Parsing tool message content...');
              const toolResult = JSON.parse(msg.content) as { success: boolean; elements?: unknown[]; message: string };
              console.log('🔍 Tool result:', { success: toolResult.success, elementsCount: toolResult.elements?.length || 0, message: toolResult.message });
              
              if (toolResult.success && toolResult.elements && toolResult.elements.length > 0) {
                // APPEND new elements to existing canvas state
                const newElements = toolResult.elements as unknown[];
                allElements = [...allElements, ...newElements]; // Append, don't replace
                
                // Broadcast ONLY new elements to WebSocket clients
                console.log('🚀 ATTEMPTING WebSocket append with', newElements.length, 'NEW elements');
                console.log('🚀 New elements to broadcast:', JSON.stringify(newElements, null, 2));
                
                try {
                  console.log('🚀 Dynamically importing addDrawingElements function...');
                  const { addDrawingElements } = await import("@/app/api/draw/ws/route");
                  console.log('🚀 Calling addDrawingElements function with NEW elements...');
                  addDrawingElements(newElements, toolResult.message || 'Elements added');
                  console.log('✅ WebSocket append function call completed');
                } catch (error) {
                  console.error('❌ WebSocket broadcast failed with error:', error);
                  console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
                }
                
                // Update learning progress for progressive building
                const currentProgress = chunk.tools?.learningProgress || 
                  initialState.learningProgress || { 
                    topic: extractTopicFromQuery(message), 
                    currentChunk: 0, 
                    totalChunks: 5, 
                    lastUpdate: Date.now() 
                  };
                
                // Increment progress when adding elements
                const newProgress = {
                  ...currentProgress,
                  currentChunk: Math.min(currentProgress.currentChunk + 1, currentProgress.totalChunks),
                  lastUpdate: Date.now()
                };
                
                // Create synchronized drawing event with NEW elements only
                const drawingEvent = {
                  type: 'drawing',
                  elements: newElements, // Send only new elements
                  message: '', // Don't send technical drawing messages to chat
                  learningProgress: newProgress,
                  // Add sync info for voice coordination  
                  syncData: {
                    timestamp: Date.now(),
                    action: toolResult.action || 'unknown',
                    elementCount: newElements.length,
                    shouldNarrate: false // Don't narrate technical drawing actions
                  }
                };
                
                onUpdate(drawingEvent);
              } else if (toolResult.success) {
                // For non-drawing actions, don't send messages to chat
                // The educational content should come from the AI's main response, not tool results
                console.log('🔧 Tool action completed:', toolResult.message);
              }
            } catch (e) {
              console.warn('Failed to parse tool result in stream:', e);
            }
          }
        }
      }
    }

    // Update session context with final canvas state after streaming completes
    const finalCanvasState = await getCurrentCanvasState();
    const currentContext = sessionContexts.get(sessionId) || { elements: [], conversationHistory: '', lastUpdate: 0 };
    sessionContexts.set(sessionId, {
      elements: finalCanvasState, // Use actual final canvas state
      conversationHistory: currentContext.conversationHistory + ` | ${message}`,
      lastUpdate: Date.now()
    });

    onUpdate({ type: 'complete' });
  } catch (error) {
    console.error('Error in streaming drawing agent:', error);
    onUpdate({
      type: 'error',
      content: 'I encountered an error while processing your drawing request. Please try again.'
    });
  }
}