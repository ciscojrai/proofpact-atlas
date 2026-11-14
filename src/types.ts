export interface LatLon {
  lat: number;
  lon: number;
}

export type DataMode = 'SAMPLE DATA' | 'IMPORTED EVIDENCE';

export type PolicyDecision = 'ALLOW' | 'DENY' | 'REQUIRE APPROVAL';

export type WorkOrderTab = 'overview' | 'policy' | 'workflow' | 'evidence' | 'settlement';

export interface OrganizationContext {
  organization: string;
  legalEntity: string;
  operationLocation: string;
  operationCoords: LatLon;
  configuredProcessingRegion: string;
  processingRegionCoords: LatLon;
  costCenter: string;
  providerPolicy: string;
  providerPolicyConfigLabel: 'Demonstration configuration';
}

export interface WorkOrderOverview {
  categoryLabel: string;
  objective: string;
  artifactRevision: string | null;
  reproduceCommand: string | null;
  owner: string;
  provenance: string;
}

export interface PolicyRuleCheck {
  id: string;
  dimension: string;
  configuredThreshold: string;
  observedValue: string;
  outcome: 'Pass' | 'Flag' | 'Block';
}

export interface WorkOrderPolicy {
  decision: PolicyDecision;
  decisionSummary: string;
  isFixtureDriven: true;
  fixtureLabel: 'Demonstration policy — not production authorization.';
  rules: PolicyRuleCheck[];
}

export type AgentMessageType = 'Proposal' | 'Challenge' | 'Revision' | 'Runner result';

export interface AgentWorkflowMessage {
  id: string;
  lane: 'Builder' | 'Challenger';
  type: AgentMessageType;
  stepLabel: string;
  timestamp: string | null;
  summary: string;
  artifactRef: string | null;
  statusNote: string;
}

export interface WorkOrderWorkflow {
  mode: 'Fixture';
  label: 'FIXTURE AGENTS';
  messages: AgentWorkflowMessage[];
}

export interface LocalRunnerEvidence {
  artifactId: string | null;
  runnerId: string | null;
  suiteName: string | null;
  rev1Note: string | null;
  rev2Note: string | null;
  passedChecks: number | null;
  totalChecks: number | null;
  arcsVerified: number | null;
  exitCode: number | null;
  artifactDigest: string | null;
  sourceRevision: string | null;
  reproduceCommand: string | null;
  executedAt: string | null;
  settlementBinding: 'Not integrated' | 'Linked';
  summary: string;
}

export interface ChainTransactionRecord {
  label: string;
  hash: string;
  explorerUrl: string;
}

export interface OperatorSubmittedDigests {
  artifact: string | null;
  specification: string | null;
  result: string | null;
}

export interface OperatorOnChainEvidence {
  verificationSource: 'Operator submission';
  contractTransition: 'Accepted' | null;
  runnerChecksStatus: 'Not executed for this settlement.';
  network: string | null;
  contractAccount: string | null;
  operatorAccount: string | null;
  runId: string | null;
  operatorPassFlag: boolean | null;
  recordedAt: string | null;
  digests: OperatorSubmittedDigests | null;
  txs: ChainTransactionRecord[];
  noChainTransactionsReason: string | null;
}

export interface PaymentOutcomeEvidence {
  isImported: boolean;
  scenarioClassification: string;
  status: 'Paid' | 'Refunded' | 'Verified locally' | 'Pending Escrow';
  escrowIn: string | null;
  paidOut: string | null;
  amount: string;
  asset: string;
  referenceId: string | null;
  recordedAt: string | null;
}

export interface WorkOrderEvidence {
  isImported: boolean;
  localRunner: LocalRunnerEvidence;
  onChainVerification: OperatorOnChainEvidence;
  paymentOutcome: PaymentOutcomeEvidence;
}

export interface WorkOrderSettlement {
  isImported: boolean;
  scenarioClassification: string;
  status: 'Paid' | 'Refunded' | 'Verified locally' | 'Pending Escrow';
  escrowIn: string | null;
  paidOut: string | null;
  amount: string;
  asset: string;
  recordedAt: string | null;
  settlementReference: string | null;
  settlementExplorerUrl: string | null;
  note: string;
}

export interface WorkOrder {
  id: string;
  title: string;
  /** Sample scenarios hide behind the "Include sample scenarios" toggle. Never attach another operation's transactions to a sample. */
  sampleScenario?: boolean;
  recordedAt: string | null;
  orgContext: OrganizationContext;
  overview: WorkOrderOverview;
  policy: WorkOrderPolicy;
  workflow: WorkOrderWorkflow;
  evidence: WorkOrderEvidence;
  settlement: WorkOrderSettlement;
}

export interface EvidenceTimelineEvent {
  id: string;
  stepLabel: string;
  timestamp: string | null;
  workOrderId: string;
  operationLocation: string;
  legalEntity: string;
  eventType:
    | 'Proposal'
    | 'Challenge'
    | 'Runner result'
    | 'Policy'
    | 'On-chain'
    | 'Settlement'
    | 'Refund'
    | 'Missing evidence';
  summary: string;
  targetTab: WorkOrderTab;
}

export interface GlobalSummaryMetrics {
  dataMode: DataMode;
  dataSourceLabel: string;
  recordedPaidJobs: number;
  recordedRefunds: number;
  fixtureWorkflows: number;
  missingEvidenceFields: number;
  importedOperationsCount: number;
}
