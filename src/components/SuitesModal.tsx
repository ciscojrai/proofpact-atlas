import React, { useEffect } from 'react';
import { X, FlaskConical } from 'lucide-react';
import { VERIFIED_SUITES } from '../data/verifiedSuites';

interface SuitesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SuitesModal: React.FC<SuitesModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="suites-title"
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[#0B0F17] border border-slate-800 rounded-lg shadow-2xl text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-[#0B0F17]">
          <div className="flex items-center gap-2.5">
            <FlaskConical className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <h2 id="suites-title" className="font-display text-sm font-bold text-slate-50">
              Executed verification runs
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close test evidence dialog"
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <p className="px-5 pt-3 text-xs text-slate-400">
          Observed passing runs from this project&apos;s own tooling. Reproduce with
          the listed command — no projected or simulated results.
        </p>
        <ul className="px-5 py-4 space-y-3">
          {VERIFIED_SUITES.map((suite) => (
            <li
              key={suite.name}
              className="rounded-md border border-slate-800 bg-slate-900/50 p-3"
            >
              <div className="text-sm font-semibold text-slate-100">{suite.name}</div>
              <div className="mt-1 font-mono text-[11px] text-sky-300 break-all">
                {suite.command}
              </div>
              <div className="mt-1 text-xs text-emerald-300">{suite.outcome}</div>
              <div className="mt-1 font-mono text-[11px] text-slate-500">
                {suite.source} · {suite.recordedAt}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
