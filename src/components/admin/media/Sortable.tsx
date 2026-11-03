"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

/** Drag to reorder on desktop; arrow buttons on touch screens. */
export function Sortable<T extends { id: number }>({
  items,
  onReorder,
  render,
  className,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  render: (item: T, index: number, move: (dir: -1 | 1) => void) => React.ReactNode;
  className?: string;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onReorder(next);
  }

  return (
    <ul className={className}>
      {items.map((item, i) => (
        <li
          key={item.id}
          draggable
          onDragStart={(e) => {
            setDrag(i);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOverIdx(i);
          }}
          onDragLeave={() => setOverIdx(null)}
          onDrop={(e) => {
            e.preventDefault();
            if (drag !== null) move(drag, i);
            setDrag(null);
            setOverIdx(null);
          }}
          onDragEnd={() => {
            setDrag(null);
            setOverIdx(null);
          }}
          className={cn(
            "cursor-grab transition-opacity active:cursor-grabbing",
            drag === i && "opacity-40",
            overIdx === i && drag !== i && "ring-2 ring-forest ring-offset-2 rounded-2xl",
          )}
        >
          {render(item, i, (dir) => move(i, i + dir))}
        </li>
      ))}
    </ul>
  );
}
