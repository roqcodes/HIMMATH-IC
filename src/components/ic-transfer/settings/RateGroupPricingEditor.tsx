'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formInput, formLabel } from '@/lib/ui';
import { useLinkedRateFields } from '@/lib/icTransfer/useLinkedRateFields';
import {
  IC_SALE_TRANSACTION_TYPES,
  type ICSaleTransactionType,
} from '@/lib/icTransfer/transactionTypes';
import {
  createDefaultPricingConfig,
  createEmptySlabPricing,
  finalizePerTypePricingConfig,
  flatForNormalize,
  getFlatRateFromGroup,
  getTransactionTypePricingMode,
  hydratePricingEditorFromGroup,
  isTransactionPricingConfigured,
  normalizePricingConfig,
  remapPricingConfigToConversion,
} from '@/lib/icTransfer/ratePricing';
import type { NullableFlatRate } from '@/lib/icTransfer/rateFieldInput';
import { formatRateInputValue, getCurrencyUnitRate } from '@/lib/icTransfer/rateCalculations';
import type { ICRateGroup, ICRateGroupPricingConfig, ICRateTransactionPricing } from '@/types';
import FlatRateFields from './FlatRateFields';
import RatePricingTypeSplitPanel, { type RatePricingTab } from './RatePricingTypeSplitPanel';

export type RatePricingEditorValue = {
  flat: NullableFlatRate;
  /** Exact converted/local rate from the input when available (preferred for preview). */
  convertedRate?: number | null;
  pricingConfig: ICRateGroupPricingConfig;
};

type Props = {
  group?: ICRateGroup;
  currency: string;
  convertedRateOnly?: boolean;
  /** Branch: lock FX conversion so local rate ↔ AED stays consistent. */
  lockedConversionRate?: number;
  defaultExpanded?: boolean;
  showExpandToggle?: boolean;
  /**
   * `default` — flat fields + optional expand for advanced.
   * `guided` — mode cards drive a single rate surface (bulk update).
   */
  variant?: 'default' | 'guided';
  idPrefix?: string;
  onChange: (value: RatePricingEditorValue) => void;
};

export default function RateGroupPricingEditor({
  group,
  currency,
  convertedRateOnly = false,
  lockedConversionRate,
  defaultExpanded = false,
  showExpandToggle = true,
  variant = 'default',
  idPrefix = 'pricing',
  onChange,
}: Props) {
  const isGuided = variant === 'guided';
  const [expanded, setExpanded] = useState(defaultExpanded || isGuided);
  const useSplitPanel = isGuided || expanded;
  const effectiveLockedConversion =
    lockedConversionRate != null && lockedConversionRate > 0
      ? lockedConversionRate
      : undefined;
  const baseFlat = useMemo(
    () => (group ? getFlatRateFromGroup(group) : { saleRate: 0, conversionRate: effectiveLockedConversion ?? 1 }),
    [group?.id, group?.saleRate, effectiveLockedConversion],
  );
  const lastEmitKeyRef = useRef<string | null>(null);

  const {
    saleRate,
    conversionRate,
    convertedRate,
    saleRateNum,
    conversionRateNum,
    convertedRateNum,
    onSaleChange,
    onConversionChange,
    onConvertedChange,
    setConversionSilent,
    setSaleSilent,
  } = useLinkedRateFields();

  const initialNullableFlat = useMemo(
    () => ({
      saleRate: baseFlat.saleRate > 0 ? baseFlat.saleRate : null,
      conversionRate: baseFlat.conversionRate > 0 ? baseFlat.conversionRate : null,
    }),
    [baseFlat.saleRate, baseFlat.conversionRate],
  );

  const initialHydration = useMemo(
    () => hydratePricingEditorFromGroup(group),
    [group?.id],
  );

  const [perTypePricing, setPerTypePricing] = useState<
    Partial<NonNullable<ICRateGroupPricingConfig['byTransactionType']>>
  >(() => initialHydration.perTypePricing);
  const [selectedTypes, setSelectedTypes] = useState<ICSaleTransactionType[]>(
    () => initialHydration.selectedTypes,
  );
  const [rateTab, setRateTab] = useState<RatePricingTab>(() => initialHydration.rateTab);

  useEffect(() => {
    lastEmitKeyRef.current = null;
    const hydration = hydratePricingEditorFromGroup(group);

    if (group) {
      const groupFlat = getFlatRateFromGroup(group);
      onSaleChange(groupFlat.saleRate > 0 ? String(groupFlat.saleRate) : '');
      onConversionChange('1');
      onConvertedChange(
        groupFlat.saleRate > 0
          ? String(groupFlat.saleRate)
          : '',
      );
    } else {
      onSaleChange('');
      onConversionChange('1');
      onConvertedChange('');
    }

    setPerTypePricing(hydration.perTypePricing);
    setRateTab(hydration.rateTab);
    setSelectedTypes(hydration.selectedTypes);
  }, [group?.id]);

  const flat: NullableFlatRate = useMemo(
    () => ({
      saleRate: saleRateNum,
      conversionRate: conversionRateNum,
    }),
    [saleRateNum, conversionRateNum],
  );

  const pricingConfig = useMemo(() => {
    if (useSplitPanel) {
      return finalizePerTypePricingConfig(perTypePricing, flatForNormalize(flat), {
        fillMissing: false,
      });
    }
    return normalizePricingConfig(createDefaultPricingConfig(), flatForNormalize(flat));
  }, [useSplitPanel, perTypePricing, flat.saleRate, flat.conversionRate]);

  const emitKey = useMemo(
    () =>
      serializePricingEditorValue({
        flat,
        convertedRate: convertedRateNum,
        pricingConfig,
      }),
    [flat.saleRate, flat.conversionRate, convertedRateNum, pricingConfig, perTypePricing, selectedTypes, rateTab],
  );

  useEffect(() => {
    if (lastEmitKeyRef.current === emitKey) return;
    lastEmitKeyRef.current = emitKey;
    onChange({ flat, convertedRate: convertedRateNum, pricingConfig });
  }, [emitKey, flat, convertedRateNum, pricingConfig, onChange]);

  const applyPricingToSelected = (pricing: ICRateTransactionPricing) => {
    if (selectedTypes.length === 0) return;
    setPerTypePricing(prev => {
      const next = { ...prev };
      for (const type of selectedTypes) {
        next[type] =
          rateTab === 'slab'
            ? {
                mode: 'slab',
                slabs: (pricing.slabs ?? []).map(tier => ({ ...tier })),
              }
            : {
                mode: 'flat',
                saleRate: pricing.saleRate,
                conversionRate: pricing.conversionRate,
              };
      }
      return next;
    });
  };

  const handleSelectedTypesChange = (types: ICSaleTransactionType[]) => {
    setSelectedTypes(types);
    setPerTypePricing(prev => {
      const next = { ...prev };
      const prevSelected = new Set(selectedTypes);

      for (const type of IC_SALE_TRANSACTION_TYPES) {
        if (prevSelected.has(type) && !types.includes(type) && !isTransactionPricingConfigured(prev[type])) {
          delete next[type];
        }
      }

      for (const type of types) {
        const existing = prev[type];
        if (existing?.mode === rateTab) {
          next[type] = existing;
          continue;
        }
        next[type] = rateTab === 'slab' ? createEmptySlabPricing() : { mode: 'flat' };
      }

      return next;
    });
  };

  const handleRateTabChange = (tab: RatePricingTab) => {
    setRateTab(tab);
    setSelectedTypes(prev =>
      prev.filter(type => {
        const mode = getTransactionTypePricingMode(perTypePricing[type]);
        return mode == null || mode === tab;
      }),
    );
  };

  const handleConvertedInput = (value: string) => {
    // Branch: conversion locked → derive AED from local rate.
    if (convertedRateOnly) {
      onConvertedChange(value);
      if (value.trim() === '' || /^-?\d+\.$/u.test(value.trim())) {
        if (value.trim() === '') setSaleSilent('');
        return;
      }

      const converted = Number(value);
      if (!Number.isFinite(converted) || converted <= 0) return;

      const conv =
        effectiveLockedConversion ??
        (conversionRateNum != null && conversionRateNum > 0
          ? conversionRateNum
          : baseFlat.conversionRate > 0
            ? baseFlat.conversionRate
            : 1);

      if (!conversionRate) {
        setConversionSilent(formatRateInputValue(conv));
      }
      setSaleSilent(formatRateInputValue(converted / conv));
      return;
    }

    onConvertedChange(value);
  };

  // Seed / rebase locked conversion for branch bulk / converted-only flows.
  const prevLockedConversionRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!effectiveLockedConversion) {
      prevLockedConversionRef.current = undefined;
      return;
    }

    const prev = prevLockedConversionRef.current;
    prevLockedConversionRef.current = effectiveLockedConversion;

    if (prev == null) {
      if (!conversionRate) {
        setConversionSilent(formatRateInputValue(effectiveLockedConversion));
      }
      return;
    }

    if (prev === effectiveLockedConversion) return;

    // Keep local (sale × conversion) amounts stable when the lock changes.
    const remapped = remapPricingConfigToConversion(
      finalizePerTypePricingConfig(perTypePricing, flatForNormalize(flat)),
      effectiveLockedConversion,
    );
    if (remapped?.byTransactionType) setPerTypePricing(remapped.byTransactionType);

    if (saleRateNum != null && saleRateNum > 0) {
      const priorConv = conversionRateNum != null && conversionRateNum > 0 ? conversionRateNum : prev;
      const local = saleRateNum * priorConv;
      setConversionSilent(formatRateInputValue(effectiveLockedConversion));
      setSaleSilent(formatRateInputValue(local / effectiveLockedConversion));
      onConvertedChange(formatRateInputValue(local));
    } else {
      setConversionSilent(formatRateInputValue(effectiveLockedConversion));
    }
  }, [effectiveLockedConversion]);

  const baseRateFields = (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
      {!convertedRateOnly ? (
        <div className="w-full max-w-[160px]">
          <label className={formLabel} htmlFor={`${idPrefix}-sale`}>
            Rate ({currency})
          </label>
          <input
            id={`${idPrefix}-sale`}
            type="text"
            inputMode="decimal"
            className={`${formInput} tabular-nums`}
            value={saleRate}
            onChange={e => {
              const raw = e.target.value;
              if (raw !== '' && !/^-?\d*\.?\d*$/u.test(raw)) return;
              onSaleChange(raw);
              if (effectiveLockedConversion === 1) {
                onConvertedChange(raw);
              }
            }}
            placeholder="—"
          />
        </div>
      ) : (
        <div className="w-full max-w-[160px]">
          <label className={formLabel} htmlFor={`${idPrefix}-converted`}>
            Rate ({currency})
          </label>
          <input
            id={`${idPrefix}-converted`}
            type="text"
            inputMode="decimal"
            className={`${formInput} tabular-nums`}
            value={convertedRate}
            onChange={e => {
              const raw = e.target.value;
              if (raw !== '' && !/^-?\d*\.?\d*$/u.test(raw)) return;
              handleConvertedInput(raw);
            }}
            placeholder="—"
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {!useSplitPanel ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            Default flat rate for all transaction types. Expand for per-type flat or slab pricing.
          </p>
          {baseRateFields}
        </div>
      ) : null}

      {!isGuided && showExpandToggle ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 transition-colors hover:text-accent"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
            aria-hidden
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          {expanded ? 'Hide per-type pricing' : 'Per-type pricing (flat or slab)'}
        </button>
      ) : null}

      {useSplitPanel ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Pricing mode
          </p>
          <RatePricingTypeSplitPanel
            selectedTypes={selectedTypes}
            onSelectedTypesChange={handleSelectedTypesChange}
            rateTab={rateTab}
            onRateTabChange={handleRateTabChange}
            perTypePricing={perTypePricing}
            onApplyToSelected={applyPricingToSelected}
            flatSeed={flat}
            currency={currency}
            convertedRateOnly={convertedRateOnly}
            lockedConversionRate={effectiveLockedConversion}
            defaultConversionRate={1}
          />
        </div>
      ) : null}
    </div>
  );
}

export function getInitialPricingEditorValue(group?: ICRateGroup): RatePricingEditorValue {
  const groupFlat = group ? getFlatRateFromGroup(group) : null;
  const flat: NullableFlatRate = {
    saleRate: groupFlat && groupFlat.saleRate > 0 ? groupFlat.saleRate : null,
    conversionRate: groupFlat && groupFlat.conversionRate > 0 ? groupFlat.conversionRate : null,
  };
  const convertedRate =
    flat.saleRate != null && flat.conversionRate != null
      ? getCurrencyUnitRate(flat.saleRate, flat.conversionRate)
      : null;
  const { pricingConfig } = hydratePricingEditorFromGroup(group);
  return { flat, convertedRate, pricingConfig };
}

export function serializePricingEditorValue(value: RatePricingEditorValue): string {
  return JSON.stringify({
    saleRate: value.flat.saleRate,
    conversionRate: value.flat.conversionRate,
    convertedRate: value.convertedRate ?? null,
    pricingConfig: value.pricingConfig,
  });
}

export function arePricingEditorValuesEqual(
  a: RatePricingEditorValue,
  b: RatePricingEditorValue,
): boolean {
  return serializePricingEditorValue(a) === serializePricingEditorValue(b);
}
