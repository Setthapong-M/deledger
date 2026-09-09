"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

type Item = { id: string };
type Drag = {
  id: string;
  pointerId: number;
  startY: number;
  offset: number;
  top: number;
  left: number;
  width: number;
  height: number;
  original: string[];
  current: string[];
  moved: boolean;
};

type HandleProps = {
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  style: CSSProperties;
};

export function SortableExpenses<T extends Item>({ items, disabled, version, label, renderItem, renderOverlay, onReorder }: {
  items: T[];
  disabled: boolean;
  version: string;
  label: string;
  renderItem: (item: T, handle: HandleProps) => ReactNode;
  renderOverlay: (item: T) => ReactNode;
  onReorder: (ids: string[]) => Promise<void>;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const positions = useRef(new Map<string, number>());
  const frame = useRef<number | null>(null);
  const active = useRef(true);
  const generation = useRef(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const ordered = order ? order.flatMap(id => { const item = items.find(item => item.id === id); return item ? [item] : []; }) : items;

  function stopScroll() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }

  function cancel() {
    generation.current++;
    stopScroll();
    const current = dragRef.current;
    dragRef.current = null;
    if (current && listRef.current?.hasPointerCapture?.(current.pointerId)) listRef.current.releasePointerCapture(current.pointerId);
    setDrag(null);
    setOrder(null);
    setSaving(false);
  }

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, []);

  useEffect(() => { cancel(); }, [version]);

  useEffect(() => {
    if (!drag) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); cancel(); }
    };
    window.addEventListener("keydown", escape);
    window.addEventListener("blur", cancel);
    return () => { window.removeEventListener("keydown", escape); window.removeEventListener("blur", cancel); };
  }, [Boolean(drag)]);

  useLayoutEffect(() => {
    const next = new Map<string, number>();
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    rows.current.forEach((element, id) => {
      const top = element.offsetTop;
      next.set(id, top);
      const previous = positions.current.get(id);
      if (!reduced && previous !== undefined && previous !== top && id !== dragRef.current?.id) {
        const transform = window.getComputedStyle(element).transform;
        const offset = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
        element.getAnimations?.().forEach(animation => animation.cancel());
        element.animate?.([{ transform: `translateY(${previous + offset - top}px)` }, { transform: "translateY(0)" }], { duration: 200, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
    });
    positions.current = next;
  }, [ordered.map(item => item.id).join("|")]);

  function update(clientY: number) {
    const current = dragRef.current;
    if (!current) return;
    current.moved ||= Math.abs(clientY - current.startY) > 4;
    if (!current.moved) return;
    current.top = clientY - current.offset;
    const others = current.current.filter(id => id !== current.id);
    let index = 0;
    for (const id of others) {
      const element = rows.current.get(id);
      if (element) {
        const top = (listRef.current?.getBoundingClientRect().top ?? 0) + element.offsetTop;
        if (clientY > top + element.offsetHeight / 2) index++;
      }
    }
    const next = [...others];
    next.splice(index, 0, current.id);
    current.current = next;
    setOrder(next);
    setDrag({ ...current });
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || event.pointerId !== dragRef.current.pointerId) return;
    event.preventDefault();
    update(event.clientY);
    stopScroll();
    const clientY = event.clientY;
    const scroll = () => {
      if (!dragRef.current?.moved) return;
      const edge = 80;
      const speed = clientY < edge ? -Math.min(14, (edge - clientY) / 4) : clientY > window.innerHeight - edge ? Math.min(14, (clientY - window.innerHeight + edge) / 4) : 0;
      if (!speed) return;
      window.scrollBy(0, speed);
      update(clientY);
      frame.current = requestAnimationFrame(scroll);
    };
    frame.current = requestAnimationFrame(scroll);
  }

  async function finish(event: PointerEvent<HTMLDivElement>) {
    const current = dragRef.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const operation = generation.current;
    stopScroll();
    dragRef.current = null;
    if (listRef.current?.hasPointerCapture?.(current.pointerId)) listRef.current.releasePointerCapture(current.pointerId);
    const target = rows.current.get(current.id);
    const overlay = overlayRef.current;
    setSaving(true);
    if (overlay && target && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      const rect = target.getBoundingClientRect();
      await overlay.animate?.([
        { transform: "translateY(0) scale(1.015)", opacity: 1 },
        { transform: `translateY(${rect.top - current.top}px) scale(1)`, opacity: 1 },
      ], { duration: 160, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }).finished.catch(() => {});
    }
    if (!active.current || generation.current !== operation) return;
    setDrag(null);
    try {
      if (current.current.join("|") !== current.original.join("|")) await onReorder(current.current);
    } finally {
      if (active.current) { setOrder(null); setSaving(false); }
    }
  }

  return <div ref={listRef} className="relative grid gap-3" role="list" aria-label={label} aria-busy={saving}
    onKeyDownCapture={event => { if ((drag || saving) && (event.key === "ArrowUp" || event.key === "ArrowDown")) { event.preventDefault(); event.stopPropagation(); } }}
    onPointerMove={move} onPointerUp={event => { void finish(event); }} onPointerCancel={cancel}
    onLostPointerCapture={() => { if (dragRef.current) cancel(); }}>
    {ordered.map(item => <div key={item.id} ref={element => { if (element) rows.current.set(item.id, element); else rows.current.delete(item.id); }}
      role="listitem" className="relative rounded-xl bg-surface" style={drag?.moved && drag.id === item.id ? { opacity: 0.25, outline: "2px dashed var(--deledger-primary)", outlineOffset: 2 } : undefined}>
      {renderItem(item, {
        style: { touchAction: "none", cursor: disabled || saving ? "default" : drag ? "grabbing" : "grab" },
        onPointerDown: event => {
          if (disabled || saving || dragRef.current || event.button !== 0 || !event.isPrimary) return;
          const rect = rows.current.get(item.id)?.getBoundingClientRect();
          if (!rect) return;
          event.preventDefault();
          event.currentTarget.focus();
          const ids = items.map(item => item.id);
          const next: Drag = { id: item.id, pointerId: event.pointerId, startY: event.clientY, offset: event.clientY - rect.top, top: rect.top, left: rect.left, width: rect.width, height: rect.height, original: ids, current: ids, moved: false };
          dragRef.current = next;
          setDrag(next);
          listRef.current?.setPointerCapture(event.pointerId);
        },
      })}
    </div>)}
    {drag?.moved ? <div ref={overlayRef} aria-hidden="true" className="pointer-events-none fixed z-30 rounded-xl border border-primary bg-surface shadow-[0_16px_38px_rgba(0,0,0,0.18)]"
      style={{ top: drag.top, left: drag.left, width: drag.width, height: drag.height, transform: "scale(1.015)" }}>
      {items.find(item => item.id === drag.id) ? renderOverlay(items.find(item => item.id === drag.id)!) : null}
    </div> : null}
  </div>;
}
