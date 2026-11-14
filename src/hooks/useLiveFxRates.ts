import { useState, useEffect, useCallback } from 'react';

export interface LiveFxState {
  /** Rates relative to 1 USD (e.g. rates['EUR'] = 0.92 means 1 USD = 0.92 EUR) */
  rates: Record<string, number> | null;
  sourceLabel: string | null;
  updatedAt: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useLiveFxRates(): LiveFxState {
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let baseRates: Record<string, number> | null = null;
      let provider = '';
      let timestamp = '';

      // Primary real-time fiat FX source (CORS-enabled, no API key required)
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        if (res.ok) {
          const data = await res.json();
          if (data?.result === 'success' && data?.rates && typeof data.rates === 'object') {
            baseRates = { ...data.rates, USD: 1 };
            provider = 'ExchangeRate-API (Live USD Base)';
            timestamp = data.time_last_update_utc || new Date().toISOString();
          }
        }
      } catch {
        // Fall through to secondary provider
      }

      // Secondary real-time ECB reference source
      if (!baseRates) {
        const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD');
        if (!res.ok) {
          throw new Error(`FX service returned HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!data?.rates || typeof data.rates !== 'object') {
          throw new Error('Invalid FX rate payload');
        }
        baseRates = { ...data.rates, USD: 1 };
        provider = 'Frankfurter ECB Reference';
        timestamp = data.date || new Date().toISOString();
      }

      // Optional live digital asset spot rates (USDC & NEAR in USD) from CoinGecko
      try {
        const cgRes = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,near&vs_currencies=usd'
        );
        if (cgRes.ok) {
          const cgData = await cgRes.json();
          const usdcUsd = cgData?.['usd-coin']?.usd;
          const nearUsd = cgData?.near?.usd;
          if (typeof usdcUsd === 'number' && usdcUsd > 0) {
            baseRates['USDC'] = 1 / usdcUsd;
          }
          if (typeof nearUsd === 'number' && nearUsd > 0) {
            baseRates['NEAR'] = 1 / nearUsd;
          }
          if (typeof usdcUsd === 'number' || typeof nearUsd === 'number') {
            provider += ' + CoinGecko Spot';
          }
        }
      } catch {
        // CoinGecko optional; keep live fiat rates without inventing crypto rates
      }

      setRates(baseRates);
      setSourceLabel(provider);
      setUpdatedAt(timestamp);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to fetch real-time exchange rates. Check network connectivity.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  return {
    rates,
    sourceLabel,
    updatedAt,
    isLoading,
    error,
    refresh: fetchRates,
  };
}
