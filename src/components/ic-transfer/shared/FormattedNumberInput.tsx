'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  formatNumericInputDisplay,
  formatNumericInputPlain,
  parseGroupedNumberInput,
  type NumericInputBook,
} from '@/lib/icTransfer/numberInputFormat';
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
    setDraft(formatNumericInputPlain(value, maxFractionDigits));
  };

  const handleBlur = () => {
    if (readOnly || disabled) return;
    setFocused(false);
    const parsed = parseGroupedNumberInput(draft);
    onNumericChange(parsed);
    setDraft(formatNumericInputDisplay(parsed, book, maxFractionDigits));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly || disabled) return;
    const raw = e.target.value;
    setDraft(raw);
    onNumericChange(parseGroupedNumberInput(raw));
  };

  return (
    <input
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
