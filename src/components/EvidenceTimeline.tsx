import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { EvidenceTimelineEvent } from '../types';

interface EvidenceTimelineProps {
  events: EvidenceTimelineEvent[];
  selectedWorkOrderId: string;
  activeEventId: string;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSelectEvent: (event: EvidenceTimelineEvent) => void;
  onStepEvent: (direction: -1 | 1) => void;
}

export const EvidenceTimeline: React.FC<EvidenceTimelineProps> = ({
  events,
  selectedWorkOrderId,
  activeEventId,
  isPlaying,
  onTogglePlay,
  onSelectEvent,
  onStepEvent,
}) => {
  const [scope, setScope] = useState<'all' | 'selected'>('all');

  const visibleEvents =
    scope === 'selected'
      ? events.filter((e) => e.workOrderId === selectedWorkOrderId)
      : events;

  const getEventAccentClass = (type: EvidenceTimelineEvent['eventType']) => {
    switch (type) {
      case 'Settlement':
      case 'On-chain':
        return 'text-emerald-400';
      case 'Refund':
        return 'text-rose-400';
      case 'Policy':
      case 'Missing evidence':
      case 'Challenge':
        return 'text-amber-300';
      default:
        return 'text-sky-300';
    }
  };

  return (
    <footer
      className="w-full bg-[#0A0E17] border-t border-slate-800 px-4 py-2.5 lg:px-6 shrink-0 z-30"
      aria-label="Evidence activity timeline"
    >
      {/* Top Timeline Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xs font-semibold text-slate-200 tracking-wide">
            Evidence Activity Timeline
          </h2>
          <span className="text-[11px] text-slate-400">
            Historical scenario replay only · Does not monitor live chain state
          </span>
          <div className="flex items-center p-0.5 rounded bg-[#070A10] border border-slate-800">
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                scope === 'all' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All operations ({events.length})
            </button>
            <button
              type="button"
              onClick={() => setScope('selected')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                scope === 'selected'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Selected ({selectedWorkOrderId})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2" aria-label="Historical replay controls">
          <button
            type="button"
            onClick={() => onStepEvent(-1)}
            aria-label="Previous replay step"
            className="p-2.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause scenario replay' : 'Play scenario replay'}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-sky-600 hover:bg-sky-500 border border-sky-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-sky-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isPlaying ? 'Pause' : 'Step Replay'}</span>
          </button>
          <button
            type="button"
            onClick={() => onStepEvent(1)}
            aria-label="Next replay step"
            className="p-2.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Event Strip */}
      <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1">
        {visibleEvents.map((evt) => {
          const isActive = evt.id === activeEventId;
          const isCurrentOrder = evt.workOrderId === selectedWorkOrderId;
          return (
            <button
              key={evt.id}
              type="button"
              onClick={() => onSelectEvent(evt)}
              className={`min-w-[235px] max-w-[260px] text-left p-2.5 rounded-md border transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                isActive
                  ? 'bg-[#131B29] border-sky-500/60'
                  : isCurrentOrder
                  ? 'bg-[#0E1420] border-slate-700 hover:border-slate-600'
                  : 'bg-[#080C14] border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                <span className={getEventAccentClass(evt.eventType)}>{evt.eventType}</span>
                <span className="text-slate-400">{evt.timestamp ?? evt.stepLabel}</span>
              </div>
              <div className="text-xs font-medium text-slate-100 mt-1 line-clamp-1">
                {evt.workOrderId} · {evt.operationLocation}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1" title={evt.summary}>
                {evt.summary}
              </div>
            </button>
          );
        })}
      </div>
    </footer>
  );
};
