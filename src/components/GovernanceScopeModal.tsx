import React, { useEffect } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { WORKSPACE_NAME, DATA_MODE, DATA_SOURCE_LABEL } from '../data/operationsData';

interface GovernanceScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GovernanceScopeModal: React.FC<GovernanceScopeModalProps> = ({ isOpen, onClose }) => {
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
      aria-labelledby="governance-scope-title"
    >
      <div
        className="w-full max-w-xl bg-[#0B0F17] border border-slate-800 rounded-lg shadow-2xl overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h2 id="governance-scope-title" className="font-display text-sm font-bold text-slate-50">
              ProofPact Atlas — Governance & Data Mode Scope
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close governance scope dialog"
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs leading-relaxed">
          <p className="text-slate-300">
            ProofPact Atlas is an enterprise AI-work evidence and settlement viewer for the
            fictional demonstration organization{' '}
            <strong className="text-slate-100">{WORKSPACE_NAME}</strong>. Current mode:{' '}
            <span className="font-mono text-emerald-300">{DATA_MODE}</span> (
            <span className="font-mono text-slate-200">{DATA_SOURCE_LABEL}</span>).
          </p>

          <div className="border border-slate-800 rounded-md bg-[#080C14] divide-y divide-slate-800">
            <div className="p-3">
              <div className="font-semibold text-slate-100">Imported Records & Sample Scenario</div>
              <p className="text-slate-400 mt-0.5">
                Chicago (pp_demo0001) and London (pp_demo0002) reflect verbatim NEAR testnet records
                from TESTNET.md (contract proofpact.addychief.testnet). Singapore (fixture-sim)
                reflects local fixture runner output with no chain transactions. São Paulo
                (WO-SAMPLE-GRU-04) remains an unimported cross-region configuration sample.
              </p>
            </div>
            <div className="p-3">
              <div className="font-semibold text-slate-100">Geography & Organization Context</div>
              <p className="text-slate-400 mt-0.5">
                City markers represent illustrative business contexts only. They do not establish
                execution location, server location, legal entity, data-processing region, or
                availability in any country.
              </p>
            </div>
            <div className="p-3">
              <div className="font-semibold text-slate-100">Demonstration Policy</div>
              <p className="text-slate-400 mt-0.5">
                Fixture policy decisions are labeled "Demonstration policy — not production
                authorization." No worldwide compliance or statutory rule inference is claimed.
              </p>
            </div>
            <div className="p-3">
              <div className="font-semibold text-slate-100">Evidence & Settlement Separation</div>
              <p className="text-slate-400 mt-0.5">
                Operator-submitted verification and digests (including the Chicago result digest)
                are explicitly distinguished from independent local runner certificates. Local runner
                settlement binding remains Not integrated, and Finance adapter: not implemented.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-800 bg-[#080C14] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
