"use client";

/** Generic drag-to-reorder list. Calls onCommit with the new id order when a drag ends. */

import { useRef, useState } from "react";

export default function ReorderList<T extends { id: string }>({
  items,
  setItems,
  onCommit,
  render,
}: {
  items: T[];
  setItems: (items: T[]) => void;
  onCommit: (ids: string[]) => void;
  render: (item: T, index: number) => React.ReactNode;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dirty = useRef(false);

  function moveTo(target: number) {
    if (dragIndex === null || dragIndex === target) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved);
    setItems(next);
    setDragIndex(target);
    dirty.current = true;
  }

  function finish() {
    if (dirty.current) onCommit(items.map((i) => i.id));
    dirty.current = false;
    setDragIndex(null);
  }

  return (
    <ul className="divide-y divide-edge overflow-hidden rounded border border-edge bg-panel">
      {items.map((item, i) => (
        <li
          key={item.id}
          draggable
          onDragStart={() => setDragIndex(i)}
          onDragOver={(e) => {
            e.preventDefault();
            moveTo(i);
          }}
          onDragEnd={finish}
          onDrop={(e) => e.preventDefault()}
          className={`flex items-center gap-3 px-3 py-2.5 ${
            dragIndex === i ? "bg-ink/80 opacity-70" : ""
          }`}
        >
          <span
            className="cursor-grab select-none text-neutral-600 active:cursor-grabbing"
            title="Drag to reorder"
          >
            ⠿
          </span>
          <div className="min-w-0 flex-1">{render(item, i)}</div>
        </li>
      ))}
    </ul>
  );
}
