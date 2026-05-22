import React from 'react';
import { SPARK_SPRITE_DATA_URL } from './sparkSprite';

const SIZES: Record<'s' | 'm' | 'l', number> = { s: 12, m: 16, l: 20 };

type Props = {
  size?: 's' | 'm' | 'l';
  isWorking?: boolean;
  className?: string;
};

// Mirrors official `SparkSpinner` — a sprite-strip animation rather than a
// gif so the sprite can be tinted via currentColor (mask-image trick).
const SparkSpinner = React.memo(({ size = 'm', isWorking = true, className }: Props) => {
  const px = SIZES[size];
  const mask = `url("${SPARK_SPRITE_DATA_URL}")`;
  return (
    <span
      className={`inline-block overflow-hidden shrink-0 ${className ?? ''}`}
      style={{ width: px, height: px, color: 'var(--accent-brand, #d97356)' }}
      aria-hidden="true"
    >
      <div
        className={isWorking ? 'epitaxy-spark-working' : undefined}
        style={{
          width: px,
          height: 84 * px,
          background: 'currentColor',
          WebkitMaskImage: mask,
          maskImage: mask,
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
          // start at frame 0 / 84 — same translateY as official.
          ['--spark-frames' as any]: 84,
          ['--spark-duration' as any]: '5040ms',
          transform: `translateY(-${400 / 84}%)`,
        }}
      />
    </span>
  );
});
SparkSpinner.displayName = 'SparkSpinner';

export default SparkSpinner;
