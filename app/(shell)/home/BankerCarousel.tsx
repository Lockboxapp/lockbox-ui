"use client";

// ============================================================
// BankerCarousel — Sprint 14
// Horizontally scrollable Banker insights. Touch swipe on mobile,
// chevron buttons elsewhere, dot indicators for multi-card state.
// Single-card case renders with no controls (identical to pre-Sprint-14).
// ============================================================

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type InsightType = "unlock_pending" | "behind_target" | "positive";

export type BankerMessage = {
  type: InsightType;
  message: string;
};

const bgFor = (type: InsightType) =>
  type === "unlock_pending"
    ? "bg-amber-50 border-amber-200"
    : type === "behind_target"
    ? "bg-rose-50 border-rose-200"
    : "bg-emerald-50 border-emerald-200";

const iconFor = (type: InsightType) =>
  type === "unlock_pending" ? "⏳" : type === "behind_target" ? "📉" : "✓";

export default function BankerCarousel({ messages }: { messages: BankerMessage[] }) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Clamp index if the array ever shrinks (e.g. after router.refresh)
  useEffect(() => {
    if (index >= messages.length) setIndex(Math.max(0, messages.length - 1));
  }, [messages.length, index]);

  if (messages.length === 0) return null;
  const safeIndex = Math.min(index, messages.length - 1);
  const current = messages[safeIndex];
  const multi = messages.length > 1;

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchEndX.current = null;
  }
  function onTouchMove(e: React.TouchEvent) {
    touchEndX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd() {
    if (!multi) return;
    const start = touchStartX.current;
    const end = touchEndX.current;
    if (start == null || end == null) return;
    const dx = end - start;
    if (Math.abs(dx) < 40) return;
    if (dx < 0 && safeIndex < messages.length - 1) setIndex(safeIndex + 1);
    if (dx > 0 && safeIndex > 0) setIndex(safeIndex - 1);
  }

  const card = (
    <div
      className={`rounded-2xl p-4 border ${bgFor(current.type)} transition-shadow`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-start gap-3">
        <span className="text-base mt-0.5 shrink-0">{iconFor(current.type)}</span>
        <div className="flex-1">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
            The Banker
          </div>
          <div className="text-sm font-medium text-gray-800 leading-snug">
            {current.message}
          </div>
          <div className="text-xs text-gray-500 mt-2 font-medium">
            Chat with The Banker ›
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <Link href="/banker" className="block cursor-pointer">
        {card}
      </Link>

      {multi && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (safeIndex > 0) setIndex(safeIndex - 1);
            }}
            disabled={safeIndex === 0}
            aria-label="Previous insight"
            className="h-7 w-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm disabled:opacity-30"
          >
            ‹
          </button>
          <div className="flex items-center gap-1.5">
            {messages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to insight ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === safeIndex ? "w-5 bg-gray-700" : "w-1.5 bg-gray-300"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (safeIndex < messages.length - 1) setIndex(safeIndex + 1);
            }}
            disabled={safeIndex === messages.length - 1}
            aria-label="Next insight"
            className="h-7 w-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm disabled:opacity-30"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
