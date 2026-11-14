import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCode2,
  ShieldCheck,
  GitBranch,
  Database,
  Lock,
  Terminal,
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
  Download,
  Check,
} from 'lucide-react';
import { WorkOrder, WorkOrderTab } from '../types';
import {
  WORKSPACE_NAME,
  DATA_MODE,
  DATA_SOURCE_LABEL,
  analyzeEvidenceLinkage,
  getFixtureAgentLogStream,
} from '../data/operationsData';
import { LiveFxState } from '../hooks/useLiveFxRates';

interface WorkOrderPanelProps {
  workOrder: WorkOrder;
  activeTab: WorkOrderTab;
  onSelectTab: (tab: WorkOrderTab) => void;
  fx: LiveFxState;
}

const TABS: { id: WorkOrderTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'policy', label: 'Policy' },
  { id: 'workflow', label: 'Agent workflow' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'settlement', label: 'Settlement' },
];

export const WorkOrderPanel: React.FC<WorkOrderPanelProps> = ({
  workOrder,
  activeTab,
  onSelectTab,
}) => {
  const [showWorkflowLogs, setShowWorkflowLogs] = useState<boolean>(false);
  const [logLaneFilter, setLogLaneFilter] = useState<'all' | 'Builder' | 'Challenger'>('all');
  const [visibleLogCount, setVisibleLogCount] = useState<number>(6);
  const [isLogStreaming, setIsLogStreaming] = useState<boolean>(false);
  const [justDownloaded, setJustDownloaded] = useState<boolean>(false);

  const linkage = analyzeEvidenceLinkage(workOrder);
  const builderMessages = workOrder.workflow.messages.filter((m) => m.lane === 'Builder');
  const challengerMessages = workOrder.workflow.messages.filter((m) => m.lane === 'Challenger');

  const fullLogStream = useMemo(() => getFixtureAgentLogStream(workOrder), [workOrder]);

  const filteredLogStream = useMemo(() => {
    const base =
      logLaneFilter === 'all'
        ? fullLogStream
        : fullLogStream.filter((entry) => entry.lane === logLaneFilter);
    return base.slice(0, visibleLogCount);
  }, [fullLogStream, logLaneFilter, visibleLogCount]);

  // Reset mock stream visibility when switching work orders
  useEffect(() => {
    setVisibleLogCount(fullLogStream.length);
    setIsLogStreaming(false);
  }, [workOrder.id, fullLogStream.length]);

  // Mock stream playback interval when user starts replay
  useEffect(() => {
    if (!isLogStreaming) return;
    const total =
      logLaneFilter === 'all'
        ? fullLogStream.length
        : fullLogStream.filter((e) => e.lane === logLaneFilter).length;

    const timer = window.setInterval(() => {
      setVisibleLogCount((prev) => {
        if (prev >= total) {
          setIsLogStreaming(false);
          return prev;
        }
        return prev + 1;
      });
    }, 900);

    return () => clearInterval(timer);
  }, [isLogStreaming, logLaneFilter, fullLogStream]);

  const runnerCheckDisplay =
    workOrder.evidence.localRunner.passedChecks !== null &&
    workOrder.evidence.localRunner.totalChecks !== null
      ? `${workOrder.evidence.localRunner.passedChecks}/${workOrder.evidence.localRunner.totalChecks}${
          workOrder.evidence.localRunner.arcsVerified !== null
            ? ` · ${workOrder.evidence.localRunner.arcsVerified} arcs`
            : ''
        }`
      : 'Not supplied';

  const hasLocalRunnerFields =
    workOrder.evidence.localRunner.artifactId !== null ||
    workOrder.evidence.localRunner.suiteName !== null ||
    workOrder.evidence.localRunner.rev1Note !== null ||
    workOrder.evidence.localRunner.rev2Note !== null ||
    (workOrder.evidence.localRunner.passedChecks !== null &&
      workOrder.evidence.localRunner.totalChecks !== null) ||
    workOrder.evidence.localRunner.runnerId !== null ||
    workOrder.evidence.localRunner.sourceRevision !== null ||
    workOrder.evidence.localRunner.artifactDigest !== null ||
    workOrder.evidence.localRunner.reproduceCommand !== null ||
    workOrder.evidence.localRunner.executedAt !== null;

  const hasOnChainFields =
    workOrder.evidence.onChainVerification.contractTransition !== null ||
    workOrder.evidence.onChainVerification.network !== null ||
    workOrder.evidence.onChainVerification.contractAccount !== null ||
    workOrder.evidence.onChainVerification.operatorAccount !== null ||
    workOrder.evidence.onChainVerification.runId !== null ||
    workOrder.evidence.onChainVerification.operatorPassFlag !== null ||
    workOrder.evidence.onChainVerification.recordedAt !== null;

  // Reset download confirmation when switching work orders
  useEffect(() => {
    setJustDownloaded(false);
  }, [workOrder.id]);

  const handleDownloadEvidenceReport = () => {
    const reportSnapshot = {
      schema: 'proofpact-atlas-evidence-report/v1',
      generatedAt: new Date().toISOString(),
      workspace: WORKSPACE_NAME,
      dataMode: DATA_MODE,
      dataSource: DATA_SOURCE_LABEL,
      workOrder: {
        id: workOrder.id,
        title: workOrder.title,
        recordedAt: workOrder.recordedAt,
        organizationContext: {
          organization: workOrder.orgContext.organization,
          legalEntity: workOrder.orgContext.legalEntity,
          operationLocation: workOrder.orgContext.operationLocation,
          configuredProcessingRegion: workOrder.orgContext.configuredProcessingRegion,
          costCenter: workOrder.orgContext.costCenter,
          providerPolicy: workOrder.orgContext.providerPolicy,
          providerPolicyConfigurationLabel: workOrder.orgContext.providerPolicyConfigLabel,
        },
        policyFixtureEvaluation: {
          decision: workOrder.policy.decision,
          fixtureLabel: workOrder.policy.fixtureLabel,
          summary: workOrder.policy.decisionSummary,
        },
      },
      evidenceState: {
        isImported: workOrder.evidence.isImported,
        linkageAnalysis: {
          isComplete: linkage.isComplete,
          missingFieldsCount: linkage.missingFields.length,
          missingFields: linkage.missingFields,
          explanation: linkage.explanation,
        },
        localRunnerEvidence: workOrder.evidence.localRunner,
        operatorSubmittedOnChainVerification: {
          ...workOrder.evidence.onChainVerification,
          digestProvenanceNote: workOrder.evidence.onChainVerification.digests?.result
            ? 'result digest is operator-submitted (not a local runner certificate)'
            : null,
        },
        paymentOutcome: workOrder.evidence.paymentOutcome,
      },
      settlementState: {
        ...workOrder.settlement,
        financeAdapterStatus: 'Finance adapter: not implemented',
      },
    };

    const json = JSON.stringify(reportSnapshot, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const safeId = workOrder.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeId}-evidence-report.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    setJustDownloaded(true);
    window.setTimeout(() => setJustDownloaded(false), 2000);
  };

  return (
    <section
      className="w-full lg:w-[440px] xl:w-[480px] bg-[#0B0F17] border-l border-slate-800 flex flex-col min-h-0 shrink-0"
      aria-label="Selected work order inspector"
    >
      {/* Selected Work Order Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-800">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
          <span className="font-mono font-semibold text-sky-300">{workOrder.id}</span>
          <span className="font-mono">
            {workOrder.recordedAt ?? 'Recorded time: Not supplied'}
          </span>
        </div>
        <h2 className="font-display text-base font-bold text-slate-50 mt-1 leading-snug">
          {workOrder.title}
        </h2>
        <div className="text-xs text-slate-400 mt-1">
          {workOrder.orgContext.legalEntity} · {workOrder.orgContext.operationLocation}
        </div>
      </div>

      {/* 5 Required Work Order Tabs */}
      <div
        role="tablist"
        aria-label="Work order sections"
        className="flex items-center border-b border-slate-800 bg-[#080C14] px-2 overflow-x-auto no-scrollbar shrink-0"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => onSelectTab(tab.id)}
              className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400 ${
                isActive
                  ? 'border-sky-400 text-slate-50'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div>
              <div className="text-[11px] font-mono text-sky-300 mb-1">
                {workOrder.overview.categoryLabel}
              </div>
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Objective
              </h3>
              <p className="text-sm text-slate-100 leading-relaxed">{workOrder.overview.objective}</p>
            </div>

            <dl className="divide-y divide-slate-800/80 border-t border-b border-slate-800">
              <div className="py-2.5 flex items-start justify-between gap-4">
                <dt className="text-slate-400 shrink-0">Artifact revision</dt>
                <dd className="font-mono text-slate-100 text-right break-all">
                  {workOrder.overview.artifactRevision ?? 'Not supplied'}
                </dd>
              </div>
              {workOrder.overview.reproduceCommand && (
                <div className="py-2.5 flex flex-col gap-1">
                  <dt className="text-slate-400">Reproduce command</dt>
                  <dd className="font-mono text-[11px] text-sky-300 bg-[#080C14] border border-slate-800 rounded px-2.5 py-1.5 break-all">
                    {workOrder.overview.reproduceCommand}
                  </dd>
                </div>
              )}
              <div className="py-2.5 flex items-start justify-between gap-4">
                <dt className="text-slate-400 shrink-0">Owner</dt>
                <dd className="text-slate-100 font-medium text-right">{workOrder.overview.owner}</dd>
              </div>
              <div className="py-2.5 flex flex-col gap-1">
                <dt className="text-slate-400">Provenance</dt>
                <dd className="text-slate-200 leading-relaxed">{workOrder.overview.provenance}</dd>
              </div>
            </dl>

            <div>
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Configured Organization Context
              </h3>
              <dl className="grid grid-cols-1 gap-2 bg-[#080C14] border border-slate-800 rounded-md p-3">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Organization</dt>
                  <dd className="text-slate-100 text-right">{workOrder.orgContext.organization}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Legal entity</dt>
                  <dd className="text-slate-100 text-right">{workOrder.orgContext.legalEntity}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Operation location</dt>
                  <dd className="text-slate-100 text-right">{workOrder.orgContext.operationLocation}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Configured processing region</dt>
                  <dd className="font-mono text-sky-300 text-right">
                    {workOrder.orgContext.configuredProcessingRegion}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Cost center</dt>
                  <dd className="font-mono text-slate-100 text-right">{workOrder.orgContext.costCenter}</dd>
                </div>
                <div className="flex justify-between gap-2 pt-1.5 border-t border-slate-800">
                  <dt className="text-slate-400">Provider policy</dt>
                  <dd className="text-right">
                    <div className="text-slate-100">{workOrder.orgContext.providerPolicy}</div>
                    <div className="text-[11px] font-mono text-amber-300">
                      {workOrder.orgContext.providerPolicyConfigLabel}
                    </div>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {activeTab === 'policy' && (
          <div className="space-y-4">
            {/* Decision Banner */}
            <div
              className={`p-3.5 rounded-md border ${
                workOrder.policy.decision === 'ALLOW'
                  ? 'bg-emerald-950/30 border-emerald-500/40'
                  : workOrder.policy.decision === 'REQUIRE APPROVAL'
                  ? 'bg-amber-950/30 border-amber-500/40'
                  : 'bg-rose-950/30 border-rose-500/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {workOrder.policy.decision === 'ALLOW' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                  )}
                  {workOrder.policy.decision === 'REQUIRE APPROVAL' && (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                  )}
                  {workOrder.policy.decision === 'DENY' && (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
                  )}
                  <span
                    className={`font-mono text-sm font-bold tracking-wide ${
                      workOrder.policy.decision === 'ALLOW'
                        ? 'text-emerald-300'
                        : workOrder.policy.decision === 'REQUIRE APPROVAL'
                        ? 'text-amber-300'
                        : 'text-rose-300'
                    }`}
                  >
                    {workOrder.policy.decision}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-300">Fixture evaluation</span>
              </div>

              <p className="text-xs text-slate-200 mt-2 leading-relaxed">
                {workOrder.policy.decisionSummary}
              </p>

              <div className="mt-2.5 pt-2 border-t border-white/10 text-[11px] font-mono text-amber-200">
                {workOrder.policy.fixtureLabel}
              </div>
            </div>

            {/* Structured Rule Checks */}
            <div>
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Structured Rule Evaluation
              </h3>
              <div className="border border-slate-800 rounded-md divide-y divide-slate-800 bg-[#080C14]">
                {workOrder.policy.rules.map((rule) => (
                  <div key={rule.id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-100">{rule.dimension}</span>
                      <span
                        className={`font-mono text-[11px] font-semibold ${
                          rule.outcome === 'Pass'
                            ? 'text-emerald-400'
                            : rule.outcome === 'Flag'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {rule.outcome.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Rule {rule.id} · Configured: {rule.configuredThreshold}
                    </div>
                    <div className="text-[11px] font-mono text-slate-200">
                      Observed: {rule.observedValue}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Note: Policy evaluations reflect static fixture rules only. They do not claim
              worldwide compliance, infer country-specific laws from city coordinates, or grant
              production authorization.
            </p>
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="space-y-4">
            {/* Agent Workflow Header with Lanes / Logs Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                <span className="font-mono text-xs font-semibold text-amber-300">
                  {workOrder.workflow.label}
                </span>
                <span className="text-[11px] text-slate-400">· No live model calls</span>
              </div>

              <div className="flex items-center gap-1 p-0.5 rounded-md bg-[#070A10] border border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowWorkflowLogs(false)}
                  aria-pressed={!showWorkflowLogs}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                    !showWorkflowLogs
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Lanes
                </button>
                <button
                  type="button"
                  onClick={() => setShowWorkflowLogs(true)}
                  aria-pressed={showWorkflowLogs}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                    showWorkflowLogs
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Terminal className="w-3 h-3" aria-hidden="true" />
                  <span>Logs</span>
                </button>
              </div>
            </div>

            {!showWorkflowLogs ? (
              /* Two Separate Lanes: Builder and Challenger */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Lane 1: Builder */}
                <div className="border border-slate-800 rounded-md bg-[#080C14] flex flex-col">
                  <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                    <span className="font-semibold text-slate-100">Builder Lane</span>
                    <span className="font-mono text-[10px] text-sky-300">FIXTURE AGENTS</span>
                  </div>
                  <div className="p-2.5 space-y-2.5">
                    {builderMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-2.5 rounded bg-[#0D131F] border border-slate-800/90 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold text-sky-300">
                            {msg.type}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {msg.timestamp ?? msg.stepLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed">{msg.summary}</p>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          Artifact: {msg.artifactRef ?? 'Not supplied'} · {msg.statusNote}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lane 2: Challenger */}
                <div className="border border-slate-800 rounded-md bg-[#080C14] flex flex-col">
                  <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                    <span className="font-semibold text-slate-100">Challenger Lane</span>
                    <span className="font-mono text-[10px] text-amber-300">FIXTURE AGENTS</span>
                  </div>
                  <div className="p-2.5 space-y-2.5">
                    {challengerMessages.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400">
                        No challenger fixture messages recorded for this work order.
                      </div>
                    ) : (
                      challengerMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className="p-2.5 rounded bg-[#0D131F] border border-slate-800/90 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] font-semibold text-amber-300">
                              {msg.type}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              {msg.timestamp ?? msg.stepLabel}
                            </span>
                          </div>
                          <p className="text-xs text-slate-200 leading-relaxed">{msg.summary}</p>
                          <div className="text-[11px] font-mono text-slate-400 truncate">
                            Artifact: {msg.artifactRef ?? 'Not supplied'} · {msg.statusNote}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Mock Stream of Structured Fixture-Agent Messages */
              <div className="border border-slate-800 rounded-md bg-[#060910] overflow-hidden">
                {/* Stream Controls Bar */}
                <div className="px-3 py-2 border-b border-slate-800 bg-[#080C14] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {(['all', 'Builder', 'Challenger'] as const).map((lane) => (
                      <button
                        key={lane}
                        type="button"
                        onClick={() => {
                          setLogLaneFilter(lane);
                          setIsLogStreaming(false);
                          setVisibleLogCount(fullLogStream.length);
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                          logLaneFilter === lane
                            ? 'bg-slate-800 text-slate-100'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {lane === 'all' ? 'All Lanes' : lane}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (isLogStreaming) {
                          setIsLogStreaming(false);
                        } else {
                          setVisibleLogCount(1);
                          setIsLogStreaming(true);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      {isLogStreaming ? (
                        <Pause className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <Play className="w-3 h-3" aria-hidden="true" />
                      )}
                      <span>{isLogStreaming ? 'Pause' : 'Replay Stream'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLogStreaming(false);
                        setVisibleLogCount(fullLogStream.length);
                      }}
                      aria-label="Show all mock stream log entries"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      <RotateCcw className="w-3 h-3" aria-hidden="true" />
                      <span>All</span>
                    </button>
                  </div>
                </div>

                {/* Mock Stream Disclaimer */}
                <div className="px-3 py-1.5 border-b border-slate-800/80 bg-[#070A10] text-[11px] font-mono text-slate-400 flex items-center justify-between gap-2">
                  <span>MOCK STREAM · FIXTURE AGENTS</span>
                  <span className="tabular-nums">
                    {filteredLogStream.length} entries
                  </span>
                </div>

                {/* Structured Log Rows */}
                <div className="divide-y divide-slate-800/70 max-h-[380px] overflow-y-auto font-mono text-[11px]">
                  {filteredLogStream.map((entry) => (
                    <div key={`${entry.seq}-${entry.eventKind}`} className="p-3 space-y-1.5 hover:bg-[#0B0F17]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 tabular-nums">#{entry.seq}</span>
                          <span
                            className={`font-semibold ${
                              entry.lane === 'Builder' ? 'text-sky-300' : 'text-amber-300'
                            }`}
                          >
                            {entry.lane.toUpperCase()}
                          </span>
                          <span className="text-slate-300">{entry.eventKind}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              entry.level === 'REVIEW'
                                ? 'text-amber-300'
                                : entry.level === 'NOTICE'
                                ? 'text-rose-300'
                                : 'text-emerald-400'
                            }
                          >
                            {entry.level}
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-400">{entry.stepLabel}</span>
                        </div>
                      </div>

                      <p className="font-sans text-xs text-slate-200 leading-relaxed">
                        {entry.message}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
                        <span>artifact_ref={entry.artifactRef ?? 'Not supplied'}</span>
                        <span>status={entry.statusNote}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="space-y-4">
            {/* Evidence Header & JSON Report Export */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                  Separated Evidence Layers
                </div>
                <div className="text-[11px] font-mono text-slate-400 truncate">
                  Snapshot: {workOrder.id}
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadEvidenceReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                {justDownloaded ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                    <span>Downloaded JSON</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
                    <span>Download Report</span>
                  </>
                )}
              </button>
            </div>

            {/* Plain-language Linkage Summary */}
            <div
              className={`p-3 rounded-md border ${
                workOrder.evidence.isImported
                  ? 'bg-sky-950/25 border-sky-500/35'
                  : 'bg-amber-950/25 border-amber-500/35'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold text-slate-100">
                  {workOrder.evidence.isImported
                    ? 'Imported Evidence · Linkage Note'
                    : 'Sample Data · Unlinked'}
                </span>
                <span className="font-mono text-[11px] text-slate-300 tabular-nums">
                  {linkage.missingFields.length} unlinked / missing
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{linkage.explanation}</p>
            </div>

            {/* 1. Separate Local Runner Evidence */}
            <div className="border border-slate-800 rounded-md bg-[#080C14] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-100 flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                  <span>1. Local runner evidence</span>
                </h3>
                <span className="font-mono text-[11px] text-slate-400">
                  {workOrder.evidence.localRunner.exitCode !== null
                    ? `Exit ${workOrder.evidence.localRunner.exitCode}`
                    : 'No run recorded'}
                </span>
              </div>
              <p className="text-slate-300">{workOrder.evidence.localRunner.summary}</p>
              {hasLocalRunnerFields ? (
                <dl className="grid grid-cols-1 gap-1.5 pt-2 border-t border-slate-800/80 text-[11px]">
                  {workOrder.evidence.localRunner.artifactId !== null && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400 shrink-0">Artifact ID</dt>
                      <dd className="font-mono text-slate-200 text-right break-all">
                        {workOrder.evidence.localRunner.artifactId}
                      </dd>
                    </div>
                  )}
                  {workOrder.evidence.localRunner.suiteName !== null && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400 shrink-0">Suite</dt>
                      <dd className="font-mono text-slate-200 text-right">
                        {workOrder.evidence.localRunner.suiteName}
                      </dd>
                    </div>
                  )}
                  {workOrder.evidence.localRunner.rev1Note !== null && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400 shrink-0">Rev 1</dt>
                      <dd className="font-mono text-rose-300 text-right">
                        {workOrder.evidence.localRunner.rev1Note}
                      </dd>
                    </div>
                  )}
                  {workOrder.evidence.localRunner.rev2Note !== null && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400 shrink-0">Rev 2</dt>
                      <dd className="font-mono text-emerald-300 text-right">
                        {workOrder.evidence.localRunner.rev2Note}
                      </dd>
                    </div>
                  )}
                  {workOrder.evidence.localRunner.passedChecks !== null &&
                    workOrder.evidence.localRunner.totalChecks !== null && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-400 shrink-0">Check counts</dt>
                        <dd className="font-mono text-slate-200 text-right">{runnerCheckDisplay}</dd>
                      </div>
                    )}
                  {workOrder.evidence.localRunner.runnerId !== null && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400 shrink-0">Runner ID</dt>
                      <dd className="font-mono text-slate-200 text-right">
                        {workOrder.evidence.localRunner.runnerId}
                      </dd>
                    </div>
                  )}
                  {workOrder.evidence.localRunner.sourceRevision !== null && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400 shrink-0">Source revision</dt>
                      <dd className="font-mono text-slate-200 text-right break-all">
                        {workOrder.evidence.localRunner.sourceRevision}
                      </dd>
                    </div>
                  )}
                  {workOrder.evidence.localRunner.artifactDigest !== null && (
                    <div className="flex flex-col gap-0.5 pt-1">
                      <dt className="text-slate-400">Run artifact digest</dt>
                      <dd className="font-mono text-slate-200 break-all">
                        {workOrder.evidence.localRunner.artifactDigest}
                      </dd>
                    </div>
                  )}
                  {workOrder.evidence.localRunner.reproduceCommand && (
                    <div className="flex flex-col gap-1 pt-1">
                      <dt className="text-slate-400">Reproduce</dt>
                      <dd className="font-mono text-sky-300 bg-[#060910] border border-slate-800 rounded px-2 py-1 break-all">
                        {workOrder.evidence.localRunner.reproduceCommand}
                      </dd>
                    </div>
                  )}
                  {workOrder.evidence.localRunner.executedAt !== null && (
                    <div className="flex justify-between gap-2 pt-1">
                      <dt className="text-slate-400 shrink-0">Executed at</dt>
                      <dd className="font-mono text-slate-200 text-right">
                        {workOrder.evidence.localRunner.executedAt}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2 pt-1.5 border-t border-slate-800/60">
                    <dt className="text-slate-400 shrink-0">Settlement binding</dt>
                    <dd className="font-mono text-amber-300 text-right">
                      {workOrder.evidence.localRunner.settlementBinding}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="font-mono text-slate-500 text-[11px] pt-2 border-t border-slate-800/80">
                  No runner fields recorded — see linkage note above. Settlement binding:{' '}
                  {workOrder.evidence.localRunner.settlementBinding}
                </p>
              )}
            </div>

            {/* 2. Operator-Submitted On-Chain Verification */}
            <div className="border border-slate-800 rounded-md bg-[#080C14] p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  <span>2. Operator-submitted on-chain verification</span>
                </h3>
                <span className="font-mono text-[11px] text-amber-300">
                  {workOrder.evidence.onChainVerification.contractTransition ??
                    'No verification transition'}
                </span>
              </div>

              <dl className="grid grid-cols-1 gap-1.5 pt-2 border-t border-slate-800/80 text-[11px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Verification source</dt>
                  <dd className="font-mono text-slate-200 text-right">
                    {workOrder.evidence.onChainVerification.verificationSource}
                  </dd>
                </div>
                {workOrder.evidence.onChainVerification.contractTransition !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Contract transition</dt>
                    <dd className="font-mono text-slate-200 text-right">
                      {workOrder.evidence.onChainVerification.contractTransition}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Runner checks</dt>
                  <dd className="font-mono text-amber-200 text-right">
                    {workOrder.evidence.onChainVerification.runnerChecksStatus}
                  </dd>
                </div>
                {!hasOnChainFields && (
                  <div className="font-mono text-slate-500 text-[11px] pt-1">
                    No chain identity fields recorded — see linkage note above.
                  </div>
                )}
                {workOrder.evidence.onChainVerification.network !== null && (
                  <div className="flex justify-between gap-2 pt-1.5 border-t border-slate-800/60">
                    <dt className="text-slate-400">Network</dt>
                    <dd className="font-mono text-slate-200 text-right">
                      {workOrder.evidence.onChainVerification.network}
                    </dd>
                  </div>
                )}
                {workOrder.evidence.onChainVerification.contractAccount !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Contract account</dt>
                    <dd className="font-mono text-slate-200 text-right break-all">
                      {workOrder.evidence.onChainVerification.contractAccount}
                    </dd>
                  </div>
                )}
                {workOrder.evidence.onChainVerification.operatorAccount !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Operator account</dt>
                    <dd className="font-mono text-slate-200 text-right break-all">
                      {workOrder.evidence.onChainVerification.operatorAccount}
                    </dd>
                  </div>
                )}
                {workOrder.evidence.onChainVerification.runId !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Run ID</dt>
                    <dd className="font-mono text-slate-200 text-right">
                      {workOrder.evidence.onChainVerification.runId}
                    </dd>
                  </div>
                )}
                {workOrder.evidence.onChainVerification.operatorPassFlag !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Operator pass flag</dt>
                    <dd className="font-mono text-slate-200 text-right">
                      {`${String(workOrder.evidence.onChainVerification.operatorPassFlag)} (operator-submitted flag)`}
                    </dd>
                  </div>
                )}
                {workOrder.evidence.onChainVerification.recordedAt !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Recorded at</dt>
                    <dd className="font-mono text-slate-200 text-right">
                      {workOrder.evidence.onChainVerification.recordedAt}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Operator-Submitted Digests */}
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px]">
                <div className="font-semibold text-slate-300">Operator-submitted digests</div>
                {workOrder.evidence.onChainVerification.digests ? (
                  <dl className="space-y-1.5">
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-slate-400">Artifact digest</dt>
                      <dd className="font-mono text-slate-200 break-all">
                        {workOrder.evidence.onChainVerification.digests.artifact ?? 'Not supplied'}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-slate-400">Specification digest</dt>
                      <dd className="font-mono text-slate-200 break-all">
                        {workOrder.evidence.onChainVerification.digests.specification ??
                          'Not supplied'}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5 bg-[#060910] border border-amber-500/30 rounded p-2">
                      <dt className="text-amber-300 font-medium">
                        Operator-submitted result digest (not a runner certificate)
                      </dt>
                      <dd className="font-mono text-slate-100 break-all">
                        {workOrder.evidence.onChainVerification.digests.result ?? 'Not supplied'}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <div className="font-mono text-slate-400">
                    No digests recorded for this settlement.
                  </div>
                )}
              </div>

              {/* On-Chain Transactions (Strict: zero fabricated links for Singapore) */}
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-300">On-chain transactions</span>
                  <span className="font-mono text-slate-400 tabular-nums">
                    {workOrder.evidence.onChainVerification.txs.length} txs
                  </span>
                </div>

                {workOrder.evidence.onChainVerification.txs.length > 0 ? (
                  <ul className="space-y-1.5">
                    {workOrder.evidence.onChainVerification.txs.map((tx) => (
                      <li
                        key={tx.hash}
                        className="flex items-center justify-between gap-2 bg-[#060910] border border-slate-800/90 rounded px-2.5 py-1.5"
                      >
                        <span className="font-mono text-slate-300 shrink-0">{tx.label}</span>
                        <a
                          href={tx.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-sky-300 hover:text-sky-200 underline decoration-sky-500/40 truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded"
                          title={`View ${tx.hash} on NEARBlocks Testnet Explorer`}
                        >
                          <span className="truncate">{tx.hash}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="font-mono text-slate-400 bg-[#060910] border border-slate-800/90 rounded px-2.5 py-2">
                    {workOrder.evidence.onChainVerification.noChainTransactionsReason ??
                      'no chain transactions'}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Payment Outcome */}
            <div className="border border-slate-800 rounded-md bg-[#080C14] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-100 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
                  <span>3. Payment outcome</span>
                </h3>
                <span className="font-mono text-[11px] text-slate-200">
                  {workOrder.evidence.paymentOutcome.isImported
                    ? workOrder.evidence.paymentOutcome.status
                    : `Sample: ${workOrder.evidence.paymentOutcome.status}`}
                </span>
              </div>
              <div className="text-[11px] text-sky-300">
                {workOrder.evidence.paymentOutcome.scenarioClassification}
              </div>
              <dl className="grid grid-cols-1 gap-1.5 pt-2 border-t border-slate-800/80 text-[11px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Escrow in</dt>
                  <dd className="font-mono text-slate-200">
                    {workOrder.evidence.paymentOutcome.escrowIn ?? 'Not supplied'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Paid out</dt>
                  <dd className="font-mono text-slate-200">
                    {workOrder.evidence.paymentOutcome.paidOut ?? 'Not supplied'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400 shrink-0">Reference ID</dt>
                  <dd className="font-mono text-slate-200 text-right truncate max-w-[230px]">
                    {workOrder.settlement.settlementExplorerUrl &&
                    workOrder.evidence.paymentOutcome.referenceId ? (
                      <a
                        href={workOrder.settlement.settlementExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 underline decoration-sky-500/40"
                      >
                        <span className="truncate">
                          {workOrder.evidence.paymentOutcome.referenceId}
                        </span>
                        <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                      </a>
                    ) : (
                      workOrder.evidence.paymentOutcome.referenceId ??
                      (workOrder.evidence.onChainVerification.txs.length === 0
                        ? 'no chain transactions'
                        : 'Not supplied')
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Recorded at</dt>
                  <dd className="font-mono text-slate-200">
                    {workOrder.evidence.paymentOutcome.recordedAt ?? 'Not supplied'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {activeTab === 'settlement' && (
          <div className="space-y-4">
            {/* Read-only Recorded / Illustrative Outcome */}
            <div className="border border-slate-800 rounded-md bg-[#080C14] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {workOrder.settlement.isImported
                    ? 'Recorded Outcome (Read-Only)'
                    : 'Illustrative Sample Outcome (Read-Only)'}
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-400">
                  <Lock className="w-3 h-3" aria-hidden="true" />
                  {workOrder.settlement.isImported ? 'Imported record' : 'Sample data'}
                </span>
              </div>

              <div className="text-[11px] text-sky-300">
                {workOrder.settlement.scenarioClassification}
              </div>

              <div className="flex items-baseline justify-between gap-4 pt-1">
                <span
                  className={`font-display text-lg font-bold ${
                    workOrder.settlement.status === 'Paid'
                      ? 'text-emerald-400'
                      : workOrder.settlement.status === 'Refunded'
                      ? 'text-rose-400'
                      : workOrder.settlement.status === 'Verified locally'
                      ? 'text-sky-300'
                      : 'text-amber-300'
                  }`}
                >
                  {workOrder.settlement.status}
                </span>
                <span className="font-mono text-lg font-bold text-slate-100 tabular-nums">
                  {workOrder.settlement.paidOut ??
                    `${workOrder.settlement.amount} ${workOrder.settlement.asset}`}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{workOrder.settlement.note}</p>

              <dl className="grid grid-cols-1 gap-2 pt-3 border-t border-slate-800 text-[11px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Escrow in</dt>
                  <dd className="font-mono text-slate-200">
                    {workOrder.settlement.escrowIn ?? 'Not supplied'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Paid out</dt>
                  <dd className="font-mono text-slate-200">
                    {workOrder.settlement.paidOut ?? 'Not supplied'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400 shrink-0">Settlement reference</dt>
                  <dd className="font-mono text-slate-200 text-right truncate max-w-[230px]">
                    {workOrder.settlement.settlementExplorerUrl &&
                    workOrder.settlement.settlementReference ? (
                      <a
                        href={workOrder.settlement.settlementExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 underline decoration-sky-500/40"
                      >
                        <span className="truncate">{workOrder.settlement.settlementReference}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                      </a>
                    ) : (
                      workOrder.settlement.settlementReference ??
                      (workOrder.evidence.onChainVerification.txs.length === 0
                        ? workOrder.evidence.onChainVerification.noChainTransactionsReason ??
                          'no chain transactions'
                        : 'Not supplied')
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Recorded timestamp</dt>
                  <dd className="font-mono text-slate-200">
                    {workOrder.settlement.recordedAt ?? 'Not supplied'}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Implementation Status Section (Explicit boundary: no fake finance integrations) */}
            <div className="border border-slate-800 rounded-md bg-[#080C14] p-4 space-y-2.5">
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Implementation status
              </h3>
              <dl className="divide-y divide-slate-800/80 text-xs">
                <div className="py-2 flex items-center justify-between gap-3">
                  <dt className="text-slate-300">Finance adapter</dt>
                  <dd className="font-mono text-amber-300">Not implemented</dd>
                </div>
                <div className="py-2 flex items-center justify-between gap-3">
                  <dt className="text-slate-300">Policy evaluation</dt>
                  <dd className="font-mono text-slate-400">Fixture-driven demonstration</dd>
                </div>
                <div className="py-2 flex items-center justify-between gap-3">
                  <dt className="text-slate-300">Agent workflow</dt>
                  <dd className="font-mono text-slate-400">Static fixture replay</dd>
                </div>
              </dl>
              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                No ERP, general ledger, wallet, or corporate treasury connectors are active in this
                demonstration workspace.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
