'use client';

import React from 'react';

type Props = {
  children: React.ReactNode;
  className?: string;
};

export default function PageShell({ children, className = '' }: Props) {
  return <div className={className}>{children}</div>;
}
