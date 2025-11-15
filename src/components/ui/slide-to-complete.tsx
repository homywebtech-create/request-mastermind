import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlideToCompleteProps {
  onComplete: () => void;
  text: string;
  disabled?: boolean;
  className?: string;
}

export function SlideToComplete({ onComplete, text, disabled = false, className }: SlideToCompleteProps) {
  const [slidePosition, setSlidePosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const COMPLETION_THRESHOLD = 0.85;

  // Hide hint after first interaction
  useEffect(() => {
    if (isDragging) {
      setShowHint(false);
    }
  }, [isDragging]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      
      // For RTL: calculate from right to left
      const position = rect.right - clientX;
      const maxPosition = rect.width - 64; // 64px is button width
      const newPosition = Math.max(0, Math.min(position, maxPosition));
      const percentage = newPosition / maxPosition;

      setSlidePosition(percentage);

      if (percentage >= COMPLETION_THRESHOLD) {
        setIsDragging(false);
        setSlidePosition(0);
        onComplete();
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setSlidePosition(0);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchmove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, onComplete]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-14 bg-green-600 rounded-lg overflow-hidden select-none touch-none",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* Progress background */}
      <div
        className="absolute inset-0 bg-green-700 transition-all duration-150"
        style={{
          width: `${slidePosition * 100}%`,
          right: 0,
        }}
      />

      {/* Animated hint arrows - show when not dragging */}
      {showHint && !isDragging && !disabled && (
        <div className="absolute inset-0 flex items-center justify-start pr-20 pointer-events-none">
          <div className="flex gap-2 animate-pulse">
            <span className="text-white text-2xl font-bold animate-bounce" style={{ animationDelay: '0ms' }}>←</span>
            <span className="text-white text-2xl font-bold animate-bounce" style={{ animationDelay: '150ms' }}>←</span>
            <span className="text-white text-2xl font-bold animate-bounce" style={{ animationDelay: '300ms' }}>←</span>
          </div>
        </div>
      )}

      {/* Text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-white text-lg font-bold opacity-80">
          {isDragging && slidePosition > 0.3 ? '←  ←  ←' : text}
        </span>
      </div>

      {/* Sliding button with pulsing animation */}
      <div
        className={cn(
          "absolute top-1 h-12 w-16 bg-white rounded-md shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing transition-shadow",
          isDragging && "shadow-xl scale-105",
          !isDragging && showHint && !disabled && "animate-pulse"
        )}
        style={{
          right: `${slidePosition * (containerRef.current?.offsetWidth || 400) - (containerRef.current?.offsetWidth || 400) + 68}px`,
          transition: isDragging ? 'none' : 'right 0.3s ease-out',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      >
        <CheckCircle className={cn(
          "h-6 w-6 text-green-600 transition-transform",
          isDragging && "scale-110"
        )} />
      </div>

      {/* Helper text below button */}
      {showHint && !isDragging && !disabled && (
        <div className="absolute -bottom-6 left-0 right-0 text-center">
          <span className="text-xs text-muted-foreground animate-pulse">
            ← اسحب من اليمين إلى اليسار
          </span>
        </div>
      )}
    </div>
  );
}
