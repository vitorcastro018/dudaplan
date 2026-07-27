import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "border-line-strong bg-surface text-ink placeholder:text-ink-muted h-9 w-full rounded-[var(--radius-sm)] border px-3 text-sm",
      "focus-visible:ring-accent focus-visible:ring-offset-paper focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "border-line-strong bg-surface text-ink placeholder:text-ink-muted w-full rounded-[var(--radius-sm)] border px-3 py-2 text-sm",
      "focus-visible:ring-accent focus-visible:ring-offset-paper focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "border-line-strong bg-surface text-ink h-9 w-full rounded-[var(--radius-sm)] border px-3 text-sm",
      "focus-visible:ring-accent focus-visible:ring-offset-paper focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("text-ink-2 mb-1.5 block text-sm font-medium", className)} {...props} />
  );
}
