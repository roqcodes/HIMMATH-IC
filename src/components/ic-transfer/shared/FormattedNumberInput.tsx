'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  formatGroupedNumberInputDraft,
  mapCaretThroughNumericFormat,
  formatNumericInputDisplay,
  parseGroupedNumberInput,
  type NumericInputBook,
} from '@/lib/icTransfer/numberInputFormat';
import { LEDGER_MONEY_DECIMAL_PLACES, roundMoney } from '@/lib/icFunds/currencyPolicy';
import { RATE_DECIMAL_PLACES } from '@/lib/icTransfer/rateCalculations';

type Props = {
  value: number;
  onNumericChange: (n: number) => void;
  book: NumericInputBook;
  maxFractionDigits?: number;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  title?: string;
  id?: string;
  'aria-readonly'?: boolean;
};

export default function FormattedNumberInput({
  value,
  onNumericChange,
  book,
  maxFractionDigits = RATE_DECIMAL_PLACES,
  className,
  disabled,
  readOnly,
  placeholder,
  title,
  id,
  'aria-readonly': ariaReadonly,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const caretAfterFormatRef = useRef<number | null>(null);

  const syncDraftFromValue = useCallback(() => {
    setDraft(formatNumericInputDisplay(value, book, maxFractionDigits));
  }, [value, book, maxFractionDigits]);

  useEffect(() => {
    if (!focused && !readOnly) {
      syncDraftFromValue();
    }
  }, [focused, readOnly, syncDraftFromValue]);

  useEffect(() => {
    if (readOnly) {
      setDraft(formatNumericInputDisplay(value, book, maxFractionDigits));
    }
  }, [readOnly, value, book, maxFractionDigits]);

  const handleFocus = () => {
    if (readOnly || disabled) return;
    setFocused(true);
    setDraft(formatNumericInputDisplay(value, book, maxFractionDigits));
  };

  const handleBlur = () => {
    if (readOnly || disabled) return;
    setFocused(false);
    let parsed = parseGroupedNumberInput(draft);
    if (maxFractionDigits <= LEDGER_MONEY_DECIMAL_PLACES) {
      parsed = roundMoney(parsed);
    }
    onNumericChange(parsed);
    setDraft(formatNumericInputDisplay(parsed, book, maxFractionDigits));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly || disabled) return;
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    const formatted = formatGroupedNumberInputDraft(raw, book, maxFractionDigits);
    caretAfterFormatRef.current = mapCaretThroughNumericFormat(raw, formatted, caret);
    setDraft(formatted);
    onNumericChange(parseGroupedNumberInput(formatted));
  };

  useEffect(() => {
    const el = inputRef.current;
    const nextCaret = caretAfterFormatRef.current;
    if (!el || nextCaret == null || !focused) return;
    caretAfterFormatRef.current = null;
    requestAnimationFrame(() => {
      el.setSelectionRange(nextCaret, nextCaret);
    });
  }, [draft, focused]);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      placeholder={placeholder}
      title={title}
      value={draft}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      aria-readonly={ariaReadonly}
    />
  );
}
