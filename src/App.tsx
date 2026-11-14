import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  WORK_ORDERS,
  EVIDENCE_TIMELINE_EVENTS,
  computeGlobalSummary,
} from './data/operationsData';
import { WorkOrderTab, EvidenceTimelineEvent } from './types';
import { useLiveFxRates } from './hooks/useLiveFxRates';
import { HeaderBar } from './components/HeaderBar';
import { OrgOperationsNav } from './components/OrgOperationsNav';
import { Earth3D } from './components/Earth3D';
import { WorkOrderPanel } from './components/WorkOrderPanel';
import { EvidenceTimeline } from './components/EvidenceTimeline';
import { GovernanceScopeModal } from './components/GovernanceScopeModal';
import { CurrencyConverter } from './components/CurrencyConverter';
import { SuitesModal } from './components/SuitesModal';

type MobilePane = 'operations' | 'globe' | 'workorder';

export default function App() {
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string>(WORK_ORDERS[0].id);
  const [activeTab, setActiveTab] = useState<WorkOrderTab>('overview');
  const [activeEventId, setActiveEventId] = useState<string>(EVIDENCE_TIMELINE_EVENTS[0].id);
  const [isReplayPlaying, setIsReplayPlaying] = useState<boolean>(false);
  const [isScopeModalOpen, setIsScopeModalOpen] = useState<boolean>(false);
  const [isFxModalOpen, setIsFxModalOpen] = useState<boolean>(false);
  const [isSuitesModalOpen, setIsSuitesModalOpen] = useState<boolean>(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>('globe');
  const [showSamples, setShowSamples] = useState<boolean>(false);

  const fx = useLiveFxRates();

  // Sample scenarios (São Paulo) stay out of the default evidence view.
  const visibleWorkOrders = useMemo(
    () => (showSamples ? WORK_ORDERS : WORK_ORDERS.filter((w) => !w.sampleScenario)),
    [showSamples]
  );
  const visibleEventIds = useMemo(
    () => new Set(visibleWorkOrders.map((w) => w.id)),
    [visibleWorkOrders]
  );
  const visibleEvents = useMemo(
    () => EVIDENCE_TIMELINE_EVENTS.filter((e) => visibleEventIds.has(e.workOrderId)),
    [visibleEventIds]
  );
  const globalSummary = useMemo(
    () => computeGlobalSummary(visibleWorkOrders),
    [visibleWorkOrders]
  );

  const selectedWorkOrder = useMemo(
    () =>
      visibleWorkOrders.find((w) => w.id === selectedWorkOrderId) ??
      visibleWorkOrders[0],
    [visibleWorkOrders, selectedWorkOrderId]
  );

  const activeEvent = useMemo(
    () =>
      visibleEvents.find((e) => e.id === activeEventId) ?? visibleEvents[0],
    [visibleEvents, activeEventId]
  );

  const handleSelectWorkOrder = useCallback((workOrderId: string) => {
    setSelectedWorkOrderId(workOrderId);
    const matchingEvent = visibleEvents.find((e) => e.workOrderId === workOrderId);
    if (matchingEvent) {
      setActiveEventId(matchingEvent.id);
    }
  }, [visibleEvents]);

  const handleSelectEvent = useCallback((event: EvidenceTimelineEvent) => {
    setActiveEventId(event.id);
    setSelectedWorkOrderId(event.workOrderId);
    setActiveTab(event.targetTab);
  }, []);

  const handleStepEvent = useCallback(
    (direction: -1 | 1) => {
      const idx = visibleEvents.findIndex((e) => e.id === activeEventId);
      const nextIdx =
        (idx + direction + visibleEvents.length) % visibleEvents.length;
      const nextEvent = visibleEvents[nextIdx];
      handleSelectEvent(nextEvent);
    },
    [visibleEvents, activeEventId, handleSelectEvent]
  );

  useEffect(() => {
    if (!isReplayPlaying) return;
    const timer = window.setInterval(() => {
      handleStepEvent(1);
    }, 3200);
    return () => clearInterval(timer);
  }, [isReplayPlaying, handleStepEvent]);

  return (
    <div className="flex flex-col w-screen h-screen bg-[#070A10] text-slate-100 overflow-hidden">
      {/* Top Header: Brand, Workspace, Demonstration & Data Mode Badges, Dynamic Global Summary */}
      <HeaderBar
        metrics={globalSummary}
        onOpenScopeModal={() => setIsScopeModalOpen(true)}
        onOpenFxConverter={() => setIsFxModalOpen(true)}
        showSamples={showSamples}
        onToggleSamples={() => setShowSamples((prev) => !prev)}
        onOpenSuites={() => setIsSuitesModalOpen(true)}
      />

      {/* Mobile View Switcher (visible below lg) */}
      <div className="lg:hidden flex items-center gap-1 p-1.5 bg-[#0A0E17] border-b border-slate-800 shrink-0">
        {(
          [
            { id: 'operations', label: 'Operations' },
            { id: 'globe', label: 'Globe' },
            { id: 'workorder', label: 'Work Order' },
          ] as const
        ).map((pane) => (
          <button
            key={pane.id}
            type="button"
            onClick={() => setMobilePane(pane.id)}
            className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              mobilePane === pane.id
                ? 'bg-slate-800 text-slate-50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {pane.label}
          </button>
        ))}
      </div>

      {/* Main 3-Column Enterprise Console: Left Org/Op Nav | Center Globe | Right Selected Work Order */}
      <main className="flex-1 flex min-h-0 w-full overflow-hidden">
        {/* Left: Organization Context & Operation Navigation */}
        <div
          className={`${
            mobilePane === 'operations' ? 'flex w-full' : 'hidden'
          } lg:flex min-h-0 shrink-0`}
        >
          <OrgOperationsNav
            workOrders={visibleWorkOrders}
            selectedWorkOrder={selectedWorkOrder}
            onSelectWorkOrder={(id) => {
              handleSelectWorkOrder(id);
              if (mobilePane === 'operations') setMobilePane('workorder');
            }}
          />
        </div>

        {/* Center: Unobstructed 3D Globe */}
        <div
          className={`${
            mobilePane === 'globe' ? 'flex' : 'hidden'
          } lg:flex flex-1 min-w-0 min-h-0 relative`}
        >
          <Earth3D
            workOrders={visibleWorkOrders}
            selectedWorkOrder={selectedWorkOrder}
            onSelectWorkOrder={handleSelectWorkOrder}
            activeTimestampIso={activeEvent.timestamp ?? '2026-11-13T18:00:00Z'}
          />
        </div>

        {/* Right: Selected Work Order Inspector (5 tabs) */}
        <div
          className={`${
            mobilePane === 'workorder' ? 'flex w-full' : 'hidden'
          } lg:flex min-h-0 shrink-0`}
        >
          <WorkOrderPanel
            workOrder={selectedWorkOrder}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            fx={fx}
          />
        </div>
      </main>

      {/* Bottom: Evidence Activity Timeline */}
      <EvidenceTimeline
        events={visibleEvents}
        selectedWorkOrderId={selectedWorkOrder.id}
        activeEventId={activeEventId}
        isPlaying={isReplayPlaying}
        onTogglePlay={() => setIsReplayPlaying((prev) => !prev)}
        onSelectEvent={handleSelectEvent}
        onStepEvent={handleStepEvent}
      />

      {/* Real-Time FX Reference Converter Modal */}
      <CurrencyConverter
        fx={fx}
        variant="modal"
        isOpen={isFxModalOpen}
        onClose={() => setIsFxModalOpen(false)}
        suggestedAmount={
          Number(selectedWorkOrder.settlement.amount) > 0
            ? selectedWorkOrder.settlement.amount
            : '1'
        }
        suggestedCurrency={selectedWorkOrder.settlement.asset}
        suggestedLabel={
          Number(selectedWorkOrder.settlement.amount) > 0
            ? `${selectedWorkOrder.settlement.amount} ${selectedWorkOrder.settlement.asset}`
            : `1 ${selectedWorkOrder.settlement.asset} (Reference)`
        }
      />

      {/* Executed verification runs */}
      <SuitesModal
        isOpen={isSuitesModalOpen}
        onClose={() => setIsSuitesModalOpen(false)}
      />

      {/* Governance Scope & Implementation Boundaries Modal */}
      <GovernanceScopeModal
        isOpen={isScopeModalOpen}
        onClose={() => setIsScopeModalOpen(false)}
      />
    </div>
  );
}
