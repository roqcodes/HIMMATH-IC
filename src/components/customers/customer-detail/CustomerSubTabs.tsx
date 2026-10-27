'use client';

import React from 'react';
import AsicTabBar, { type AsicTabItem } from '@/components/asic/AsicTabBar';

interface Props {
  tabs: AsicTabItem[];
  active: string;
  onChange: (id: string) => void;
}

/** Pill-style customer sub-tabs — uses shared AsicTabBar badge styling. */
export default function CustomerSubTabs({ tabs, active, onChange }: Props) {
  return (
    <AsicTabBar
      tabs={tabs}
      activeTab={active}
      onTabChange={onChange}
      ariaLabel="Customer activity"
      className="!px-2 !pt-1"
    />
  );
}
