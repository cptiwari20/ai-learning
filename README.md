# Visual Learning AI

A Next.js application that combines LangGraph agents with real-time Excalidraw drawing capabilities for visual learning experiences.

## Features

### 🤖 LangGraph Agent Integration
- **Multi-tool Agent**: Uses LangGraph with OpenAI GPT-4o-mini
- **Session Management**: Persistent conversation sessions
- **Tool Integration**: Weather API, Stock API, and Excalidraw drawing tools
- **Real-time Streaming**: Server-sent events for live responses

### 🎨 Excalidraw Drawing Integration
- **Toggle Drawing Mode**: Enable/disable visual responses
- **Real-time Drawing**: Agent can draw diagrams, text, shapes in real-time
- **Interactive Canvas**: Users can also draw manually on the canvas
- **Streaming Updates**: Drawing instructions stream from agent to canvas

### 🛠️ Available Drawing Tools
- **Text Drawing**: Add text labels and descriptions
- **Shape Drawing**: Rectangles, circles, lines
- **Canvas Management**: Clear canvas, update elements
- **Color & Size Control**: Customizable drawing properties

## Getting Started

### Prerequisites
- Node.js 18+ 
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd visual-learning-ai
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Add your OpenAI API key
OPENAI_API_KEY=your_api_key_here
```

4. Install Excalidraw (optional for full functionality):
```bash
npm install @excalidraw/excalidraw
```

5. Run the development server:
```bash
npm run dev
```

## Usage

### Basic Chat
1. Open the application in your browser
2. Type your message in the chat input
3. The agent will respond with text and optionally draw visual elements

### Drawing Mode
1. Toggle "Enable Drawing Mode" in the header
2. Ask the agent to create visual representations
3. Watch as the agent draws diagrams, charts, or explanations in real-time

### Example Prompts
- "Draw a flowchart showing the software development lifecycle"
- "Create a diagram explaining photosynthesis"
- "Show me a simple circuit diagram"
- "Draw a mind map of machine learning concepts"

## Architecture

### Frontend Components
- `ExcalidrawCanvas`: Custom drawing canvas component
- `Home`: Main application with chat and drawing interface
- Real-time streaming with Server-Sent Events

### Backend Services
- `LangGraph Agent`: Multi-tool agent with drawing capabilities
- `Streaming API`: Real-time response streaming
- `Session Store`: Persistent conversation management

### Tools Available
- `fake_weather_api`: Get weather information
- `fake_stock_api`: Get stock prices
- `excalidraw_drawing`: Draw visual elements

## Development

### Project Structure
```
src/
├── app/
│   ├── api/agents/
│   │   ├── route.ts          # Standard agent API
│   │   └── stream/route.ts   # Streaming agent API
│   ├── globals.css           # Styles
│   ├── layout.tsx            # App layout
│   └── page.tsx              # Main interface
├── components/
│   └── ExcalidrawCanvas.tsx  # Drawing canvas component
└── lib/langgraph/
    ├── agent.ts              # LangGraph agent setup
    ├── excalidrawTool.ts     # Drawing tool implementation
    └── sessionStore.ts       # Session management
```

### Adding New Tools
1. Create tool in `src/lib/langgraph/`
2. Add to agent tools array in `agent.ts`
3. Handle in `toolNode` function
4. Update frontend if needed

### Customizing Drawing
- Modify `ExcalidrawCanvas.tsx` for different drawing styles
- Update `excalidrawTool.ts` for new drawing actions
- Extend `DrawingElement` interface for new element types

## Technologies Used

- **Next.js 15**: React framework with App Router
- **LangGraph**: Agent orchestration
- **OpenAI GPT-4o-mini**: Language model
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Canvas API**: Drawing functionality
- **Server-Sent Events**: Real-time streaming

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
