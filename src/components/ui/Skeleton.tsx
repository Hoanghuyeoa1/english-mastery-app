import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
  animate?: boolean;
  'aria-label'?: string;
}

/**
 * Accessible, layout-preserving Skeleton primitive.
 * Enforces zero Cumulative Layout Shift (CLS) and respects prefers-reduced-motion.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  animate = true,
  className = '',
  style,
  'aria-label': ariaLabel = 'Đang tải nội dung...',
  ...rest
}) => {
  const variantClasses = {
    text: 'h-4 rounded-md',
    rectangular: 'rounded-2xl',
    circular: 'rounded-full',
  }[variant];

  const animationClass = animate ? 'animate-pulse motion-reduce:animate-none' : '';

  const inlineStyles: React.CSSProperties = {
    ...style,
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
  };

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
      className={`bg-slate-800/70 border border-slate-700/40 select-none pointer-events-none ${variantClasses} ${animationClass} ${className}`}
      style={inlineStyles}
      {...rest}
    >
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
};

/**
 * Text line skeleton placeholder.
 */
export const SkeletonText: React.FC<Omit<SkeletonProps, 'variant'>> = (props) => (
  <Skeleton variant="text" {...props} />
);

/**
 * Card skeleton placeholder with preset dimensions to maintain layout stability.
 */
export const SkeletonCard: React.FC<SkeletonProps & { lines?: number }> = ({
  lines = 2,
  className = '',
  ...rest
}) => (
  <div
    role="status"
    aria-busy="true"
    aria-label="Đang nạp thẻ dữ liệu..."
    className={`p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3.5 ${className}`}
    {...rest}
  >
    <div className="flex items-center justify-between gap-3">
      <Skeleton variant="text" className="w-1/3 h-5" />
      <Skeleton variant="circular" className="w-8 h-8 shrink-0" />
    </div>
    {Array.from({ length: lines }).map((_, idx) => (
      <Skeleton
        key={idx}
        variant="text"
        className={idx === lines - 1 ? 'w-2/3 h-3.5' : 'w-full h-3.5'}
      />
    ))}
    <span className="sr-only">Đang nạp thẻ dữ liệu...</span>
  </div>
);
