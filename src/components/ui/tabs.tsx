"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TabItem {
  label: string;
  href: string;
  active: boolean;
}

export function UnderlineTabs({ items }: { items: TabItem[] }) {
  return (
    <div className="border-line flex gap-6 border-b">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "text-ink-muted hover:text-ink -mb-px border-b-2 border-transparent px-1 py-3 text-sm font-medium transition-colors",
            item.active && "border-accent text-ink",
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
