'use client';

import React from 'react';
import { asicBtnPrimary } from '@/components/asic/ui';
import { useWriteAccess } from '@/context/RbacWriteContext';

type Props = {
  label: string;
  onClick: () => void;
  ariaLabel?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

const defaultIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    aria-hidden
    className="shrink-0"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/** Primary page action — matches Branches header CTA. */
export default function AddButton({ label, onClick, ariaLabel, icon, disabled = false }: Props) {
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const rbac = wp({ disabled });
  const blocked = !canWrite || disabled;

  return (
    <button
      type="button"
      {...rbac}
      onClick={blocked ? undefined : onClick}
      className={`${asicBtnPrimary} gap-1.5${blocked ? ' cursor-not-allowed opacity-50' : ''}`}
      aria-label={ariaLabel || label}
    >
      {icon || defaultIcon}
      {label}
    </button>
  );
}
