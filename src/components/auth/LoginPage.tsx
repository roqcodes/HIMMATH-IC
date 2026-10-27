'use client';
import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import PasswordInput from '@/components/ui/PasswordInput';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { loginAction, resolvePostLoginPathAction } from '@/app/actions/auth';
import { authSessionSlug } from '@/lib/icTransfer/warehouseSlug';
import { btnPrimary, formInput } from '@/lib/ui';
import { PRODUCT_NAME } from '@/lib/brand';

export default function LoginPage({ branchSlug }: { branchSlug?: string }) {
  const { branches } = useApp();
  
  const branch = branchSlug
    ? branches.find(
        (b: { slug?: string; name: string; location?: string }) =>
          b.slug === branchSlug || b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === branchSlug,
      )
    : null;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setLoading(true);

    let didNavigate = false;

    try {
      const sessionSlug = authSessionSlug(branchSlug);
      const res = await loginAction(email, password, sessionSlug);
      if (res.success && res.data) {
        const nextPath = await resolvePostLoginPathAction(
          res.data.role,
          sessionSlug,
          res.data.branchId,
        );
        didNavigate = true;
        window.location.replace(nextPath);
        return;
      } else {
        setError(res.error || 'Authentication failed. Please try again.');
      }
    } catch (e: any) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      if (!didNavigate) setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center bg-slate-50 px-4 py-8 dark:bg-[var(--theme-canvas)]">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          className="size-full stroke-[rgba(209,20,57,0.2)] stroke-[1.5]"
        >
          <path d="M-100,200 Q250,100 500,200 T1100,200" fill="none" vectorEffect="non-scaling-stroke" />
          <path d="M-100,500 Q250,400 500,500 T1100,500" fill="none" vectorEffect="non-scaling-stroke" />
          <path d="M-100,800 Q250,700 500,800 T1100,800" fill="none" vectorEffect="non-scaling-stroke" />
          <circle cx="250" cy="150" r="3" fill="rgba(209, 20, 57, 0.3)" />
          <circle cx="750" cy="450" r="3" fill="rgba(209, 20, 57, 0.3)" />
          <circle cx="500" cy="750" r="3" fill="rgba(209, 20, 57, 0.3)" />
        </svg>
      </div>

      <div className="relative z-[1] w-full max-w-[400px] overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]">
        <div className="border-b border-slate-200 px-6 py-5 text-center dark:border-[var(--theme-border)]">
          <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-[var(--theme-text)]">
            {branch ? branch.name : PRODUCT_NAME}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {branch ? `${branch.location} portal` : 'Sign in'}
          </p>
        </div>

        <form className="space-y-4 px-6 pb-8 pt-6 sm:px-8" onSubmit={handleSubmit}>
          <div className="group space-y-2.5">
            <label htmlFor="login-email" className="block text-sm font-semibold text-slate-600 transition group-focus-within:translate-x-1 group-focus-within:text-accent">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              placeholder="admin@aibak.capital"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className={`${formInput} h-10 max-md:h-11`}
            />
          </div>

          <div className="group space-y-2.5">
            <label htmlFor="login-password" className="block text-sm font-semibold text-slate-600 transition group-focus-within:translate-x-1 group-focus-within:text-accent">
              Security Key
            </label>
            <PasswordInput
              id="login-password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              inputClassName={`${formInput} h-10 max-md:h-11 ${error ? 'border-red-400 focus-visible:border-red-500' : ''}`}
            />
            {error && <p className="text-[13px] font-semibold text-red-600">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            id="login-submit"
            className={`${btnPrimary} h-10 w-full max-md:h-11 text-base hover:bg-accent dark:hover:bg-accent`}
          >
            {loading ? (
              <span className="flex gap-1" aria-hidden>
                <span className="size-1.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-current" />
                <span className="size-1.5 animate-[pulse_1.2s_ease-in-out_0.2s_infinite] rounded-full bg-current" />
                <span className="size-1.5 animate-[pulse_1.2s_ease-in-out_0.4s_infinite] rounded-full bg-current" />
              </span>
            ) : (
              <>
                <span>Login</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>

          <div className="border-t border-black/[0.06] pt-6 text-center dark:border-[var(--theme-border)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Encryption Active • v2.0.26</p>
          </div>
        </form>
      </div>
    </div>
  );
}
