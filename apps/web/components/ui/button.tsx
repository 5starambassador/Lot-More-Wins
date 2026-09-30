import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const variants = {
  primary:
    'bg-maroon-700 text-white hover:bg-maroon-800 active:bg-maroon-900 shadow-[inset_0_-1px_0_rgba(0,0,0,0.2)]',
  gold: 'bg-gold-400 text-maroon-950 hover:bg-gold-300 active:bg-gold-500',
  secondary: 'border border-stone-200 bg-white text-stone-800 hover:border-stone-300 hover:bg-stone-50',
  ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  'danger-outline': 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
  link: 'h-auto px-0 text-maroon-700 underline-offset-4 hover:underline',
} as const;

const sizes = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-9 gap-2 px-4 text-[13px]',
  lg: 'h-11 gap-2 px-5 text-sm',
  icon: 'h-9 w-9',
  'icon-sm': 'h-8 w-8',
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';

export function buttonClass(variant: keyof typeof variants = 'primary', size: keyof typeof sizes = 'md', className?: string) {
  return cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-150',
    variants[variant],
    sizes[size],
    className
  );
}
