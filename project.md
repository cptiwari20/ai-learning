# Visual Learning AI - Project Documentation

## Project Overview
An AI-powered visual learning platform that combines conversational AI with real-time collaborative drawing capabilities using Excalidraw.

## Project Goals

### Primary Objectives
1. **Interactive Drawing Assistant**: Create an AI that can generate visual diagrams, flowcharts, and illustrations based on user text descriptions
2. **Real-time Collaboration**: Enable multiple users to collaborate on visual content through WebSocket connections
3. **Educational Tool**: Provide a platform for visual learning and explanation of complex concepts

### Core Features

#### 1. AI-Powered Drawing Generation
- **Text-to-Visual**: Convert user descriptions into Excalidraw elements
- **Smart Diagrams**: Generate flowcharts, mind maps, system architectures, and educational diagrams
- **Interactive Responses**: AI can modify and enhance existing drawings based on feedback

#### 2. Real-time Synchronization
- **WebSocket Integration**: Live updates across connected clients
- **Drawing Broadcast**: AI-generated drawings appear instantly on all connected canvases
- **State Management**: Persistent canvas state for new connections

#### 3. User Interface
- **Split Layout**: Chat interface alongside Excalidraw canvas
- **Drawing Controls**: Manual drawing tools combined with AI assistance
- **Session Management**: Unique session IDs for tracking conversations and drawings

## Technical Architecture

### Frontend
- **Framework**: Next.js 15 with React 19
- **Drawing Engine**: Excalidraw for collaborative whiteboard functionality
- **UI**: Tailwind CSS for responsive design
- **WebSocket Client**: Real-time communication with drawing server

### Backend
- **AI Integration**: LangChain with OpenAI GPT models for drawing generation
- **WebSocket Server**: Standalone WebSocket server for real-time drawing synchronization
- **Drawing Tools**: Custom Excalidraw element generation utilities
- **Agent Architecture**: LangGraph for complex drawing workflow management

### Key Components

#### Drawing Agent (`src/lib/drawing/agent.ts`)
- LangGraph-based AI agent for processing drawing requests
- Streaming support for real-time updates
- Tool integration for Excalidraw element generation

#### Excalidraw Tool (`src/lib/drawing/excalidrawTool.ts`)
- Generates valid Excalidraw elements from AI instructions
- Supports shapes, text, flowcharts, mind maps, and complex diagrams
- Element validation and formatting

#### WebSocket Server (`src/app/api/draw/ws/route.ts`)
- Manages real-time drawing synchronization
- Broadcasts AI-generated drawings to all connected clients
- Handles client connections and canvas state management

#### Drawing Interface (`src/app/draw/page.tsx`)
- Main user interface combining chat and drawing canvas
- Excalidraw API integration for reliable canvas updates
- WebSocket client for receiving drawing updates

## Current Implementation Status

### ✅ Completed Features
- Real-time WebSocket drawing synchronization
- AI-powered drawing generation using LangChain
- Excalidraw integration with proper API usage
- Chat interface with streaming responses
- Basic shapes and diagram generation
- Session management and client identification

### 🚧 In Progress
- Code cleanup and optimization
- Documentation improvements
- Error handling enhancements

### 📋 Future Enhancements
- User authentication and persistent sessions
- Advanced drawing templates and presets
- Export functionality (PNG, SVG, PDF)
- Drawing history and version control
- Multi-room support for team collaboration
- Mobile responsiveness improvements

## Development Guidelines

### API Usage
- Always use official Excalidraw API methods as documented
- Avoid creating non-existent API methods
- Reference official documentation for implementation details

### WebSocket Communication
- Follow established message types: 'drawing', 'sync', 'clear', 'update'
- Validate element structure before broadcasting
- Handle connection states gracefully

### AI Integration
- Use structured prompts for consistent drawing generation
- Implement proper error handling for AI responses
- Validate and sanitize AI-generated Excalidraw elements

## Getting Started

### Prerequisites
- Node.js 18+
- OpenAI API key
- Next.js development environment

### Environment Variables
```env
OPENAI_API_KEY=your_openai_api_key_here
```

### Development Commands
```bash
npm run dev    # Start development server
npm run build  # Build for production
npm run start  # Start production server
```

### Testing the Drawing Feature
1. Navigate to `/draw`
2. Send a drawing request like "draw a flowchart for user registration"
3. Observe AI-generated elements appearing on the Excalidraw canvas
4. Test real-time synchronization with multiple browser tabs

## Contributing
- Follow existing code patterns and conventions
- Add proper error handling and logging
- Test WebSocket functionality across multiple clients
- Document any new API integrations or features