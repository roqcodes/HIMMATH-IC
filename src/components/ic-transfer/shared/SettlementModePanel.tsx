'use client';

import React from 'react';
import { SmoothHeight } from '@/components/ui/SmoothHeight';
import { icFormStackGap } from './icTransferFormModalLayout';

type Props = {
  active: 'cash' | 'metal';
  metal: React.ReactNode;
  cash: React.ReactNode;
};

/** Single visible panel with animated height when switching cash ↔ metal. */
export default function SettlementModePanel({ active, metal, cash }: Props) {
  const isMetal = active === 'metal';
  return (
    <SmoothHeight>
      <div className={`flex min-w-0 flex-col ${icFormStackGap}`}>{isMetal ? metal : cash}</div>
    </SmoothHeight>
  );
}
