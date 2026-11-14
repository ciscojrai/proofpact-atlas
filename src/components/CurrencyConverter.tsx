import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeftRight, RefreshCw, X } from 'lucide-react';
import { LiveFxState } from '../hooks/useLiveFxRates';

interface CurrencyConverterProps {
  fx: LiveFxState;
  suggestedAmount?: string;
  suggestedCurrency?: string;
  suggestedLabel?: string;
  variant?: 'inline' | 'modal';
  isOpen?: boolean;
  onClose?: () => void;
}

const CURRENCY_LABELS: Record<string, string> = {
  USD: 'US Dollar',
  USDC: 'USD Coin (Spot)',
  NEAR: 'NEAR Protocol (Spot)',
  EUR: 'Euro',
  GBP: 'British Pound',
  SGD: 'Singapore Dollar',
  BRL: 'Brazilian Real',
  CAD: 'Canadian Dollar',
  JPY: 'Japanese Yen',
  CHF: 'Swiss Franc',
  AUD: 'Australian Dollar',
};

const PREFERRED_ORDER = ['USD', 'USDC', 'NEAR', 'EUR', 'GBP', 'SGD', 'BRL', 'CAD', 'JPY', 'CHF', 'AUD'];

export const CurrencyConverter: React.FC<CurrencyConverterProps> = ({
  fx,
  suggestedAmount = '14.00',
  suggestedCurrency = 'USD',
  suggestedLabel,
  variant = 'inline',
  isOpen = true,
  onClose,
}) => {
  const [amountInput, setAmountInput] = useState<string>(suggestedAmount);
  const [fromCurrency, setFromCurrency] = useState<string>('USD');
  const [toCurrency, setToCurrency] = useState<string>('EUR');

  const availableCurrencies = useMemo(() => {
    if (!fx.rates) return [];
    const keys = Object.keys(fx.rates);
    const preferred = PREFERRED_ORDER.filter((c) => keys.includes(c));
    const others = keys.filter((c) => !PREFERRED_ORDER.includes(c)).sort();
    return [...preferred, ...others];
  }, [fx.rates]);

  // Keep selected currencies valid when live rates load
  useEffect(() => {
    if (!fx.rates) return;
    if (!fx.rates[fromCurrency]) {
      setFromCurrency(fx.rates[suggestedCurrency] ? suggestedCurrency : 'USD');
    }
    if (!fx.rates[toCurrency]) {
      setToCurrency(fx.rates['EUR'] ? 'EUR' : 'USD');
    }
  }, [fx.rates, fromCurrency, toCurrency, suggestedCurrency]);

  // Close modal on Escape
  useEffect(() => {
    if (variant !== 'modal' || !isOpen || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variant, isOpen, onClose]);

  const numericAmount = useMemo(() => {
    const parsed = Number.parseFloat(amountInput);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [amountInput]);

  const convertedAmount = useMemo(() => {
    if (!fx.rates) return null;
    const fromRate = fx.rates[fromCurrency];
    const toRate = fx.rates[toCurrency];
    if (!fromRate || !toRate) return null;
    return (numericAmount / fromRate) * toRate;
  }, [fx.rates, numericAmount, fromCurrency, toCurrency]);

  const unitRate = useMemo(() => {
    if (!fx.rates) return null;
    const fromRate = fx.rates[fromCurrency];
    const toRate = fx.rates[toCurrency];
    if (!fromRate || !toRate) return null;
    return toRate / fromRate;
  }, [fx.rates, fromCurrency, toCurrency]);

  const quickReferenceCurrencies = useMemo(() => {
    if (!fx.rates) return [];
    return ['USD', 'EUR', 'GBP', 'SGD', 'BRL', 'JPY'].filter(
      (code) => code !== fromCurrency && typeof fx.rates?.[code] === 'number'
    );
  }, [fx.rates, fromCurrency]);

  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  if (variant === 'modal' && !isOpen) return null;

  const content = (
    <div className="space-y-3 text-xs">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-100">Real-Time FX Reference Converter</h3>
          <p className="text-[11px] text-slate-400">
            Live market rates · Read-only reference (does not mutate settlement records)
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={fx.refresh}
            disabled={fx.isLoading}
            aria-label="Refresh live exchange rates"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <RefreshCw className={`w-3 h-3 ${fx.isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{fx.isLoading ? 'Updating' : 'Refresh'}</span>
          </button>
          {variant === 'modal' && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close currency converter"
              className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Loading / Error / Ready States */}
      {fx.error && !fx.rates ? (
        <div className="p-3 rounded-md border border-rose-500/40 bg-rose-950/25 space-y-2">
          <div className="font-semibold text-rose-300">Live FX Rate Fetch Failed</div>
          <p className="text-[11px] text-slate-300">{fx.error}</p>
          <button
            type="button"
            onClick={fx.refresh}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Retry Live Fetch
          </button>
        </div>
      ) : fx.isLoading && !fx.rates ? (
        <div className="p-4 rounded-md border border-slate-800 bg-[#070A10] text-slate-400 font-mono text-[11px]">
          Loading real-time exchange rates...
        </div>
      ) : (
        <>
          {/* Amount & Quick Work-Order Prefill */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`fx-amount-${variant}`} className="text-[11px] text-slate-400">
                Amount
              </label>
              {suggestedAmount && (
                <button
                  type="button"
                  onClick={() => {
                    setAmountInput(suggestedAmount);
                    if (fx.rates?.[suggestedCurrency]) {
                      setFromCurrency(suggestedCurrency);
                    } else if (suggestedCurrency === 'USDC' && fx.rates?.['USD']) {
                      setFromCurrency('USD');
                    }
                  }}
                  className="text-[11px] font-mono text-sky-300 hover:text-sky-200 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded"
                >
                  Use {suggestedLabel ?? `${suggestedAmount} ${suggestedCurrency}`}
                </button>
              )}
            </div>
            <input
              id={`fx-amount-${variant}`}
              type="number"
              min="0"
              step="0.01"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full bg-[#070A10] border border-slate-800 focus:border-sky-500/60 rounded-md px-3 py-2 text-sm font-mono text-slate-100 tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          </div>

          {/* Currency Selectors */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div className="space-y-1 min-w-0">
              <label htmlFor={`fx-from-${variant}`} className="text-[11px] text-slate-400 block">
                From
              </label>
              <select
                id={`fx-from-${variant}`}
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
                className="w-full bg-[#070A10] border border-slate-800 rounded-md px-2.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                {availableCurrencies.map((code) => (
                  <option key={code} value={code} className="bg-[#0B0F17] text-slate-100">
                    {code}{CURRENCY_LABELS[code] ? ` · ${CURRENCY_LABELS[code]}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleSwap}
              aria-label="Swap source and target currencies"
              className="p-2 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            <div className="space-y-1 min-w-0">
              <label htmlFor={`fx-to-${variant}`} className="text-[11px] text-slate-400 block">
                To
              </label>
              <select
                id={`fx-to-${variant}`}
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
                className="w-full bg-[#070A10] border border-slate-800 rounded-md px-2.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                {availableCurrencies.map((code) => (
                  <option key={code} value={code} className="bg-[#0B0F17] text-slate-100">
                    {code}{CURRENCY_LABELS[code] ? ` · ${CURRENCY_LABELS[code]}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Converted Result */}
          <div className="p-3 rounded-md bg-[#070A10] border border-slate-800 flex items-baseline justify-between gap-3">
            <div className="text-[11px] text-slate-400">
              {unitRate !== null && (
                <span className="font-mono">
                  1 {fromCurrency} = {unitRate.toFixed(toCurrency === 'JPY' ? 2 : 4)} {toCurrency}
                </span>
              )}
            </div>
            <div className="font-mono text-base font-bold text-sky-300 tabular-nums text-right">
              {convertedAmount !== null
                ? `${convertedAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: toCurrency === 'JPY' ? 0 : 4,
                  })} ${toCurrency}`
                : 'Unavailable'}
            </div>
          </div>

          {/* Quick Reference Strip */}
          {quickReferenceCurrencies.length > 0 && fx.rates?.[fromCurrency] && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              {quickReferenceCurrencies.slice(0, 3).map((code) => {
                const val = (numericAmount / fx.rates![fromCurrency]) * fx.rates![code];
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setToCurrency(code)}
                    className={`p-2 rounded border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                      toCurrency === code
                        ? 'bg-[#131B29] border-sky-500/50'
                        : 'bg-[#070A10] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-[10px] font-mono text-slate-400">{code}</div>
                    <div className="text-xs font-mono font-semibold text-slate-100 tabular-nums mt-0.5">
                      {val.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: code === 'JPY' ? 0 : 2,
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Source Attribution Footer */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>Source: {fx.sourceLabel ?? 'Live FX API'}</span>
            <span className="font-mono truncate max-w-[210px]" title={fx.updatedAt ?? undefined}>
              {fx.updatedAt ?? 'Timestamp pending'}
            </span>
          </div>
        </>
      )}
    </div>
  );

  if (variant === 'modal') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Real-Time FX Reference Converter"
      >
        <div
          className="w-full max-w-md bg-[#0B0F17] border border-slate-800 rounded-lg shadow-2xl p-5 text-slate-200"
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-slate-800 rounded-md bg-[#080C14] p-4">
      {content}
    </div>
  );
};
