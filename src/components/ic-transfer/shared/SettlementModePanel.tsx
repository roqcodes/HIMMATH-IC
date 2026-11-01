'use client';

import React from 'react';

type Props = {
  active: 'cash' | 'metal';
  metal: React.ReactNode;
  cash: React.ReactNode;
};

/**
 * Stacks cash + metal in one grid cell so height = max(both panels).
 * Toggling mode does not resize the modal; inactive panel is inert (skipped by validation).
 */
export default function SettlementModePanel({ active, metal, cash }: Props) {
  const isMetal = active === 'metal';
  return (
    <div className="grid min-w-0 [&>*]:col-start-1 [&>*]:row-start-1 [&>*]:min-w-0">
      <div
        className={`flex flex-col gap-2 ${isMetal ? 'z-[1]' : 'pointer-events-none invisible'}`}
        aria-hidden={!isMetal}
        inert={!isMetal ? true : undefined}
      >
        {metal}
      </div>
      <div
        className={`flex flex-col gap-2 ${!isMetal ? 'z-[1]' : 'pointer-events-none invisible'}`}
        aria-hidden={isMetal}
        inert={isMetal ? true : undefined}
      >
        {cash}
      </div>
    </div>
  );
}
