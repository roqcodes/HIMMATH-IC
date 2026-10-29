'use client';

import React from 'react';
import AsicSectionPage from '@/components/asic/AsicSectionPage';
import { AdminPortalLayout, SlugPortalLayout } from '@/components/asic/AsicPortalLayout';
import type { AsicPortal } from '@/lib/asic/routing';
import type { AsicSectionId } from '@/lib/asic/pages';

/**
 * Legacy entry — prefer route layouts (`AsicPortalLayout`) + `AsicSectionPage`.
 * Wraps content in the portal shell when used outside those layouts.
 */
export default function ASICApp({
  portal,
  section,
  slug,
}: {
  portal: AsicPortal;
  section: AsicSectionId;
  slug?: string;
}) {
  const body = <AsicSectionPage portal={portal} section={section} slug={slug} />;

  if (portal === 'admin') {
    return <AdminPortalLayout>{body}</AdminPortalLayout>;
  }

  if (portal === 'warehouse' || portal === 'customer' || portal === 'delivery') {
    return <SlugPortalLayout portal={portal}>{body}</SlugPortalLayout>;
  }

  return body;
}
