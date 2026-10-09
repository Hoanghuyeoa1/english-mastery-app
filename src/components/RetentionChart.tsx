// src/components/RetentionChart.tsx
// Lightweight pure SVG chart displaying Target vs. Actual Retention rate without external charting libraries.
// Sample-size aware with tooltips reflecting review counts per day.

import React, { useState } from 'react';
import { RetentionDataPoint } from '../services/srsAnalytics';

export type { RetentionDataPoint };

export interface RetentionChartProps {
  data: RetentionDataPoint[];
}

export function RetentionChart({ data }: RetentionChartProps): React.JSX.Element {
  const [hoveredPoint, setHoveredPoint] = useState<{
    index: number;
    point: RetentionDataPoint;
    x: number;
    y: number;
  } | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="text-sm text-slate-400 py-6 text-center font-medium">
        Chưa có dữ liệu ôn tập trong giai đoạn này.
      </div>
    );
  }

  const width = 360;
  const height = 120;
  const padding = 20;

  const getX = (idx: number) => padding + (idx * (width - 2 * padding)) / Math.max(1, data.length - 1);
  const getY = (val: number) => height - padding - val * (height - 2 * padding);

  // Target points polyline (drawn across all dates)
  const targetPoints = data.map((d, i) => `${getX(i)},${getY(d.target)}`).join(' ');

  // Actual points: only include days with actual review data
  const validActualEntries = data
    .map((d, i) => ({ d, i }))
    .filter((entry) => entry.d.actual !== null);

  const actualPoints = validActualEntries
    .map(({ d, i }) => `${getX(i)},${getY(d.actual as number)}`)
    .join(' ');

  return (
    <div className="w-full flex flex-col items-center select-none">
      <div className="relative w-full max-w-md">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-32 overflow-visible"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          {/* Subtle horizontal grid lines at 50% and 100% */}
          <line
            x1={padding}
            y1={getY(1.0)}
            x2={width - padding}
            y2={getY(1.0)}
            stroke="#334155"
            strokeDasharray="2 4"
            strokeWidth="1"
          />
          <line
            x1={padding}
            y1={getY(0.5)}
            x2={width - padding}
            y2={getY(0.5)}
            stroke="#1e293b"
            strokeDasharray="2 4"
            strokeWidth="1"
          />

          {/* Baseline target polyline */}
          <polyline
            fill="none"
            stroke="#94a3b8"
            strokeDasharray="4 4"
            strokeWidth="2"
            points={targetPoints}
          />

          {/* Actual retention polyline (connected only across days with data) */}
          {validActualEntries.length > 1 && (
            <polyline
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              points={actualPoints}
            />
          )}

          {/* Data point markers */}
          {data.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d.actual !== null ? d.actual : d.target);
            const isHovered = hoveredPoint?.index === i;
            const hasData = d.actual !== null && d.reviewCount > 0;

            return (
              <g key={`point-${i}-${d.date}`}>
                {/* Touch/hover hit area */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="9"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint({ index: i, point: d, x: cx, y: cy })}
                  onClick={() => setHoveredPoint({ index: i, point: d, x: cx, y: cy })}
                />
                {/* Visual marker: Solid blue if data exists, small dot if empty */}
                {hasData ? (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 4.5 : 3}
                    fill={isHovered ? '#60a5fa' : '#2563eb'}
                    stroke={isHovered ? '#ffffff' : 'none'}
                    strokeWidth="1.5"
                    className="transition-all duration-150 pointer-events-none"
                  />
                ) : (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="1.5"
                    fill="#475569"
                    className="pointer-events-none"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay with Sample Size */}
        {hoveredPoint && (
          <div
            className="absolute -top-3 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-slate-900 border border-slate-700 text-white text-[11px] px-3 py-1.5 rounded-xl shadow-xl flex flex-col items-center gap-0.5 whitespace-nowrap z-20"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
            }}
          >
            <span className="font-bold text-slate-300">{hoveredPoint.point.date}</span>
            <div className="flex items-center gap-2">
              {hoveredPoint.point.actual !== null ? (
                <span className="text-blue-400 font-mono">
                  Thực tế: {Math.round(hoveredPoint.point.actual * 100)}% ({hoveredPoint.point.reviewCount} lượt)
                </span>
              ) : (
                <span className="text-slate-500 font-mono">
                  Chưa có lượt ôn
                </span>
              )}
              <span className="text-slate-400 font-mono">
                Mục tiêu: {Math.round(hoveredPoint.point.target * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Axis dates (Start & End) */}
      {data.length > 1 && (
        <div className="w-full max-w-md flex justify-between px-5 text-[11px] font-mono text-slate-500 mt-1">
          <span>{data[0].date}</span>
          {data.length > 2 && (
            <span>{data[Math.floor(data.length / 2)].date}</span>
          )}
          <span>{data[data.length - 1].date}</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs mt-3 text-slate-400 font-medium">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-blue-500 rounded-full inline-block"></span>
          <span>Thực tế (Observed)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-400 inline-block"></span>
          <span>Mục tiêu (Target)</span>
        </span>
      </div>
    </div>
  );
}
