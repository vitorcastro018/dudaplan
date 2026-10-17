import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="DudaPlan"
      className={cn("h-8 w-8 shrink-0", className)}
    >
      <rect width="64" height="64" rx="16" fill="#8257F5" />
      <path
        d="M21 17h10a15 15 0 0 1 0 30H21z"
        stroke="#fff"
        strokeWidth="6.5"
        strokeLinejoin="round"
      />
      <circle cx="49" cy="15" r="5.5" fill="#FF7A59" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="font-display text-ink text-[22px] leading-none font-extrabold tracking-[-0.04em]">
        duda<span className="text-accent-ink">plan</span>
      </span>
    </span>
  );
}
