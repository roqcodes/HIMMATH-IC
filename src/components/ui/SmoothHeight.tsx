'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const DEFAULT_MS = 280;

type BaseProps = {
  children: React.ReactNode;
  className?: string;
  durationMs?: number;
};

/** Animates height when children change (e.g. swap cash ↔ metal panels). */
export function SmoothHeight({ children, className = '', durationMs = DEFAULT_MS }: BaseProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const measure = () => {
      setHeight(el.scrollHeight);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div
      className={`overflow-hidden motion-safe:transition-[height] motion-reduce:transition-none ${className}`}
      style={{
        height: height ?? 'auto',
        transitionDuration: `${durationMs}ms`,
        transitionTimingFunction: EASE,
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

type CollapseProps = BaseProps & {
  open: boolean;
};

/** Expands / contracts when `open` toggles (e.g. Cash vs AED fields). */
export function SmoothCollapse({
  open,
  children,
  className = '',
  durationMs = DEFAULT_MS,
}: CollapseProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const measure = () => {
      setHeight(open ? el.scrollHeight : 0);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, children]);

  return (
    <div
      className={`overflow-hidden motion-safe:transition-[height] motion-reduce:transition-none ${className}`}
      style={{
        height,
        transitionDuration: `${durationMs}ms`,
        transitionTimingFunction: EASE,
      }}
      aria-hidden={!open}
    >
      <div
        ref={innerRef}
        className={`motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none ${
          open ? 'opacity-100' : 'opacity-0'
        } ${open ? '' : 'pointer-events-none'}`}
        inert={open ? undefined : true}
      >
        {children}
      </div>
    </div>
  );
}

const modeSwapEnter =
  'motion-safe:animate-[fade-in-subtle_0.26s_cubic-bezier(0.16,1,0.3,1)_both] motion-reduce:animate-none';

/** Height + subtle enter when `mode` changes (cash ↔ metal panels). */
export function SmoothModeSwap({
  mode,
  children,
  className = '',
  durationMs = DEFAULT_MS,
}: BaseProps & { mode: string }) {
  return (
    <SmoothHeight className={className} durationMs={durationMs}>
      <div key={mode} className={modeSwapEnter}>
        {children}
      </div>
    </SmoothHeight>
  );
}
