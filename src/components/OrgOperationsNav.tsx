import React, { useMemo, useState } from 'react';
import { Search, Building2, MapPin } from 'lucide-react';
import { WorkOrder } from '../types';
import { analyzeEvidenceLinkage } from '../data/operationsData';

interface OrgOperationsNavProps {
  workOrders: WorkOrder[];
  selectedWorkOrder: WorkOrder;
  onSelectWorkOrder: (workOrderId: string) => void;
}

type StatusFilter = 'all' | 'paid' | 'refunded' | 'attention';

export const OrgOperationsNav: React.FC<OrgOperationsNavProps> = ({
  workOrders,
  selectedWorkOrder,
  onSelectWorkOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return workOrders.filter((wo) => {
      const linkage = analyzeEvidenceLinkage(wo);
      const matchesFilter =
        statusFilter === 'all' ||
        (statusFilter === 'paid' && wo.settlement.status === 'Paid') ||
        (statusFilter === 'refunded' && wo.settlement.status === 'Refunded') ||
        (statusFilter === 'attention' && (!linkage.isComplete || wo.policy.decision !== 'ALLOW'));

      if (!matchesFilter) return false;
      if (!q) return true;

      return (
        wo.id.toLowerCase().includes(q) ||
        wo.title.toLowerCase().includes(q) ||
        wo.orgContext.legalEntity.toLowerCase().includes(q) ||
        wo.orgContext.operationLocation.toLowerCase().includes(q) ||
        wo.orgContext.configuredProcessingRegion.toLowerCase().includes(q) ||
        wo.orgContext.costCenter.toLowerCase().includes(q)
      );
    });
  }, [workOrders, searchQuery, statusFilter]);

  const ctx = selectedWorkOrder.orgContext;

  return (
    <aside className="w-full lg:w-[320px] xl:w-[340px] bg-[#0B0F17] border-r border-slate-800 flex flex-col min-h-0 shrink-0">
      {/* Organization Context Section: 6 explicitly separated fields */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-200 tracking-wide flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
            <span>Organization Context</span>
          </h2>
          <span className="text-[11px] font-mono text-slate-400">{selectedWorkOrder.id}</span>
        </div>

        <dl className="space-y-2 text-xs">
          <div className="flex flex-col gap-0.5">
            <dt className="text-[11px] text-slate-400">Organization</dt>
            <dd className="text-slate-100 font-medium">{ctx.organization}</dd>
          </div>

          <div className="flex flex-col gap-0.5 pt-1.5 border-t border-slate-800/70">
            <dt className="text-[11px] text-slate-400">Legal entity</dt>
            <dd className="text-slate-100 font-medium">{ctx.legalEntity}</dd>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1.5 border-t border-slate-800/70">
            <div className="flex flex-col gap-0.5 min-w-0">
              <dt className="text-[11px] text-slate-400">Operation location</dt>
              <dd className="text-slate-100 font-medium truncate" title={ctx.operationLocation}>
                {ctx.operationLocation}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <dt className="text-[11px] text-slate-400">Cost center</dt>
              <dd className="text-slate-100 font-mono text-[11px] truncate" title={ctx.costCenter}>
                {ctx.costCenter}
              </dd>
            </div>
          </div>

          <div className="flex flex-col gap-0.5 pt-1.5 border-t border-slate-800/70">
            <dt className="text-[11px] text-slate-400">Configured processing region</dt>
            <dd className="text-sky-300 font-mono text-[11px]">{ctx.configuredProcessingRegion}</dd>
          </div>

          <div className="flex flex-col gap-0.5 pt-1.5 border-t border-slate-800/70">
            <dt className="text-[11px] text-slate-400">Provider policy</dt>
            <dd className="text-slate-100 font-medium">{ctx.providerPolicy}</dd>
            <dd className="text-[11px] text-amber-300/90 font-mono">{ctx.providerPolicyConfigLabel}</dd>
          </div>
        </dl>

        <p className="mt-2.5 pt-2 border-t border-slate-800/70 text-[11px] text-slate-400 leading-relaxed">
          City locations are illustrative business contexts only and do not establish execution
          servers, legal entity rules, data-processing residency, or country availability.
        </p>
      </div>

      {/* Operation & Work Order Navigation */}
      <div className="p-3 border-b border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span>Operation Navigation</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400 tabular-nums">
            {filteredOrders.length} / {workOrders.length}
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter ID, entity, city, region..."
            aria-label="Filter operations and work orders"
            className="w-full bg-[#070A10] border border-slate-800 focus:border-sky-500/60 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
        </div>

        {/* Segmented filter buttons */}
        <div className="grid grid-cols-4 gap-1 p-0.5 bg-[#070A10] border border-slate-800 rounded-md">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'paid', label: 'Paid' },
              { id: 'refunded', label: 'Refund' },
              { id: 'attention', label: 'Review' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`py-1 px-1.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                statusFilter === tab.id
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Work Order List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/70">
        {filteredOrders.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            <p>No operations match the active filter.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="mt-2 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          filteredOrders.map((wo) => {
            const isSelected = wo.id === selectedWorkOrder.id;
            const linkage = analyzeEvidenceLinkage(wo);
            const outcomeLabel = wo.evidence.isImported
              ? `${wo.settlement.status} · Imported`
              : `Sample: ${wo.settlement.status}`;
            return (
              <button
                key={wo.id}
                type="button"
                onClick={() => onSelectWorkOrder(wo.id)}
                className={`w-full text-left px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400 ${
                  isSelected ? 'bg-[#131B29]' : 'hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm font-semibold truncate ${
                      isSelected ? 'text-sky-200' : 'text-slate-100'
                    }`}
                  >
                    {wo.title}
                  </span>
                  <span
                    className={`text-[11px] font-mono font-medium shrink-0 ${
                      wo.policy.decision === 'ALLOW'
                        ? 'text-emerald-400'
                        : wo.policy.decision === 'REQUIRE APPROVAL'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {wo.policy.decision}
                  </span>
                </div>

                <div className="font-mono text-[11px] text-slate-500 mt-0.5 truncate">{wo.id}</div>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1 truncate">
                  <span className="truncate">{wo.orgContext.operationLocation}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-mono shrink-0 ${
                      wo.evidence.isImported ? 'text-emerald-300' : 'text-slate-400'
                    }`}
                  >
                    {outcomeLabel}
                  </span>
                  {!linkage.isComplete && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-300 shrink-0">
                        {linkage.missingFields.length} missing
                      </span>
                    </>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
