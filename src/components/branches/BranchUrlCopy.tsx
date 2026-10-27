'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { branchPortalAbsoluteUrl, branchPortalHomePath, branchPortalLoginPath } from '@/lib/asic/routing';
import { useApp } from '@/context/AppContext';

function IconCopy({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function IconCheck({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

type Props = {
  slug: string;
  /** Show full absolute URL when true (detail page). Table rows use path only. */
  absolute?: boolean;
  className?: string;
};

export default function BranchUrlCopy({ slug, absolute = false, className = '' }: Props) {
  const { showToast } = useApp();
  const [copied, setCopied] = useState(false);
  const path = branchPortalLoginPath(slug);
  const [displayUrl, setDisplayUrl] = useState(path);

  useEffect(() => {
    if (absolute && typeof window !== 'undefined') {
      setDisplayUrl(branchPortalAbsoluteUrl(slug, window.location.origin));
    } else {
      setDisplayUrl(path);
    }
  }, [absolute, slug, path]);

  const copyUrl = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url =
      typeof window !== 'undefined'
        ? branchPortalAbsoluteUrl(slug, window.location.origin)
        : path;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast('Branch URL copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Could not copy URL', 'error');
    }
  };

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 ${className}`}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      <Link
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 truncate font-mono text-xs text-accent hover:underline"
        title={absolute ? displayUrl : `Open ${path}`}
        onClick={e => e.stopPropagation()}
      >
        {displayUrl}
      </Link>
      <button
        type="button"
        className="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        onClick={copyUrl}
        aria-label="Copy branch URL"
        title="Copy URL"
      >
        {copied ? <IconCheck className="text-emerald-600" /> : <IconCopy />}
      </button>
    </span>
  );
}

export function BranchPortalLinks({ slug }: { slug: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={branchPortalLoginPath(slug)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-accent hover:underline"
      >
        Open login page
      </Link>
      <span className="text-slate-300">·</span>
      <Link
        href={branchPortalHomePath(slug)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-accent hover:underline"
      >
        Open branch portal
      </Link>
    </div>
  );
}
