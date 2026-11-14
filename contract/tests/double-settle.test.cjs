/**
 * D5: No double pay/refund (`npm test -- double-settle`)
 * Also covers D1 (funded lifecycle pays once) and D2 (premature settlement rejected).
 */
const {
  ONE_NEAR,
  MIN_DEPOSIT,
  ARTIFACT_DIGEST_1,
  RESULT_DIGEST_1,
  initSandbox,
  parseEvents,
  defaultJobArgs,
} = require("./helpers.cjs");

jest.setTimeout(300_000);

describe("D1/D2/D5 lifecycle settlement and double-settle prevention", () => {
  let worker, contract, client, verifier, builder, outsider;

  beforeAll(async () => {
    ({ worker, contract, client, verifier, builder, outsider } = await initSandbox());
  });

  afterAll(async () => {
    if (worker) await worker.tearDown().catch(() => {});
  });

  it("D1/D2/D5 double-settle: rejects premature settle, pays once on VerifiedPass, and rejects all second settle/refund/cancel calls with DOUBLE_SETTLE", async () => {
    const jobId = "pp_d5000001";
    await client.call(
      contract,
      "fund_job",
      defaultJobArgs({
        job_id: jobId,
        verifier: verifier.accountId,
        builder: builder.accountId,
      }),
      { attachedDeposit: MIN_DEPOSIT }
    );

    // D2: Premature settlement rejected in Funded state
    await expect(
      client.call(contract, "request_payout", { job_id: jobId })
    ).rejects.toThrow(/BAD_STATE/);

    await client.call(contract, "activate", { job_id: jobId });

    // D2: Premature settlement rejected in Active state
    await expect(
      builder.call(contract, "request_payout", { job_id: jobId })
    ).rejects.toThrow(/BAD_STATE/);

    await builder.call(contract, "submit_candidate", {
      job_id: jobId,
      rev: 1,
      artifact_digest: ARTIFACT_DIGEST_1,
    });

    // D2: Premature settlement rejected in CandidateSubmitted state
    await expect(
      client.call(contract, "request_payout", { job_id: jobId })
    ).rejects.toThrow(/BAD_STATE/);

    await verifier.call(contract, "record_verification", {
      job_id: jobId,
      rev: 1,
      pass: true,
      run_id: "r_d5000001",
      result_digest: RESULT_DIGEST_1,
    });

    // Unauthorized caller (neither client nor builder) rejected with NOT_AUTHORIZED
    await expect(
      outsider.call(contract, "request_payout", { job_id: jobId })
    ).rejects.toThrow(/NOT_AUTHORIZED/);
    await expect(
      verifier.call(contract, "request_payout", { job_id: jobId })
    ).rejects.toThrow(/NOT_AUTHORIZED/);

    // D1: Client (or builder) requests payout -> Paid exactly once
    const builderBefore = await builder.availableBalance();
    const payoutTx = await client.callRaw(contract, "request_payout", {
      job_id: jobId,
    });
    expect(payoutTx.succeeded).toBe(true);
    const events = parseEvents(payoutTx);
    expect(events).toEqual([
      {
        standard: "proofpact",
        version: "1.0.0",
        event: "payout_requested",
        job_id: jobId,
      },
      {
        standard: "proofpact",
        version: "1.0.0",
        event: "payout_confirmed",
        job_id: jobId,
      },
    ]);

    const builderAfterFirst = await builder.availableBalance();
    expect(builderAfterFirst - builderBefore).toBe(ONE_NEAR);

    const paidView = await contract.view("job_state", { job_id: jobId });
    expect(paidView.state).toBe("Paid");

    // D5: Second payout, retry, refund, and cancel are all rejected with DOUBLE_SETTLE
    await expect(
      client.call(contract, "request_payout", { job_id: jobId })
    ).rejects.toThrow(/DOUBLE_SETTLE/);
    await expect(
      client.call(contract, "retry_payout", { job_id: jobId })
    ).rejects.toThrow(/DOUBLE_SETTLE/);
    await expect(
      client.call(contract, "claim_refund", { job_id: jobId })
    ).rejects.toThrow(/DOUBLE_SETTLE/);
    await expect(
      client.call(contract, "cancel_job", { job_id: jobId })
    ).rejects.toThrow(/DOUBLE_SETTLE/);

    // Builder balance remains exact (paid once, zero extra yoctoNEAR transferred)
    const builderAfterClientAttempts = await builder.availableBalance();
    expect(builderAfterClientAttempts).toBe(builderAfterFirst);

    // Builder attempting a second payout is also rejected with DOUBLE_SETTLE
    await expect(
      builder.call(contract, "request_payout", { job_id: jobId })
    ).rejects.toThrow(/DOUBLE_SETTLE/);
    expect(await builder.availableBalance()).toBeLessThanOrEqual(builderAfterFirst);
  });
});

