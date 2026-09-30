import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const fieldBase =
  'w-full rounded-md border border-stone-200 bg-white text-[13px] text-stone-900 transition-colors placeholder:text-stone-400 hover:border-stone-300 focus:border-gold-500 focus:outline-none focus:ring-[3px] focus:ring-gold-400/20 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-500 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-500/10';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Leading icon inside the field. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Trailing unit such as % or ₹. */
  suffix?: string;
  /** Leading unit such as +91 or ₹. */
  prefix?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon: Icon, suffix, prefix, ...props }, ref) => {
    if (!Icon && !suffix && !prefix) {
      return <input ref={ref} className={cn(fieldBase, 'h-9 px-3', className)} {...props} />;
    }
    return (
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />}
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[13px] text-stone-500">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            fieldBase,
            'h-9 px-3',
            Icon && 'pl-9',
            prefix && 'pl-10',
            suffix && 'pr-9',
            className
          )}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] font-medium text-stone-500">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(fieldBase, 'h-9 cursor-pointer appearance-none pl-3 pr-8', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
    </div>
  )
);
Select.displayName = 'Select';
