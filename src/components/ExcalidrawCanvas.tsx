'use client';
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { ExcalidrawImperativeAPI, ExcalidrawElement } from '@excalidraw/excalidraw/types/types';

interface ExcalidrawCanvasProps {
  initialData?: {
    elements: ExcalidrawElement[];
    appState?: any;
  };
  onMount?: (api: ExcalidrawImperativeAPI, initialData: any) => void;
}

const ExcalidrawCanvas = forwardRef<ExcalidrawImperativeAPI, ExcalidrawCanvasProps>(
  ({ initialData, onMount }, ref) => {
    const [Excalidraw, setExcalidraw] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const excalidrawRef = useRef<ExcalidrawImperativeAPI>(null);

    useImperativeHandle(ref, () => excalidrawRef.current as ExcalidrawImperativeAPI);

    useEffect(() => {
      const loadExcalidraw = async () => {
        try {
          console.log('🔄 Loading Excalidraw module...');
          const { Excalidraw } = await import('@excalidraw/excalidraw');
          console.log('✅ Excalidraw module loaded');
          setExcalidraw(() => Excalidraw);
          setIsLoading(false);
        } catch (error) {
          console.error('❌ Failed to load Excalidraw:', error);
          setIsLoading(false);
        }
      };

      // Only load on client side
      if (typeof window !== 'undefined') {
        loadExcalidraw();
      }
    }, []);

    if (isLoading || !Excalidraw) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-lg text-gray-500">Loading Excalidraw...</div>
        </div>
      );
    }

    return (
      <Excalidraw
        ref={excalidrawRef}
        initialData={initialData}
        onMount={(api: ExcalidrawImperativeAPI, data: any) => {
          console.log('🎯 ExcalidrawCanvas onMount called!');
          console.log('🎯 API available:', !!api);
          console.log('🎯 Ref set:', !!excalidrawRef.current);
          if (onMount) {
            onMount(api, data);
          }
        }}
      />
    );
  }
);

ExcalidrawCanvas.displayName = 'ExcalidrawCanvas';

export default ExcalidrawCanvas;