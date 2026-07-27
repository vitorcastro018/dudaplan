"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckSquareProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

export function CheckSquare({
  checked,
  onChange,
  size = "md",
  className,
  ...props
}: CheckSquareProps) {
  const dimension = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        dimension,
        "flex shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors duration-150",
        checked ? "border-pine bg-pine" : "border-line-strong bg-surface hover:border-pine",
        className,
      )}
      {...props}
    >
      {checked && <Check className="h-3.5 w-3.5 stroke-[3] text-white" />}
    </button>
  );
}
