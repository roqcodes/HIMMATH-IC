'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

type Props = {
  imageUrl?: string | null;
  onUpload: (file: File) => void | Promise<void>;
  onClear?: () => void;
  isUploading?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  showCapture?: boolean;
  className?: string;
  /** Shorter drop/preview area for dense modals. */
  compact?: boolean;
  /** Grow drop/preview to fill parent flex column (e.g. sale modal left pane). */
  fillHeight?: boolean;
};

export default function ImageDropZone({
  imageUrl,
  onUpload,
  onClear,
  isUploading = false,
  disabled = false,
  emptyLabel = 'Drop an image here, click to browse, or paste from clipboard',
  showCapture = false,
  className = '',
  compact = false,
  fillHeight = false,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [pasting, setPasting] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  const busy = isUploading || pasting;
  const inactive = disabled || busy;

  const processFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file || !file.type.startsWith('image/')) return;
      await onUpload(file);
    },
    [onUpload],
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (inactive) return;
    const file = e.dataTransfer.files?.[0];
    await processFile(file);
  };

  const handlePasteFromClipboard = async () => {
    if (inactive) return;
    setPasting(true);
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find(t => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const ext = imageType.split('/')[1]?.split('+')[0] || 'png';
            const file = new File([blob], `pasted-image.${ext}`, { type: imageType });
            await processFile(file);
            return;
          }
        }
      }
      alert('No image found on clipboard. Copy an image first, then tap Paste.');
    } catch {
      alert('Could not read clipboard. Try Ctrl+V while the drop zone is focused, or use Upload.');
    } finally {
      setPasting(false);
    }
  };

  useEffect(() => {
    const el = zoneRef.current;
    if (!el || inactive) return;

    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void processFile(file);
            return;
          }
        }
      }
    };

    el.addEventListener('paste', onPaste);
    return () => el.removeEventListener('paste', onPaste);
  }, [inactive, processFile]);

  const fileInputs = (
    <>
      <input
        ref={galleryRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={handleFileChange}
        disabled={inactive}
      />
      {showCapture ? (
        <input
          ref={cameraRef}
          type="file"
          accept={ACCEPT}
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
          disabled={inactive}
        />
      ) : null}
    </>
  );

  const actionButtons = (
    <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-2'}`}>
      {showCapture ? (
        <button
          type="button"
          disabled={inactive}
          onClick={() => cameraRef.current?.click()}
          className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 ${
            compact ? 'px-2 py-1 text-[10px]' : 'gap-1.5 px-3 py-2 text-xs'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          {busy ? 'Uploading…' : 'Capture'}
        </button>
      ) : null}
      <button
        type="button"
        disabled={inactive}
        onClick={() => galleryRef.current?.click()}
        className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 ${
          compact ? 'px-2 py-1 text-[10px]' : 'gap-1.5 px-3 py-2 text-xs'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {busy ? 'Uploading…' : 'Upload'}
      </button>
      <button
        type="button"
        disabled={inactive}
        onClick={() => void handlePasteFromClipboard()}
        className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 font-bold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50 ${
          compact ? 'px-2 py-1 text-[10px]' : 'gap-1.5 px-3 py-2 text-xs'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        {pasting ? 'Pasting…' : 'Paste'}
      </button>
    </div>
  );

  const rootLayoutClass = fillHeight ? 'flex h-full min-h-0 flex-1 flex-col' : '';
  const previewSizeClass = fillHeight
    ? 'min-h-[4rem] flex-1'
    : compact
      ? 'h-[4rem]'
      : 'aspect-[4/3]';

  if (imageUrl) {
    return (
      <div className={`${rootLayoutClass} gap-2 ${className}`}>
        <div
          className={`group relative ${previewSizeClass} overflow-hidden rounded-lg border border-slate-200 bg-slate-50`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Uploaded" className="absolute inset-0 h-full w-full object-contain" />
        </div>
        {!disabled ? (
          <div className="shrink-0 space-y-2">
            {actionButtons}
            {onClear ? (
              <button
                type="button"
                className={`w-full rounded-lg border border-slate-200 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 ${
                  compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-xs'
                }`}
                onClick={onClear}
                disabled={inactive}
              >
                Remove image
              </button>
            ) : null}
          </div>
        ) : null}
        {fileInputs}
      </div>
    );
  }

  return (
    <div className={`${rootLayoutClass} ${className}`}>
      <div
        ref={zoneRef}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label="Image upload drop zone"
        onDragOver={e => {
          e.preventDefault();
          if (!inactive) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => void handleDrop(e)}
        onClick={() => {
          if (!inactive) galleryRef.current?.click();
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!inactive) galleryRef.current?.click();
          }
        }}
        className={`flex ${previewSizeClass} cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
          dragOver
            ? 'border-accent bg-accent/5 text-accent'
            : 'border-slate-200 bg-slate-50/80 text-slate-400 hover:border-slate-300 hover:bg-slate-100/50'
        } ${inactive ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <svg
          width={compact ? 22 : 32}
          height={compact ? 22 : 32}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="opacity-60"
          aria-hidden
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className={`max-w-[16rem] font-medium text-slate-500 ${compact ? 'text-[10px] leading-snug' : 'text-xs'}`}>
          {busy ? 'Uploading…' : emptyLabel}
        </p>
        {!compact ? (
          <p className="text-[10px] text-slate-400">Drag & drop · Click · Ctrl+V · Paste button</p>
        ) : null}
      </div>
      {!disabled ? <div className={`shrink-0 ${compact ? 'mt-1.5' : 'mt-2'}`}>{actionButtons}</div> : null}
      {fileInputs}
    </div>
  );
}
