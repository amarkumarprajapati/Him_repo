import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const describedBy = error
      ? `${inputId}-error`
      : hint
        ? `${inputId}-hint`
        : undefined;

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-foreground"
          >
            {label}
          </label>
        ) : null}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-10 w-full rounded-md border border-foreground/15 bg-background px-3 text-sm',
            'placeholder:text-foreground/40',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500/60 focus-visible:ring-red-500/40',
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-red-600">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-xs text-foreground/60">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';
