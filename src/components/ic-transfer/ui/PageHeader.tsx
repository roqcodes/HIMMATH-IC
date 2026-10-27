'use client';

import React from 'react';
import AsicPageHeader from '@/components/asic/AsicPageHeader';

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, actions }: Props) {
  return <AsicPageHeader title={title} subtitle={subtitle} actions={actions} />;
}
