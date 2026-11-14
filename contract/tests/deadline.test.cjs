/**
 * D7: Deadline refund, no race (`npm test -- deadline`)
 * Verifies strict `now < D` rule for submit_candidate and request_payout
 * (`DEADLINE_PASSED`), `DEADLINE_NOT_PASSED` before verify_by_ms,
 * full refund after expiry (`refund_claimed` + `refund_confirmed`),
 * and impossibility of both Paid and Refunded (`DOUBLE_SETTLE`).
 */
const {
  MIN_DEPOSIT,
  ARTIFACT_DIGEST_1,
  RESULT_DIGEST_1,
  initSandbox,
  parseEvents,
  defaultJobArgs,
} = require("./helpers.cjs");

jest.setTimeout(300_000);

describe("D7 deadline guards and refund without race", () => {
  let worker, contract, client, verifier, builder;

  beforeAll(async () => {
    ({ worker, contract, client, verifier, builder } = await initSandbox());
  });

  afterAll(async () => {
    if (worker) await worker.tearDown().catch(() => {});
  });

  it("rejects submit_candidate once submit_by_ms has passed with DEADLINE_PASSED", async () => {
    const jobId = "pp_d7subexp";
    const now = Date.now();
    await client.call(
      contract,
      "fund_job",
      defaultJobArgs({
        job_id: jobId,
        verifier: verifier.accountId,
        builder: builder.accountId,
        submit_by_ms: now - 1_000,
        verify_by_ms: now + 600_000,
      }),
      { attachedDeposit: MIN_DEPOSIT }
    );
    await client.call(contract, "activate", { job_id: jobId });

    await expect(
      builder.call(contract, "submit_candidate", {
        job_id: jobId,
        rev: 1,
        artifact_digest: ARTIFACT_DIGEST_1,
      })
    ).rejects.toThrow(/DEADLINE_PASSED/);
  });

  it("D7 deadline: blocks premature refund with DEADLINE_NOT_PASSED, blocks expired payout with DEADLINE_PASSED, refunds after expiry, and blocks pay+refund", async () => {
    const jobId = "pp_d7000001";
    const now = Date.now();
    // Give 5s window to submit + verify, then let verify_by_ms expire
    const verifyByMs = now + 5_000;

    await client.call(
      contract,
      "fund_job",
      defaultJobArgs({
        job_id: jobId,
        verifier: verifier.accountId,
        builder: builder.accountId,
        submit_by_ms: now + 600_000,
        verify_by_ms: verifyByMs,
      }),
      { attachedDeposit: MIN_DEPOSIT }
    );

    // Non-client cannot claim refund
    await expect(
      builder.call(contract, "claim_refund", { job_id: jobId })
    ).rejects.toThrow(/NOT_CLIENT/);

    // Before verify_by_ms, claim_refund is rejected with DEADLINE_NOT_PASSED
    await expect(
      client.call(contract, "claim_refund", { job_id: jobId })
    ).rejects.toThrow(/DEADLINE_NOT_PASSED/);

    await client.call(contract, "activate", { job_id: jobId });
    await builder.call(contract, "submit_candidate", {
      job_id: jobId,
      rev: 1,
      artifact_digest: ARTIFACT_DIGEST_1,
    });
    await verifier.call(contract, "record_verification", {
      job_id: jobId,
      rev: 1,
      pass: true,
      run_id: "r_d7000001",
      result_digest: RESULT_DIGEST_1,
    });

    // Wait until verify_by_ms has strictly passed on sandbox clock
    const waitMs = Math.max(0, verifyByMs - Date.now() + 1_500);
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
    }

    // Even in VerifiedPass, request_payout after verify_by_ms is rejected with DEADLINE_PASSED
    const builderBefore = await builder.availableBalance();
    await expect(
      client.call(contract, "request_payout", { job_id: jobId })
    ).rejects.toThrow(/DEADLINE_PASSED/);
    expect(await builder.availableBalance()).toBe(builderBefore);
    await expect(
      builder.call(contract, "request_payout", { job_id: jobId })
    ).rejects.toThrow(/DEADLINE_PASSED/);
    expect(await builder.availableBalance()).toBeLessThanOrEqual(builderBefore);

    // Client claims refund after verify_by_ms -> RefundPending -> Refunded
    const clientBefore = await client.availableBalance();
    const refundTx = await client.callRaw(contract, "claim_refund", {
      job_id: jobId,
    });
    expect(refundTx.succeeded).toBe(true);
    expect(parseEvents(refundTx)).toEqual([
      {
        standard: "proofpact",
        version: "1.0.0",
        event: "refund_claimed",
        job_id: jobId,
      },
      {
        standard: "proofpact",
        version: "1.0.0",
        event: "refund_confirmed",
        job_id: jobId,
      },
    ]);

    const clientAfter = await client.availableBalance();
    expect(clientAfter).toBeGreaterThan(clientBefore);

    const refundedView = await contract.view("job_state", { job_id: jobId });
    expect(refundedView.state).toBe("Refunded");

    // Never both Paid and Refunded: subsequent payout, refund, or cancel fails with DOUBLE_SETTLE
    await expect(
      client.call(contract, "request_payout", { job_id: jobId })
    ).rejects.toThrow(/DOUBLE_SETTLE/);
    await expect(
      client.call(contract, "claim_refund", { job_id: jobId })
    ).rejects.toThrow(/DOUBLE_SETTLE/);
    await expect(
      client.call(contract, "cancel_job", { job_id: jobId })
    ).rejects.toThrow(/DOUBLE_SETTLE/);
  });
});

