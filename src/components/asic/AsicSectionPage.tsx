'use client';

import React from 'react';
import ASICSectionRouter from '@/components/asic/ASICSectionRouter';
import type { AsicPortal } from '@/lib/asic/routing';
import type { AsicSectionId } from '@/lib/asic/pages';

/** Main content only — shell lives in portal route layouts. */
export default function AsicSectionPage({
  portal,
  section,
  slug,
}: {
  portal: AsicPortal;
  section: AsicSectionId;
  slug?: string;
}) {
  return <ASICSectionRouter portal={portal} section={section} slug={slug} />;
}
