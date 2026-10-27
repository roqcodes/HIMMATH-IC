'use client';

import React from 'react';

interface SkeletonRowsProps {
  cols: number;
  rows?: number;
}

export default function SkeletonRows({ cols, rows = 5 }: SkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-[var(--theme-border-subtle)]">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-3 py-3.5 sm:px-5 sm:py-4">
              <div
                className={`skeleton-bar h-2.5 ${
                  j === 0 ? 'w-24' : j === cols - 1 ? 'ml-auto w-16' : 'w-full max-w-[120px]'
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
