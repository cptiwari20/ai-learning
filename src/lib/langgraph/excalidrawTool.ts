import { z } from "zod";
import { tool as makeTool } from "@langchain/core/tools";

// Excalidraw drawing tool
export const excalidrawDrawingTool = makeTool(
  async (input: { 
    action: string; 
    elements?: unknown[]; 
    text?: string; 
    position?: { x: number; y: number };
    color?: string;
    size?: number;
  }) => {
    const { action, elements = [], text, position, color = "#1f2937", size = 2 } = input;
    
    let result = "";
    
    switch (action) {
      case "draw_text":
        if (text && position) {
          result = `Drew text "${text}" at position (${position.x}, ${position.y}) with color ${color}`;
        } else {
          result = "Error: text and position required for draw_text action";
        }
        break;
        
      case "draw_rectangle":
        if (position) {
          result = `Drew rectangle at position (${position.x}, ${position.y}) with color ${color} and size ${size}`;
        } else {
          result = "Error: position required for draw_rectangle action";
        }
        break;
        
      case "draw_circle":
        if (position) {
          result = `Drew circle at position (${position.x}, ${position.y}) with color ${color} and size ${size}`;
        } else {
          result = "Error: position required for draw_circle action";
        }
        break;
        
      case "draw_line":
        if (position) {
          result = `Drew line at position (${position.x}, ${position.y}) with color ${color} and size ${size}`;
        } else {
          result = "Error: position required for draw_line action";
        }
        break;
        
      case "clear_canvas":
        result = "Cleared the canvas";
        break;
        
      case "update_elements":
        result = `Updated ${elements.length} elements on the canvas`;
        break;
        
      default:
        result = `Unknown action: ${action}. Available actions: draw_text, draw_rectangle, draw_circle, draw_line, clear_canvas, update_elements`;
    }
    
    return result;
  },
  {
    name: "excalidraw_drawing",
    description: "Draw elements on an Excalidraw canvas. Use this to create visual representations of concepts, diagrams, or explanations.",
    schema: z.object({
      action: z.enum(["draw_text", "draw_rectangle", "draw_circle", "draw_line", "clear_canvas", "update_elements"]),
      elements: z.array(z.unknown()).optional(),
      text: z.string().optional(),
      position: z.object({
        x: z.number(),
        y: z.number()
      }).optional(),
      color: z.string().optional(),
      size: z.number().optional()
    }),
  }
);

// Helper function to create drawing instructions
export function createDrawingInstruction(
  action: string,
  options: {
    text?: string;
    position?: { x: number; y: number };
    color?: string;
    size?: number;
    elements?: unknown[];
  } = {}
) {
  return {
    tool: "excalidraw_drawing",
    action,
    ...options
  };
} 