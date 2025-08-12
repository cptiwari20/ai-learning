'use client';
import React from 'react';

interface LearningProgressIndicatorProps {
  topic: string;
  currentChunk: number;
  totalChunks: number;
  isActive: boolean;
  className?: string;
}

export default function LearningProgressIndicator({ 
  topic, 
  currentChunk, 
  totalChunks, 
  isActive, 
  className = '' 
}: LearningProgressIndicatorProps) {
  if (!isActive || !topic) return null;

  const progress = totalChunks > 0 ? (currentChunk / totalChunks) * 100 : 0;

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-blue-600">📚</span>
          <span className="text-sm font-medium text-blue-800">Learning: {topic}</span>
        </div>
        <span className="text-xs text-blue-600">
          Part {currentChunk} of {totalChunks}
        </span>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full bg-blue-100 rounded-full h-2">
        <div 
          className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className="mt-2 text-xs text-blue-600">
        Building diagram step-by-step as we learn together
      </div>
    </div>
  );
}