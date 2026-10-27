'use client';

import React from 'react';
import { useWriteAccess } from '@/context/RbacWriteContext';

type WriteGateProps = {
  children: React.ReactNode;
  className?: string;
};

/** Disables interactive controls inside header/toolbar action groups when the user has read-only access. */
export default function WriteGate({ children, className = '' }: WriteGateProps) {
  const { canWrite, writeBlockedReason } = useWriteAccess();

  if (!children) return null;

  return (
    <fieldset
      disabled={!canWrite}
      className={`m-0 min-w-0 border-0 p-0 ${className} ${!canWrite ? 'opacity-50 [&_button]:cursor-not-allowed' : ''}`}
      title={!canWrite ? writeBlockedReason : undefined}
    >
      {children}
    </fieldset>
  );
}
