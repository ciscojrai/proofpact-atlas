import { WorkOrder, EvidenceTimelineEvent, GlobalSummaryMetrics, DataMode } from '../types';

export const WORKSPACE_NAME = 'Example Mobility Group';
export const WORKSPACE_BADGE = 'DEMONSTRATION WORKSPACE';

/**
 * Imported verification payload verified verbatim against TESTNET.md
 * (Chicago pp_demo0001, London pp_demo0002, Singapore fixture-sim).
 * Sao Paulo remains an unimported cross-region policy scenario.
 */
export const DATA_MODE: DataMode = 'IMPORTED EVIDENCE';
export const DATA_SOURCE_LABEL = 'TESTNET.md (3 imported + 1 sample)';

const EXPLORER_BASE = 'https://testnet.nearblocks.io/txns/';
const TESTNET_NETWORK = 'NEAR testnet';
const TESTNET_CONTRACT = 'proofpact.addychief.testnet';
const TESTNET_OPERATOR = 'addychief.testnet';

export const WORK_ORDERS: WorkOrder[] = [
  {
    id: 'pp_demo0001',
    title: 'Chicago — Recorded Testnet Payment Demonstration',
    recordedAt: '2026-11-13T18:55:42Z',
    orgContext: {
      organization: 'Example Mobility Group',
      legalEntity: 'Example Mobility North America Inc.',
      operationLocation: 'Chicago, United States',
      operationCoords: { lat: 41.8781, lon: -87.6298 },
      configuredProcessingRegion: 'us-central-1 (Configured Sample Region)',
      processingRegionCoords: { lat: 41.2565, lon: -95.9345 },
      costCenter: 'CC-2104-OPS-NA',
      providerPolicy: 'Testnet Escrow Cap · 1.01 NEAR',
      providerPolicyConfigLabel: 'Demonstration configuration',
    },
    overview: {
      categoryLabel: 'Recorded testnet payment demonstration (TESTNET.md)',
      objective:
        'Verify full NEAR testnet escrow lifecycle (fund, activate, submit rev 1, verify pass, payout, and rejected DOUBLE_SETTLE retry) for job pp_demo0001.',
      artifactRevision: 'c5fbb23b1c64e43785d98372b11c232a1bae99ab56c3f2909135a810fc04f3cd',
      reproduceCommand: null,
      owner: 'Operator: addychief.testnet (Illustrative Org Context)',
      provenance:
        'Imported verbatim from TESTNET.md against contract proofpact.addychief.testnet on NEAR testnet. Digests represent operator-submitted on-chain values.',
    },
    policy: {
      decision: 'ALLOW',
      decisionSummary:
        'Illustrative demonstration policy: escrow funding (1.01 NEAR) and single payout (1 NEAR x 1) align with demonstration rules, and duplicate settlement retry was rejected (DOUBLE_SETTLE).',
      isFixtureDriven: true,
      fixtureLabel: 'Demonstration policy — not production authorization.',
      rules: [
        {
          id: 'POL-ESC-01',
          dimension: 'Single-Settlement Guard',
          configuredThreshold: 'Reject duplicate payout attempts (Demonstration configuration)',
          observedValue: 'retry rejected DOUBLE_SETTLE (55ADqtRg...)',
          outcome: 'Pass',
        },
        {
          id: 'POL-REG-01',
          dimension: 'Configured Processing Region Assignment',
          configuredThreshold: 'Explicit region field required (Demonstration configuration)',
          observedValue: 'us-central-1 (Configured Sample Region)',
          outcome: 'Pass',
        },
      ],
    },
    workflow: {
      mode: 'Fixture',
      label: 'FIXTURE AGENTS',
      messages: [
        {
          id: 'msg-chi-1',
          lane: 'Builder',
          type: 'Proposal',
          stepLabel: 'Step 01',
          timestamp: null,
          summary:
            'Fixture proposal representing submission rev 1 anchored on NEAR testnet (submit rev 1).',
          artifactRef: 'c5fbb23b1c64e43785d98372b11c232a1bae99ab56c3f2909135a810fc04f3cd',
          statusNote: 'Fixture context for pp_demo0001',
        },
        {
          id: 'msg-chi-2',
          lane: 'Challenger',
          type: 'Challenge',
          stepLabel: 'Step 02',
          timestamp: null,
          summary:
            'Fixture challenge verifying specification digest binding and double-settlement rejection.',
          artifactRef: 'e15a2a1620580c36ce0f35724fe781dd04aa4d8f7dd62d9baaae21ad122f0d36',
          statusNote: 'Specification digest checked',
        },
        {
          id: 'msg-chi-3',
          lane: 'Builder',
          type: 'Revision',
          stepLabel: 'Step 03',
          timestamp: '2026-11-13T18:55:42Z',
          summary:
            'Operator submitted verification run testnet-run-1 on-chain via verify pass transaction.',
          artifactRef: 'f949fea06e317440d5a3ea5de4f9218061165df595c469ff70889c0f1a7423fd',
          statusNote: 'Operator-submitted digest',
        },
        {
          id: 'msg-chi-4',
          lane: 'Builder',
          type: 'Runner result',
          stepLabel: 'Step 04',
          timestamp: null,
          summary:
            'Independent local runner execution metadata was not imported for pp_demo0001; settlement relied on operator submission.',
          artifactRef: null,
          statusNote: 'Not executed for this settlement',
        },
      ],
    },
    evidence: {
      isImported: true,
      localRunner: {
        artifactId: null,
        runnerId: null,
        suiteName: null,
        rev1Note: null,
        rev2Note: null,
        passedChecks: null,
        totalChecks: null,
        arcsVerified: null,
        exitCode: null,
        artifactDigest: null,
        sourceRevision: null,
        reproduceCommand: null,
        executedAt: null,
        settlementBinding: 'Not integrated',
        summary:
          'No independent local runner certificate was supplied for pp_demo0001. On-chain verification reflects operator submission (runId: testnet-run-1).',
      },
      onChainVerification: {
        verificationSource: 'Operator submission',
        contractTransition: 'Accepted',
        runnerChecksStatus: 'Not executed for this settlement.',
        network: TESTNET_NETWORK,
        contractAccount: TESTNET_CONTRACT,
        operatorAccount: TESTNET_OPERATOR,
        runId: 'testnet-run-1',
        operatorPassFlag: true,
        recordedAt: '2026-11-13T18:55:42Z',
        digests: {
          artifact: 'c5fbb23b1c64e43785d98372b11c232a1bae99ab56c3f2909135a810fc04f3cd',
          specification: 'e15a2a1620580c36ce0f35724fe781dd04aa4d8f7dd62d9baaae21ad122f0d36',
          result: 'f949fea06e317440d5a3ea5de4f9218061165df595c469ff70889c0f1a7423fd',
        },
        txs: [
          {
            label: 'fund',
            hash: '3zgY5PxuVb9V19QsjQQMMg5EweeLtMU5U9yZcCjG8Lze',
            explorerUrl: `${EXPLORER_BASE}3zgY5PxuVb9V19QsjQQMMg5EweeLtMU5U9yZcCjG8Lze`,
          },
          {
            label: 'activate',
            hash: '2GKwuoS3JxU1ctbeJKkbFoLpPmerSz8bxoscfuHsCnQq',
            explorerUrl: `${EXPLORER_BASE}2GKwuoS3JxU1ctbeJKkbFoLpPmerSz8bxoscfuHsCnQq`,
          },
          {
            label: 'submit rev 1',
            hash: '3JPARgMoinPfwgEa53esmqznvgMzwy9ZVJekDYySbhKZ',
            explorerUrl: `${EXPLORER_BASE}3JPARgMoinPfwgEa53esmqznvgMzwy9ZVJekDYySbhKZ`,
          },
          {
            label: 'verify pass',
            hash: 'XwsXKNqpSQApZqHhihrWotzETvEbm1uQEjx3k2gfYqc',
            explorerUrl: `${EXPLORER_BASE}XwsXKNqpSQApZqHhihrWotzETvEbm1uQEjx3k2gfYqc`,
          },
          {
            label: 'payout',
            hash: 'Fk9oqzimH1kCd3vZqM4EhS8fkyKz5vDNscCmfdMcy12i',
            explorerUrl: `${EXPLORER_BASE}Fk9oqzimH1kCd3vZqM4EhS8fkyKz5vDNscCmfdMcy12i`,
          },
          {
            label: 'retry rejected DOUBLE_SETTLE',
            hash: '55ADqtRgSLpmjnD5k7E6dFX64wDZLSAybbJ14JmUbMZA',
            explorerUrl: `${EXPLORER_BASE}55ADqtRgSLpmjnD5k7E6dFX64wDZLSAybbJ14JmUbMZA`,
          },
        ],
        noChainTransactionsReason: null,
      },
      paymentOutcome: {
        isImported: true,
        scenarioClassification: 'Recorded testnet payment demonstration',
        status: 'Paid',
        escrowIn: '1.01 NEAR',
        paidOut: '1 NEAR x 1',
        amount: '1',
        asset: 'NEAR',
        referenceId: 'Fk9oqzimH1kCd3vZqM4EhS8fkyKz5vDNscCmfdMcy12i',
        recordedAt: '2026-11-13T18:55:42Z',
      },
    },
    settlement: {
      isImported: true,
      scenarioClassification: 'Recorded testnet payment demonstration',
      status: 'Paid',
      escrowIn: '1.01 NEAR',
      paidOut: '1 NEAR x 1',
      amount: '1',
      asset: 'NEAR',
      recordedAt: '2026-11-13T18:55:42Z',
      settlementReference: 'Fk9oqzimH1kCd3vZqM4EhS8fkyKz5vDNscCmfdMcy12i',
      settlementExplorerUrl: `${EXPLORER_BASE}Fk9oqzimH1kCd3vZqM4EhS8fkyKz5vDNscCmfdMcy12i`,
      note: 'Recorded NEAR testnet payout (1 NEAR x 1 from 1.01 NEAR escrow) verified against TESTNET.md. Retry DOUBLE_SETTLE was rejected on-chain.',
    },
  },
  {
    id: 'pp_demo0002',
    title: 'London — Recorded Testnet Refund Demonstration',
    recordedAt: null,
    orgContext: {
      organization: 'Example Mobility Group',
      legalEntity: 'Example Mobility UK Operations Ltd.',
      operationLocation: 'London, United Kingdom',
      operationCoords: { lat: 51.5072, lon: -0.1276 },
      configuredProcessingRegion: 'eu-west-2 (Configured Sample Region)',
      processingRegionCoords: { lat: 51.5072, lon: -0.1276 },
      costCenter: 'CC-4409-OPS-UK',
      providerPolicy: 'Testnet Escrow Refund · 0.11 NEAR',
      providerPolicyConfigLabel: 'Demonstration configuration',
    },
    overview: {
      categoryLabel: 'Recorded testnet refund demonstration (TESTNET.md)',
      objective:
        'Verify NEAR testnet escrow refund path (fund, activate, refund) returning 0.11 NEAR for job pp_demo0002.',
      artifactRevision: null,
      reproduceCommand: null,
      owner: 'Operator: addychief.testnet (Illustrative Org Context)',
      provenance:
        'Imported verbatim from TESTNET.md against contract proofpact.addychief.testnet on NEAR testnet. No verification digests or local runner output were part of this refund record.',
    },
    policy: {
      decision: 'DENY',
      decisionSummary:
        'Illustrative demonstration policy: job pp_demo0002 closed with an on-chain escrow refund of 0.11 NEAR rather than a payout.',
      isFixtureDriven: true,
      fixtureLabel: 'Demonstration policy — not production authorization.',
      rules: [
        {
          id: 'POL-SIG-01',
          dimension: 'Verification Transition Status',
          configuredThreshold: 'Accepted operator verification required before payout (Demonstration configuration)',
          observedValue: 'Not supplied (refund executed)',
          outcome: 'Block',
        },
        {
          id: 'POL-REG-01',
          dimension: 'Configured Processing Region Assignment',
          configuredThreshold: 'Explicit region field required (Demonstration configuration)',
          observedValue: 'eu-west-2 (Configured Sample Region)',
          outcome: 'Pass',
        },
      ],
    },
    workflow: {
      mode: 'Fixture',
      label: 'FIXTURE AGENTS',
      messages: [
        {
          id: 'msg-lon-1',
          lane: 'Builder',
          type: 'Proposal',
          stepLabel: 'Step 01',
          timestamp: null,
          summary:
            'Fixture context for pp_demo0002 escrow creation (fund and activate transactions recorded on NEAR testnet).',
          artifactRef: null,
          statusNote: 'Escrow funded (0.11 NEAR)',
        },
        {
          id: 'msg-lon-2',
          lane: 'Challenger',
          type: 'Challenge',
          stepLabel: 'Step 02',
          timestamp: null,
          summary:
            'No passing verification transition was submitted for pp_demo0002.',
          artifactRef: null,
          statusNote: 'Refund path triggered',
        },
        {
          id: 'msg-lon-3',
          lane: 'Builder',
          type: 'Revision',
          stepLabel: 'Step 03',
          timestamp: null,
          summary:
            'No revision submitted; escrow closed via on-chain refund transaction.',
          artifactRef: null,
          statusNote: '0.11 NEAR refunded',
        },
        {
          id: 'msg-lon-4',
          lane: 'Builder',
          type: 'Runner result',
          stepLabel: 'Step 04',
          timestamp: null,
          summary:
            'No local runner execution metadata was supplied for pp_demo0002.',
          artifactRef: null,
          statusNote: 'Not supplied',
        },
      ],
    },
    evidence: {
      isImported: true,
      localRunner: {
        artifactId: null,
        runnerId: null,
        suiteName: null,
        rev1Note: null,
        rev2Note: null,
        passedChecks: null,
        totalChecks: null,
        arcsVerified: null,
        exitCode: null,
        artifactDigest: null,
        sourceRevision: null,
        reproduceCommand: null,
        executedAt: null,
        settlementBinding: 'Not integrated',
        summary: 'No local runner execution metadata was supplied for pp_demo0002.',
      },
      onChainVerification: {
        verificationSource: 'Operator submission',
        contractTransition: null,
        runnerChecksStatus: 'Not executed for this settlement.',
        network: TESTNET_NETWORK,
        contractAccount: TESTNET_CONTRACT,
        operatorAccount: TESTNET_OPERATOR,
        runId: null,
        operatorPassFlag: null,
        recordedAt: null,
        digests: null,
        txs: [
          {
            label: 'fund',
            hash: 'BqJ7M135JMc6thoo65p35jCPTSovLnoMQdoohA8FMwtc',
            explorerUrl: `${EXPLORER_BASE}BqJ7M135JMc6thoo65p35jCPTSovLnoMQdoohA8FMwtc`,
          },
          {
            label: 'activate',
            hash: '6k1U5Ex7qPgkzr9bfZSpTMqZtQf4sS9tgQXYbf1SyLkz',
            explorerUrl: `${EXPLORER_BASE}6k1U5Ex7qPgkzr9bfZSpTMqZtQf4sS9tgQXYbf1SyLkz`,
          },
          {
            label: 'refund',
            hash: 'GDUqKdK1J4sBaQDKxgyNiqeBNrHG8ZfY4knC1sSEkmo2',
            explorerUrl: `${EXPLORER_BASE}GDUqKdK1J4sBaQDKxgyNiqeBNrHG8ZfY4knC1sSEkmo2`,
          },
        ],
        noChainTransactionsReason: null,
      },
      paymentOutcome: {
        isImported: true,
        scenarioClassification: 'Recorded testnet refund demonstration',
        status: 'Refunded',
        escrowIn: '0.11 NEAR',
        paidOut: '0.11 NEAR',
        amount: '0.11',
        asset: 'NEAR',
        referenceId: 'GDUqKdK1J4sBaQDKxgyNiqeBNrHG8ZfY4knC1sSEkmo2',
        recordedAt: null,
      },
    },
    settlement: {
      isImported: true,
      scenarioClassification: 'Recorded testnet refund demonstration',
      status: 'Refunded',
      escrowIn: '0.11 NEAR',
      paidOut: '0.11 NEAR',
      amount: '0.11',
      asset: 'NEAR',
      recordedAt: null,
      settlementReference: 'GDUqKdK1J4sBaQDKxgyNiqeBNrHG8ZfY4knC1sSEkmo2',
      settlementExplorerUrl: `${EXPLORER_BASE}GDUqKdK1J4sBaQDKxgyNiqeBNrHG8ZfY4knC1sSEkmo2`,
      note: 'Recorded NEAR testnet refund returning 0.11 NEAR from 0.11 NEAR escrow, verified against TESTNET.md.',
    },
  },
  {
    id: 'fixture-sim',
    title: 'Singapore — Local Fixture Runner Verification',
    recordedAt: '2026-11-14T04:30:49Z',
    orgContext: {
      organization: 'Example Mobility Group',
      legalEntity: 'Example Mobility APAC Pte. Ltd.',
      operationLocation: 'Singapore',
      operationCoords: { lat: 1.3521, lon: 103.8198 },
      configuredProcessingRegion: 'ap-southeast-1 (Configured Sample Region)',
      processingRegionCoords: { lat: 1.3521, lon: 103.8198 },
      costCenter: 'CC-3305-PAYOUT-SG',
      providerPolicy: 'Local Fixture Runner · No Chain Escrow',
      providerPolicyConfigLabel: 'Demonstration configuration',
    },
    overview: {
      categoryLabel: 'Fixture-based agent workflow (Verified locally, no chain txs)',
      objective:
        'Execute deterministic local fixture suite from rev1 failure (CSV-03 missing parse_decimal) through rev2 pass (27/27 checks across 6 arcs).',
      artifactRevision: 'ab097ea7892e690fce50aa6d14501d6b6ee3958a',
      reproduceCommand: 'node family/run.mjs family/artifacts/reference.json family/fixtures',
      owner: 'APAC Ledger Engineering (Illustrative Org Context)',
      provenance:
        'Imported verbatim from TESTNET.md local runner metadata. Contains zero on-chain transactions (no chain transactions).',
    },
    policy: {
      decision: 'ALLOW',
      decisionSummary:
        'Illustrative demonstration policy: local fixture runner passed 27/27 checks across 6 arcs in rev2. No on-chain settlement is attached.',
      isFixtureDriven: true,
      fixtureLabel: 'Demonstration policy — not production authorization.',
      rules: [
        {
          id: 'POL-RUN-01',
          dimension: 'Local Fixture Suite Assertions',
          configuredThreshold: 'All fixture checks pass (Demonstration configuration)',
          observedValue: 'rev2: pass, 27/27, 6 arcs',
          outcome: 'Pass',
        },
        {
          id: 'POL-REG-01',
          dimension: 'Configured Processing Region Assignment',
          configuredThreshold: 'Explicit region field required (Demonstration configuration)',
          observedValue: 'ap-southeast-1 (Configured Sample Region)',
          outcome: 'Pass',
        },
      ],
    },
    workflow: {
      mode: 'Fixture',
      label: 'FIXTURE AGENTS',
      messages: [
        {
          id: 'msg-sgp-1',
          lane: 'Builder',
          type: 'Proposal',
          stepLabel: 'Rev 1',
          timestamp: null,
          summary:
            'Submitted rev1 candidate implementation prior to decimal parser enforcement.',
          artifactRef: 'ab097ea7892e690fce50aa6d14501d6b6ee3958a',
          statusNote: 'CSV-03 fail (no parse_decimal)',
        },
        {
          id: 'msg-sgp-2',
          lane: 'Challenger',
          type: 'Challenge',
          stepLabel: 'Challenge',
          timestamp: null,
          summary:
            'Challenger fixture flagged rev1 failure on CSV-03 due to missing parse_decimal handling.',
          artifactRef: null,
          statusNote: 'CSV-03 fail (no parse_decimal)',
        },
        {
          id: 'msg-sgp-3',
          lane: 'Builder',
          type: 'Revision',
          stepLabel: 'Rev 2',
          timestamp: '2026-11-14T04:30:49Z',
          summary:
            'Applied parse_decimal revision at sourceRevision ab097ea7892e690fce50aa6d14501d6b6ee3958a.',
          artifactRef: 'ab097ea7892e690fce50aa6d14501d6b6ee3958a',
          statusNote: 'Ready for local runner',
        },
        {
          id: 'msg-sgp-4',
          lane: 'Builder',
          type: 'Runner result',
          stepLabel: 'Runner',
          timestamp: '2026-11-14T04:30:49Z',
          summary:
            'Verified locally via `node family/run.mjs family/artifacts/reference.json family/fixtures`: rev2 pass, 27/27, 6 arcs.',
          artifactRef: 'fed0b24a05ddb24017491c89ac0e432ccd9fdf19c61470feec9508dac3604513',
          statusNote: 'Verified locally (no chain txs)',
        },
      ],
    },
    evidence: {
      isImported: true,
      localRunner: {
        artifactId: 'family/artifacts/reference.json',
        runnerId: 'node family/run.mjs',
        suiteName: 'family/fixtures (6 arcs)',
        rev1Note: 'CSV-03 fail (no parse_decimal)',
        rev2Note: 'pass, 27/27, 6 arcs',
        passedChecks: 27,
        totalChecks: 27,
        arcsVerified: 6,
        exitCode: 0,
        artifactDigest: 'fed0b24a05ddb24017491c89ac0e432ccd9fdf19c61470feec9508dac3604513',
        sourceRevision: 'ab097ea7892e690fce50aa6d14501d6b6ee3958a',
        reproduceCommand: 'node family/run.mjs family/artifacts/reference.json family/fixtures',
        executedAt: '2026-11-14T04:30:49Z',
        settlementBinding: 'Not integrated',
        summary:
          'Imported local runner verification: rev1 failed CSV-03 (no parse_decimal); rev2 passed 27/27 checks across 6 arcs. Not bound to an on-chain settlement.',
      },
      onChainVerification: {
        verificationSource: 'Operator submission',
        contractTransition: null,
        runnerChecksStatus: 'Not executed for this settlement.',
        network: null,
        contractAccount: null,
        operatorAccount: null,
        runId: null,
        operatorPassFlag: null,
        recordedAt: null,
        digests: null,
        txs: [],
        noChainTransactionsReason: 'no chain transactions',
      },
      paymentOutcome: {
        isImported: true,
        scenarioClassification: 'Local fixture runner verification (no chain transactions)',
        status: 'Verified locally',
        escrowIn: null,
        paidOut: null,
        amount: '0',
        asset: 'NEAR',
        referenceId: null,
        recordedAt: '2026-11-14T04:30:49Z',
      },
    },
    settlement: {
      isImported: true,
      scenarioClassification: 'Local fixture runner verification (no chain transactions)',
      status: 'Verified locally',
      escrowIn: null,
      paidOut: null,
      amount: '0',
      asset: 'NEAR',
      recordedAt: '2026-11-14T04:30:49Z',
      settlementReference: null,
      settlementExplorerUrl: null,
      note: 'Verified locally with no chain transactions. Local runner results are not integrated with on-chain settlement.',
    },
  },
  {
    id: 'WO-SAMPLE-GRU-04',
    title: 'São Paulo — Cross-Region Configuration Sample',
    recordedAt: null,
    sampleScenario: true,
    orgContext: {
      organization: 'Example Mobility Group',
      legalEntity: 'Example Mobility LatAm Ltda.',
      operationLocation: 'São Paulo, Brazil',
      operationCoords: { lat: -23.5505, lon: -46.6333 },
      configuredProcessingRegion: 'us-east-1 (Configured Sample Region)',
      processingRegionCoords: { lat: 39.0438, lon: -77.4874 },
      costCenter: 'CC-7210-DISPATCH-BR',
      providerPolicy: 'Cross-Region Hold · Cap 15.00 USDC',
      providerPolicyConfigLabel: 'Demonstration configuration',
    },
    overview: {
      categoryLabel: 'Illustrative cross-region configuration sample (not in TESTNET.md)',
      objective:
        'Demonstrates explicit legal entity and processing region configuration independent of city coordinates on the globe.',
      artifactRevision: null,
      reproduceCommand: null,
      owner: 'Regional Fleet Operations (Sample Role)',
      provenance:
        'Sample scenario (not imported from TESTNET.md). Shows REQUIRE APPROVAL policy state and Not supplied evidence placeholders.',
    },
    policy: {
      decision: 'REQUIRE APPROVAL',
      decisionSummary:
        'Illustrative demonstration policy: configured processing region (us-east-1) differs from the illustrative operation city (São Paulo), triggering a hold.',
      isFixtureDriven: true,
      fixtureLabel: 'Demonstration policy — not production authorization.',
      rules: [
        {
          id: 'POL-REG-04',
          dimension: 'Cross-Region Configuration Check',
          configuredThreshold: 'Hold when configured region differs from metro label (Demonstration configuration)',
          observedValue: 'São Paulo -> us-east-1',
          outcome: 'Flag',
        },
        {
          id: 'POL-CAP-02',
          dimension: 'Sample Spend Cap',
          configuredThreshold: 'Max 15.00 USDC (Demonstration configuration)',
          observedValue: '12.50 USDC (sample scenario)',
          outcome: 'Pass',
        },
      ],
    },
    workflow: {
      mode: 'Fixture',
      label: 'FIXTURE AGENTS',
      messages: [
        {
          id: 'msg-gru-1',
          lane: 'Builder',
          type: 'Proposal',
          stepLabel: 'Step 01',
          timestamp: null,
          summary:
            'Fixture proposal illustrating field-masking rules prior to cross-region dispatch serialization.',
          artifactRef: null,
          statusNote: 'Sample fixture message',
        },
        {
          id: 'msg-gru-2',
          lane: 'Challenger',
          type: 'Challenge',
          stepLabel: 'Step 02',
          timestamp: null,
          summary:
            'Fixture challenge requesting coarse grid rounding for location fields.',
          artifactRef: null,
          statusNote: 'Sample fixture message',
        },
        {
          id: 'msg-gru-3',
          lane: 'Builder',
          type: 'Revision',
          stepLabel: 'Step 03',
          timestamp: null,
          summary:
            'Fixture revision applying 250m grid snapping in sample configuration.',
          artifactRef: null,
          statusNote: 'Sample fixture message',
        },
        {
          id: 'msg-gru-4',
          lane: 'Builder',
          type: 'Runner result',
          stepLabel: 'Step 04',
          timestamp: null,
          summary:
            'No local runner execution metadata was supplied for this sample scenario.',
          artifactRef: null,
          statusNote: 'Not supplied',
        },
      ],
    },
    evidence: {
      isImported: false,
      localRunner: {
        artifactId: null,
        runnerId: null,
        suiteName: null,
        rev1Note: null,
        rev2Note: null,
        passedChecks: null,
        totalChecks: null,
        arcsVerified: null,
        exitCode: null,
        artifactDigest: null,
        sourceRevision: null,
        reproduceCommand: null,
        executedAt: null,
        settlementBinding: 'Not integrated',
        summary: 'No local runner execution metadata was supplied for this sample scenario.',
      },
      onChainVerification: {
        verificationSource: 'Operator submission',
        contractTransition: null,
        runnerChecksStatus: 'Not executed for this settlement.',
        network: null,
        contractAccount: null,
        operatorAccount: null,
        runId: null,
        operatorPassFlag: null,
        recordedAt: null,
        digests: null,
        txs: [],
        noChainTransactionsReason: 'no chain transactions',
      },
      paymentOutcome: {
        isImported: false,
        scenarioClassification: 'Illustrative sample hold scenario',
        status: 'Pending Escrow',
        escrowIn: null,
        paidOut: null,
        amount: '12.50',
        asset: 'USDC',
        referenceId: null,
        recordedAt: null,
      },
    },
    settlement: {
      isImported: false,
      scenarioClassification: 'Illustrative sample hold scenario',
      status: 'Pending Escrow',
      escrowIn: null,
      paidOut: null,
      amount: '12.50',
      asset: 'USDC',
      recordedAt: null,
      settlementReference: null,
      settlementExplorerUrl: null,
      note: 'Illustrative sample scenario held pending approval. Not part of TESTNET.md imported transactions.',
    },
  },
];

export const EVIDENCE_TIMELINE_EVENTS: EvidenceTimelineEvent[] = [
  {
    id: 'evt-chi-verify',
    stepLabel: 'Step 01',
    timestamp: '2026-11-13T18:55:42Z',
    workOrderId: 'pp_demo0001',
    operationLocation: 'Chicago, United States',
    legalEntity: 'Example Mobility North America Inc.',
    eventType: 'On-chain',
    summary:
      'pp_demo0001 operator verification (testnet-run-1) accepted on NEAR testnet; verify pass & payout recorded.',
    targetTab: 'evidence',
  },
  {
    id: 'evt-chi-payout',
    stepLabel: 'Step 02',
    timestamp: '2026-11-13T18:55:42Z',
    workOrderId: 'pp_demo0001',
    operationLocation: 'Chicago, United States',
    legalEntity: 'Example Mobility North America Inc.',
    eventType: 'Settlement',
    summary:
      'pp_demo0001 Paid 1 NEAR x 1 (escrowIn 1.01 NEAR); retry DOUBLE_SETTLE rejected on-chain.',
    targetTab: 'settlement',
  },
  {
    id: 'evt-lon-refund',
    stepLabel: 'Step 03',
    timestamp: null,
    workOrderId: 'pp_demo0002',
    operationLocation: 'London, United Kingdom',
    legalEntity: 'Example Mobility UK Operations Ltd.',
    eventType: 'Refund',
    summary:
      'pp_demo0002 Refunded 0.11 NEAR on NEAR testnet (fund, activate, refund txs recorded).',
    targetTab: 'evidence',
  },
  {
    id: 'evt-sgp-rev1',
    stepLabel: 'Step 04',
    timestamp: null,
    workOrderId: 'fixture-sim',
    operationLocation: 'Singapore',
    legalEntity: 'Example Mobility APAC Pte. Ltd.',
    eventType: 'Challenge',
    summary:
      'Singapore fixture-sim rev1: CSV-03 fail (no parse_decimal) prior to rev2 fix.',
    targetTab: 'workflow',
  },
  {
    id: 'evt-sgp-rev2',
    stepLabel: 'Step 05',
    timestamp: '2026-11-14T04:30:49Z',
    workOrderId: 'fixture-sim',
    operationLocation: 'Singapore',
    legalEntity: 'Example Mobility APAC Pte. Ltd.',
    eventType: 'Runner result',
    summary:
      'Singapore fixture-sim rev2: Verified locally (pass, 27/27, 6 arcs; no chain transactions).',
    targetTab: 'evidence',
  },
  {
    id: 'evt-gru-hold',
    stepLabel: 'Step 06',
    timestamp: null,
    workOrderId: 'WO-SAMPLE-GRU-04',
    operationLocation: 'São Paulo, Brazil',
    legalEntity: 'Example Mobility LatAm Ltda.',
    eventType: 'Policy',
    summary:
      'Sample cross-region hold (São Paulo -> us-east-1); no imported testnet transactions.',
    targetTab: 'policy',
  },
];

export interface EvidenceLinkageAnalysis {
  missingFields: string[];
  explanation: string;
  isComplete: boolean;
}

/**
 * Inspects a work order's three separated evidence layers and explains missing linkage in plain language.
 */
export function analyzeEvidenceLinkage(wo: WorkOrder): EvidenceLinkageAnalysis {
  const missingFields: string[] = [];
  const { localRunner, onChainVerification, paymentOutcome } = wo.evidence;

  if (!localRunner.artifactId) missingFields.push('localRunner.artifactId');
  if (localRunner.passedChecks === null || localRunner.totalChecks === null) {
    missingFields.push('localRunner.checkCounts');
  }
  if (!localRunner.artifactDigest) missingFields.push('localRunner.artifactDigest');
  if (!localRunner.executedAt) missingFields.push('localRunner.executedAt');

  if (!onChainVerification.contractTransition) missingFields.push('onChainVerification.contractTransition');
  if (onChainVerification.txs.length === 0) missingFields.push('onChainVerification.txs');
  if (!onChainVerification.operatorAccount) missingFields.push('onChainVerification.operatorAccount');
  if (!onChainVerification.recordedAt) missingFields.push('onChainVerification.recordedAt');

  if (!paymentOutcome.referenceId) missingFields.push('paymentOutcome.referenceId');
  if (!paymentOutcome.recordedAt) missingFields.push('paymentOutcome.recordedAt');

  if (wo.id === 'pp_demo0001') {
    return {
      missingFields,
      isComplete: false,
      explanation:
        'Imported NEAR testnet payment record (pp_demo0001) includes 6 verified transactions and operator-submitted digests. The result digest is operator-submitted (not a local runner certificate), and local runner execution remains Not integrated.',
    };
  }

  if (wo.id === 'pp_demo0002') {
    return {
      missingFields,
      isComplete: false,
      explanation:
        'Imported NEAR testnet refund record (pp_demo0002) includes 3 verified transactions (fund, activate, refund). No verification transition, digests, or local runner execution metadata were recorded for this refund.',
    };
  }

  if (wo.id === 'fixture-sim') {
    return {
      missingFields,
      isComplete: false,
      explanation:
        'Imported local runner fixture (fixture-sim) passed 27/27 checks across 6 arcs in rev2, but has no chain transactions and no on-chain settlement (Settlement binding: Not integrated).',
    };
  }

  return {
    missingFields,
    isComplete: false,
    explanation: `Sample scenario with no imported TESTNET.md evidence supplied. ${missingFields.length} evidence fields are unavailable ("Not supplied"), and settlement binding defaults to "${localRunner.settlementBinding}".`,
  };
}

/**
 * Dynamically calculates Global Summary metrics strictly from loaded work orders.
 */
export function computeGlobalSummary(workOrders: WorkOrder[]): GlobalSummaryMetrics {
  let recordedPaidJobs = 0;
  let recordedRefunds = 0;
  let fixtureWorkflows = 0;
  let missingEvidenceFields = 0;
  let importedOperationsCount = 0;

  for (const wo of workOrders) {
    if (wo.evidence.isImported) {
      importedOperationsCount += 1;
      if (wo.settlement.status === 'Paid') recordedPaidJobs += 1;
      if (wo.settlement.status === 'Refunded') recordedRefunds += 1;
    }
    if (wo.workflow.mode === 'Fixture') fixtureWorkflows += 1;
    missingEvidenceFields += analyzeEvidenceLinkage(wo).missingFields.length;
  }

  return {
    dataMode: DATA_MODE,
    dataSourceLabel: DATA_SOURCE_LABEL,
    recordedPaidJobs,
    recordedRefunds,
    fixtureWorkflows,
    missingEvidenceFields,
    importedOperationsCount,
  };
}

export interface FixtureAgentLogEntry {
  seq: string;
  stepLabel: string;
  lane: 'Builder' | 'Challenger';
  eventKind: string;
  level: 'INFO' | 'REVIEW' | 'NOTICE';
  message: string;
  artifactRef: string | null;
  statusNote: string;
}

/**
 * Produces a deterministic mock stream of structured fixture-agent log entries
 * derived strictly from the selected work order's fixture workflow messages.
 */
export function getFixtureAgentLogStream(wo: WorkOrder): FixtureAgentLogEntry[] {
  const entries: FixtureAgentLogEntry[] = [
    {
      seq: '00',
      stepLabel: 'Init',
      lane: 'Builder',
      eventKind: 'FixtureInit',
      level: 'INFO',
      message: `Loaded ${wo.id} (${wo.orgContext.legalEntity}) — ${
        wo.evidence.isImported ? 'Imported TESTNET.md record' : 'Sample scenario'
      }.`,
      artifactRef: wo.overview.artifactRevision,
      statusNote: 'Static fixture replay initialized',
    },
  ];

  wo.workflow.messages.forEach((msg, idx) => {
    const level: FixtureAgentLogEntry['level'] =
      msg.lane === 'Challenger'
        ? 'REVIEW'
        : msg.statusNote === 'Not supplied' || msg.statusNote.includes('fail')
        ? 'NOTICE'
        : 'INFO';

    entries.push({
      seq: String(idx + 1).padStart(2, '0'),
      stepLabel: msg.stepLabel,
      lane: msg.lane,
      eventKind: msg.type,
      level,
      message: msg.summary,
      artifactRef: msg.artifactRef,
      statusNote: msg.statusNote,
    });
  });

  entries.push({
    seq: String(entries.length).padStart(2, '0'),
    stepLabel: 'PolicyGate',
    lane: 'Challenger',
    eventKind: 'PolicyFixture',
    level: wo.policy.decision === 'ALLOW' ? 'INFO' : 'NOTICE',
    message: `Policy fixture evaluated to ${wo.policy.decision}. ${wo.policy.fixtureLabel}`,
    artifactRef: null,
    statusNote: `Settlement binding: ${wo.evidence.localRunner.settlementBinding}`,
  });

  return entries;
}
