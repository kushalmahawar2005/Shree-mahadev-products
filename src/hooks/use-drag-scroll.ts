"use client";

import { useEffect } from "react";

/**
 * Mouse drag-to-scroll (with a little momentum) for a horizontal overflow rail, so desktop users
 * can swipe a shelf like on a phone. Touch keeps native swipe. A drag never triggers the click
 * on the card under the pointer. Same behaviour as motion/DragScroll, as a hook for existing rails.
 */
export function useDragScroll(el: HTMLElement | null) {
  useEffect(() => {
    if (!el) return;
    let down = false;
    let moved = false;
    let startX = 0;
    let startLeft = 0;
    let lastX = 0;
    let lastT = 0;
    let v = 0;
    let raf = 0;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true;
      moved = false;
      startX = lastX = e.clientX;
      startLeft = el.scrollLeft;
      lastT = performance.now();
      v = 0;
      cancelAnimationFrame(raf);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) {
        moved = true;
        el.style.scrollSnapType = "none";
        el.style.scrollBehavior = "auto";
        el.style.cursor = "grabbing";
        el.style.userSelect = "none";
        el.setPointerCapture(e.pointerId);
      }
      if (!moved) return;
      el.scrollLeft = startLeft - dx;
      const now = performance.now();
      v = (e.clientX - lastX) / Math.max(1, now - lastT);
      lastX = e.clientX;
      lastT = now;
    };
    const settle = () => {
      el.style.scrollSnapType = "";
      el.style.scrollBehavior = "";
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      el.style.cursor = "";
      el.style.userSelect = "";
      if (!moved) return;
      let speed = v * 16;
      const step = () => {
        speed *= 0.94;
        el.scrollLeft -= speed;
        if (Math.abs(speed) > 0.5) raf = requestAnimationFrame(step);
        else settle();
      };
      raf = requestAnimationFrame(step);
    };
    const onClick = (e: MouseEvent) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    };
    // Stop the browser's own image/link drag ghost from hijacking the gesture.
    const onDragStart = (e: DragEvent) => e.preventDefault();

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("click", onClick, true);
    el.addEventListener("dragstart", onDragStart);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("dragstart", onDragStart);
    };
  }, [el]);
}
