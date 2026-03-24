import React, { useMemo } from 'react';

const sizes = {
  sm: { outer: 48, stroke: 4, fontSize: 12, labelSize: 8 },
  md: { outer: 80, stroke: 6, fontSize: 20, labelSize: 10 },
  lg: { outer: 120, stroke: 8, fontSize: 32, labelSize: 12 },
};

function getScoreInfo(score) {
  if (score >= 70) return { color: '#10B981', label: 'SAFE' };
  if (score >= 40) return { color: '#F59E0B', label: 'MEDIUM' };
  return { color: '#EF4444', label: 'RISKY' };
}

export default function ReputationBadge({ score = 0, size = 'md' }) {
  const dim = sizes[size] || sizes.md;
  const { color, label } = useMemo(() => getScoreInfo(score), [score]);

  const radius = (dim.outer - dim.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score));
  const dashOffset = circumference - (progress / 100) * circumference;
  const center = dim.outer / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={dim.outer}
        height={dim.outer}
        className="transition-all duration-500 ease-out"
      >
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#2D2D4A"
          strokeWidth={dim.stroke}
        />
        {/* Score ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={dim.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          className="transition-all duration-500 ease-out"
        />
        {/* Score text */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={dim.fontSize}
          fontWeight="bold"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {score}
        </text>
      </svg>
      <span
        className="font-semibold uppercase tracking-wider transition-colors duration-300"
        style={{ color, fontSize: dim.labelSize }}
      >
        {label}
      </span>
    </div>
  );
}
