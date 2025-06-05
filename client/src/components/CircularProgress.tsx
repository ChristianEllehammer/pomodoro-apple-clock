import React from 'react';

interface CircularProgressProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
  backgroundColor?: string;
}

export function CircularProgress({ 
  progress, 
  size = 200, 
  strokeWidth = 8, 
  className = '',
  color = '#3b82f6',
  backgroundColor = '#e5e7eb'
}: CircularProgressProps) {
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div 
      className={`relative circular-progress ${className}`} 
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90 drop-shadow-lg"
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          className="opacity-30"
        />
        
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
          style={{
            filter: `drop-shadow(0 0 8px ${color}40)`
          }}
        />
      </svg>
    </div>
  );
}