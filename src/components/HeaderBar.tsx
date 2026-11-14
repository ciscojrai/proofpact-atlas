import React from 'react';
import { ShieldAlert, Info, ArrowLeftRight } from 'lucide-react';
import { GlobalSummaryMetrics } from '../types';
import { WORKSPACE_NAME, WORKSPACE_BADGE } from '../data/operationsData';

interface HeaderBarProps {
  metrics: GlobalSummaryMetrics;
  onOpenScopeModal: () => void;
  onOpenFxConverter: () => void;
  showSamples: boolean;
  onToggleSamples: () => void;
  onOpenSuites: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  metrics,
  onOpenScopeModal,
  onOpenFxConverter,
  showSamples,
  onToggleSamples,
  onOpenSuites,
}) => {
  return (
    <header className="w-full bg-[#0A0E17] border-b border-slate-800 px-4 py-2.5 lg:px-6 flex flex-wrap lg:flex-nowrap items-center justify-between gap-4 shrink-0 z-30">
      {/* Zone 1: Brand, Workspace, Data Mode, and Demonstration Badge */}
      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap">
            ProofPact Atlas
          </span>
          <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <span className="text-xs sm:text-sm text-slate-300 font-medium whitespace-nowrap truncate">
            Workspace: {WORKSPACE_NAME}
          </span>
        </div>

        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono text-[11px] font-semibold tracking-wide whitespace-nowrap shrink-0">
          <ShieldAlert className="w-3 h-3 shrink-0" aria-hidden="true" />
          {WORKSPACE_BADGE}
        </span>

        <span
          className={`inline-flex items-center px-2 py-0.5 rounded border font-mono text-[11px] font-semibold tracking-wide whitespace-nowrap shrink-0 ${
            metrics.dataMode === 'SAMPLE DATA'
              ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          MODE: {metrics.dataMode}
        </span>

        <span className="hidden xl:inline font-mono text-[11px] text-slate-400 whitespace-nowrap shrink-0">
          {metrics.dataSourceLabel}
        </span>
      </div>

      {/* Zone 2: Global Summary calculated strictly from loaded data */}
      <div
        className="flex items-center gap-4 sm:gap-6 text-xs overflow-x-auto no-scrollbar"
        aria-label="Global summary calculated from loaded work orders"
      >
        <div className="flex items-baseline gap-1.5 whitespace-nowrap shrink-0">
          <span className="text-slate-400">Recorded paid jobs</span>
          <span className="font-mono font-semibold text-emerald-400 tabular-nums">
            {metrics.recordedPaidJobs}
          </span>
        </div>
        <span className="text-slate-700" aria-hidden="true">
          ·
        </span>
        <div className="flex items-baseline gap-1.5 whitespace-nowrap shrink-0">
          <span className="text-slate-400">Recorded refunds</span>
          <span className="font-mono font-semibold text-rose-400 tabular-nums">
            {metrics.recordedRefunds}
          </span>
        </div>
        <span className="text-slate-700" aria-hidden="true">
          ·
        </span>
        <div className="flex items-baseline gap-1.5 whitespace-nowrap shrink-0">
          <span className="text-slate-400">Fixture workflows</span>
          <span className="font-mono font-semibold text-slate-100 tabular-nums">
            {metrics.fixtureWorkflows}
          </span>
        </div>
        <span className="text-slate-700" aria-hidden="true">
          ·
        </span>
        <div className="flex items-baseline gap-1.5 whitespace-nowrap shrink-0">
          <span className="text-slate-400">Missing evidence fields</span>
          <span className="font-mono font-semibold text-amber-400 tabular-nums">
            {metrics.missingEvidenceFields}
          </span>
        </div>
      </div>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-within:ring-2 focus-within:ring-sky-400">
          <input
            type="checkbox"
            checked={showSamples}
            onChange={onToggleSamples}
            className="accent-sky-400 w-3.5 h-3.5"
          />
          <span>Include sample scenarios</span>
        </label>
        <button
          type="button"
          onClick={onOpenFxConverter}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
          <span>FX Converter</span>
        </button>

        <button
          type="button"
          onClick={onOpenSuites}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <span>Test Evidence</span>
        </button>

        <button
          type="button"
          onClick={onOpenScopeModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <Info className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
          <span>Governance Scope</span>
        </button>
      </div>
    </header>
  );
};
