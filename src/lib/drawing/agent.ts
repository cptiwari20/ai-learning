import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, BaseMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { excalidrawTool } from "./excalidrawTool";
import { LearningRAGService } from "../rag/ragService";
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
});

// Initialize the model with tools
const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.1,
  apiKey: process.env.OPENAI_API_KEY,
}).bindTools([excalidrawTool]);

// RAG node - retrieves relevant learning context before agent processing
async function ragNode(state: typeof DrawingState.State) {
  console.log('🔍 RAG node called - retrieving learning context');
  
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  
  if (!(lastMessage instanceof HumanMessage)) {
    return { ragContext: '', userLearningHistory: '' };
  }

  try {
    // Initialize RAG service with configuration
    const ragConfig = {
      vectorStore: {
        provider: (process.env.VECTOR_STORE_PROVIDER as 'mongodb' | 'pinecone') || 'mongodb',
        connectionString: process.env.MONGODB_CONNECTION_STRING,
        indexName: process.env.VECTOR_INDEX_NAME || 'learning_vector_index',
        apiKey: process.env.PINECONE_API_KEY,
      },
      embeddings: {
        openaiApiKey: process.env.OPENAI_API_KEY!,
      },
    };

    const ragService = await LearningRAGService.getInstance(ragConfig);
    
    // Extract topic from the message
    const query = lastMessage.content.toString();
    const topic = extractTopicFromQuery(query);
    
    // Get relevant context
    const ragResult = await ragService.getRelevantContext(query, topic);
    
    console.log(`📚 Retrieved RAG context: ${ragResult.sources.length} sources, topic: ${topic}`);
    
    return {
      ragContext: ragResult.relevantContext,
      userLearningHistory: ragResult.userHistory ? JSON.stringify(ragResult.userHistory) : '',
    };
  } catch (error) {
    console.error('❌ RAG retrieval failed:', error);
    return { ragContext: '', userLearningHistory: '' };
  }
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
    
    console.log('🎨 Canvas description for AI:', canvasDescription);
    console.log('📚 RAG context available:', ragContext.length > 0);
    console.log('👤 User history available:', userHistory.length > 0);
    
    const systemPrompt = new AIMessage(`You are a Visual Learning Assistant - an intelligent teacher who explains concepts through interactive diagrams.

🎓 CORE MISSION: Help students understand complex topics through visual learning, not just drawing

EDUCATIONAL TEACHING APPROACH:
- First EXPLAIN the concept clearly in educational terms
- Then CREATE visual diagrams that illustrate your explanation
- Connect new concepts to what students already know
- Use simple, clear language that builds understanding step by step
- Ask thoughtful questions to encourage deeper thinking about the topic

AGENTIC LEARNING FLOW:
1. ANALYZE what the student wants to learn
2. PLAN how to break it down into visual steps  
3. EXPLAIN the key concepts clearly
4. CREATE diagrams that reinforce your explanation
5. CONNECT ideas to help students see relationships
6. SUGGEST next learning steps or related topics

${canvasDescription}

${ragContext ? `PREVIOUS LEARNING CONTEXT:
The student has previous learning history and context about this topic:
${ragContext}

Use this context to:
- Build upon concepts the student already knows
- Reference previous diagrams or explanations when relevant  
- Avoid repeating information already covered
- Make connections to their learning journey
- Adapt your teaching style to their demonstrated understanding level

` : ''}${userHistory ? `STUDENT LEARNING PROFILE:
${userHistory}

Personalize your teaching approach based on their learning progress and interests.

` : ''}SPATIAL INTELLIGENCE RULES:
- Study the spatial map above to understand existing layout
- Use the OPTIMAL AREAS suggested for placing new content
- NEVER place elements in occupied regions
- Follow the spatial distribution patterns shown
- If CONNECTION OPPORTUNITIES are suggested, CREATE THOSE ARROWS
- Place new elements in empty regions or adjacent to existing content

ARROW CONNECTIVITY PRIORITY:
- ALWAYS look for opportunities to connect related elements with arrows
- Use draw_arrow to connect shapes that should be related
- Create logical flow between elements (e.g., process steps, relationships)
- Connect new elements to existing ones when it makes sense
- Arrows should show direction of flow, relationships, or dependencies

POSITIONING INTELLIGENCE:
- The system provides specific optimal areas - USE THEM
- Elements will be automatically positioned in suggested regions
- Trust the spatial analysis to avoid overlaps
- New content will be placed in empty regions first
- Then adjacent to existing content with proper spacing

CONTEXT AWARENESS:
- Previous conversation: ${conversationSummary}
- CRITICAL: ALWAYS ADD TO existing drawings, NEVER replace them
- Each new request should ADD elements that complement existing ones
- Build logically upon existing content with proper connections
- If extending workflows, add connecting arrows between steps
- If adding related concepts, connect them to existing elements
- Use consistent colors and styling with existing elements

ACTIONS TO USE (in order of preference):
1. connect_elements - to connect existing elements with smart arrows (use exact fromElementIndex and toElementIndex from opportunities above)
2. draw_rectangle, draw_circle, draw_diamond - for new content blocks
3. draw_text - for labels and annotations  
4. draw_arrow - for manual arrow positioning (when connect_elements isn't suitable)
5. create_flowchart - for process sequences with built-in connections
6. create_mindmap - for concept relationships with radial connections
7. create_diagram - for structured layouts with connections

LEARNING-FOCUSED ACTIONS:
- Create educational diagrams that build understanding step by step
- Use flowcharts to show processes and cause-and-effect relationships  
- Use mind maps to show how concepts connect and relate to each other
- Use simple shapes with clear labels to represent key ideas
- Connect related concepts with arrows to show relationships

EDUCATIONAL RESPONSE FORMAT:
1. Start with clear explanation of the concept/topic (2-3 sentences)
2. Then use tools to create supporting visual diagrams
3. Explain what each visual element represents and why it matters
4. Connect to broader learning goals or suggest next steps

LEARNING-FOCUSED COMMUNICATION:
- Focus on CONCEPTS and IDEAS, not drawing mechanics
- Explain WHY things work this way, not just what you're drawing
- Use teaching language: "Let's explore...", "This shows us...", "Notice how..."
- Make connections to real-world applications
- Encourage curiosity and deeper exploration

Available tools: connect_elements, create_flowchart, create_mindmap, create_diagram, draw_rectangle, draw_circle, draw_line, draw_text, draw_arrow, draw_diamond, clear_canvas

🎯 GOAL: Create an educational experience where students learn through visual understanding, not just see drawings being made.`);
    
    messagesToSend = [systemPrompt, ...messages];
  }

  try {
    const response = await model.invoke(messagesToSend);
    console.log(`Model response type: ${response.constructor.name}`);
    console.log(`Has tool calls: ${(response as AIMessage & { tool_calls?: unknown[] }).tool_calls?.length || 0}`);
    
    // Keep educational explanations - don't clear content for learning assistant
    // The user wants to learn the topic, so preserve the educational explanation
    
    return {
      messages: [response],
      iterations: 1
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
        // Add current canvas elements to tool args for smart positioning
        const enhancedArgs = {
          ...toolCall.args,
          existingElements: state.currentElements || []
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
  console.log('💾 Storage node called - saving to RAG');
  
  const messages = state.messages;
  if (messages.length < 2) return {}; // Need at least user message and response
  
  try {
    // Initialize RAG service
    const ragConfig = {
      vectorStore: {
        provider: (process.env.VECTOR_STORE_PROVIDER as 'mongodb' | 'pinecone') || 'mongodb',
        connectionString: process.env.MONGODB_CONNECTION_STRING,
        indexName: process.env.VECTOR_INDEX_NAME || 'learning_vector_index',
        apiKey: process.env.PINECONE_API_KEY,
      },
      embeddings: {
        openaiApiKey: process.env.OPENAI_API_KEY!,
      },
    };

    const ragService = await LearningRAGService.getInstance(ragConfig);
    
    // Find user message and assistant response
    const userMessage = messages.find(m => m instanceof HumanMessage);
    const assistantMessage = messages.find(m => m instanceof AIMessage && !m.tool_calls?.length);
    
    if (userMessage && assistantMessage) {
      const question = userMessage.content.toString();
      const answer = assistantMessage.content.toString();
      const topic = extractTopicFromQuery(question);
      const diagrams = state.currentElements;
      
      await ragService.storeConversation(question, answer, topic, diagrams);
      console.log(`✅ Stored learning conversation for topic: ${topic}`);
    }
  } catch (error) {
    console.error('❌ Failed to store conversation in RAG:', error);
    // Don't throw - storage failure shouldn't break the flow
  }
  
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
  const shapes = elements.filter((el: any) => ['rectangle', 'ellipse', 'diamond'].includes(el.type));
  
  // Create a map to find original indices
  const shapeIndexMap = new Map();
  shapes.forEach((shape, shapeIndex) => {
    const originalIndex = elements.findIndex(el => el === shape);
    shapeIndexMap.set(shapeIndex, originalIndex);
  });
  
  // Check if elements are already connected by existing arrows
  const existingConnections = new Set();
  const arrows = elements.filter((el: any) => el.type === 'arrow');
  
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
          const originalFromIndex = shapeIndexMap.get(i);
          const originalToIndex = shapeIndexMap.get(j);
          
          opportunities.push({
            from: el1.text || `${el1.type} at (${Math.round(el1.x)}, ${Math.round(el1.y)})`,
            to: el2.text || `${el2.type} at (${Math.round(el2.x)}, ${Math.round(el2.y)})`,
            type: horizontallyAligned ? 'horizontal arrow' : 'vertical arrow',
            fromIndex: originalFromIndex,
            toIndex: originalToIndex,
            action: `connect_elements with fromElementIndex: ${originalFromIndex}, toElementIndex: ${originalToIndex}`
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
              // Update all elements for context persistence
              allElements = toolResult.elements;
              
              // Broadcast to WebSocket clients
              console.log('🚀 Adding drawing elements via WebSocket (non-streaming, append only):', toolResult.elements.length);
              try {
                const { addDrawingElements } = await import("@/app/api/draw/ws/route");
                addDrawingElements(toolResult.elements as unknown[], toolResult.message || 'Elements added');
              } catch (error) {
                console.error('❌ Non-streaming WebSocket add failed:', error);
              }
              
              onDrawingEvent(toolResult.elements, toolResult.message);
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
  };

  try {
    const stream = await compiledGraph.stream(initialState);
    let allElements: unknown[] = existingContext?.elements || [];

    for await (const chunk of stream) {
      console.log('🌊 Stream chunk received:', Object.keys(chunk));
      console.log('🌊 Chunk details:', JSON.stringify(chunk, null, 2));

      // Handle agent responses - stream text even when tools are being used
      if (chunk.agent) {
        const messages = chunk.agent.messages;
        for (const msg of messages) {
          if (msg instanceof AIMessage && typeof msg.content === 'string') {
            if (msg.content.trim()) {
              onUpdate({ type: 'message', content: msg.content });
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
                // Broadcast to WebSocket clients
                console.log('🚀 ATTEMPTING WebSocket append with', toolResult.elements.length, 'elements');
                console.log('🚀 Elements to broadcast:', JSON.stringify(toolResult.elements, null, 2));
                
                try {
                  console.log('🚀 Dynamically importing addDrawingElements function...');
                  const { addDrawingElements } = await import("@/app/api/draw/ws/route");
                  console.log('🚀 Calling addDrawingElements function...');
                  addDrawingElements(toolResult.elements as unknown[], toolResult.message || 'Elements added');
                  console.log('✅ WebSocket append function call completed');
                } catch (error) {
                  console.error('❌ WebSocket broadcast failed with error:', error);
                  console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
                }
              } else {
                console.log('⚠️ Not broadcasting - conditions not met:', {
                  success: toolResult.success,
                  hasElements: !!toolResult.elements,
                  elementsLength: toolResult.elements?.length || 0
                });
              }
              
              // Always send the update regardless of broadcast success
              if (toolResult.success && toolResult.elements && toolResult.elements.length > 0) {
                // Update all elements for context persistence
                allElements = toolResult.elements;
                
                onUpdate({
                  type: 'drawing',
                  elements: toolResult.elements,
                  message: '✨ Drawing updated'
                });
              } else if (toolResult.success) {
                // Send brief message for actions like clear_canvas
                onUpdate({
                  type: 'message',
                  content: toolResult.message === 'Canvas cleared' ? '🧹 Canvas cleared' : '✅ Action completed'
                });
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