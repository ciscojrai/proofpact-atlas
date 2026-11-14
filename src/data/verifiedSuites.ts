/**
 * Executed verification runs behind this workspace. Every entry was observed
 * passing in this project's own tooling — no projected, simulated, or planned
 * results. Reproduce with the listed command in the cited checkout.
 */
export interface VerifiedSuite {
  name: string;
  command: string;
  outcome: string;
  source: string;
  recordedAt: string;
}

export const VERIFIED_SUITES: VerifiedSuite[] = [
  {
    name: 'Contract sandbox suites (D3/D4/D5/D7/D8)',
    command:
      'npm test -- verify-auth stale-rev double-settle deadline payout-retry',
    outcome: '5 suites / 8 tests PASS · nearcore 2.14.0 sandbox · ~183s',
    source: 'proofpact 36f698d',
    recordedAt: '2026-11-13',
  },
  {
    name: 'Release matrix',
    command: 'npm run matrix',
    outcome: '8/8 PASS (E2E, guards, golden, smoke, contract, family, agents, UI)',
    source: 'proofpact main',
    recordedAt: '2026-11-13',
  },
  {
    name: 'Controller guard suite',
    command: 'node --test app/',
    outcome: '14 pass / 0 fail',
    source: 'proofpact main',
    recordedAt: '2026-11-13',
  },
  {
    name: 'Receipt canonical selftest',
    command: 'node receipts/canonical.mjs --selftest',
    outcome: 'SELFTEST OK · golden f949fea0…42fd',
    source: 'proofpact main',
    recordedAt: '2026-11-13',
  },
  {
    name: 'Family reference run (interp-1)',
    command: 'node family/run.mjs family/artifacts/reference.json family/fixtures',
    outcome: '27/27 fixtures · 6/6 arcs · exit 0',
    source: 'proofpact ab097ea',
    recordedAt: '2026-11-14T04:30:49Z',
  },
  {
    name: 'Agent fixture loop',
    command: 'node agents/fixture.mjs [--malformed]',
    outcome: '10-message OFFER→REVIEW_COMPLETE loop · 13 malformed blocked · zero network',
    source: 'proofpact 84b0196',
    recordedAt: '2026-11-13',
  },
  {
    name: 'UI console suite',
    command: 'node --test ui/test-ui.mjs',
    outcome: '6/6 PASS · headless Chrome render verified',
    source: 'proofpact main',
    recordedAt: '2026-11-13',
  },
];
