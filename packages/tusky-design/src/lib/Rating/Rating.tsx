import { clsx } from 'clsx';
import { Star } from 'lucide-react';

export type RatingSize = 'sm' | 'md' | 'lg';
type StarState = 'filled' | 'half' | 'empty';

export interface RatingProps {
  value: number;
  showCount?: boolean;
  count?: number;
  size?: RatingSize;
  className?: string;
}

const sizeStyles: Record<RatingSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

const textSizeStyles: Record<RatingSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

function getStarStates(value: number): StarState[] {
  const floor = Math.floor(value);
  const decimal = value - floor;
  return [...Array(5)].map((_, i) => {
    if (i < floor) return 'filled';
    if (i === floor && decimal >= 0.5) return 'half';
    return 'empty';
  });
}

function HalfStar({ className }: { className: string }) {
  return (
    <span className="relative inline-flex" data-testid="star-half">
      <Star
        className={clsx(className, 'fill-yellow-400 text-yellow-400')}
        style={{ clipPath: 'inset(0 50% 0 0)' }}
      />
      <Star
        className={clsx(className, 'text-gray-300 absolute inset-0')}
        style={{ clipPath: 'inset(0 0 0 50%)' }}
      />
    </span>
  );
}

export function Rating({
  value,
  showCount = false,
  count,
  size = 'md',
  className,
}: RatingProps) {
  const starStates = getStarStates(value);

  return (
    <div className={clsx('flex items-center gap-1', className)}>
      <div className="flex items-center" data-testid="rating-stars">
        {starStates.map((state, i) => {
          if (state === 'half') {
            return <HalfStar key={i} className={sizeStyles[size]} />;
          }
          return (
            <Star
              key={i}
              className={clsx(
                sizeStyles[size],
                state === 'filled'
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              )}
              data-testid={state === 'filled' ? 'star-filled' : 'star-empty'}
            />
          );
        })}
      </div>
      {showCount && count !== undefined && (
        <span className={clsx('text-gray-600', textSizeStyles[size])}>
          {value} ({count} reviews)
        </span>
      )}
    </div>
  );
}

export default Rating;
