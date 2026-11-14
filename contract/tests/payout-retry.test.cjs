/**
 * D8: Failed payout retries safely (`npm test -- payout-retry`)
 * Simulates an async transfer failure (builder subaccount deleted after
 * submitting candidate), verifies `on_payout_complete` lands in `PayoutFailed`
 * and emits `payout_failed`, then recreates the builder account and verifies
 * `retry_payout` settles to `Paid` with exact single payout.
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

describe("D8 payout-retry on failed transfer", () => {
  let worker, root, contract, client, verifier, outsider;

  beforeAll(async () => {
    ({ worker, root, contract, client, verifier, outsider } = await initSandbox());
  });

  afterAll(async () => {
    if (worker) await worker.tearDown().catch(() => {});
  });

  it("D8 payout-retry: transitions to PayoutFailed on failed transfer, then retries safely to Paid once", async () => {
    const jobId = "pp_d8000001";
    let tempBuilder = await root.createSubAccount("retrybuilder");
    const builderId = tempBuilder.accountId;

    await client.call(
      contract,
      "fund_job",
      defaultJobArgs({
        job_id: jobId,
        verifier: verifier.accountId,
        builder: builderId,
      }),
      { attachedDeposit: MIN_DEPOSIT }
    );
    await client.call(contract, "activate", { job_id: jobId });
    await tempBuilder.call(contract, "submit_candidate", {
      job_id: jobId,
      rev: 1,
      artifact_digest: ARTIFACT_DIGEST_1,
    });
    await verifier.call(contract, "record_verification", {
      job_id: jobId,
      rev: 1,
      pass: true,
      run_id: "r_d8000001",
      result_digest: RESULT_DIGEST_1,
    });

    // Delete the builder account so the async transfer receipt fails at runtime
    await tempBuilder.delete(root.accountId);

    const failedPayoutTx = await client.callRaw(contract, "request_payout", {
      job_id: jobId,
    });
    expect(parseEvents(failedPayoutTx)).toEqual([
      {
        standard: "proofpact",
        version: "1.0.0",
        event: "payout_requested",
        job_id: jobId,
      },
      {
        standard: "proofpact",
        version: "1.0.0",
        event: "payout_failed",
        job_id: jobId,
      },
    ]);

    const failedView = await contract.view("job_state", { job_id: jobId });
    expect(failedView.state).toBe("PayoutFailed");

    // Unauthorized caller cannot retry_payout
    await expect(
      outsider.call(contract, "retry_payout", { job_id: jobId })
    ).rejects.toThrow(/NOT_AUTHORIZED/);

    // Recreate builder account at the same AccountId and retry payout
    tempBuilder = await root.createSubAccount("retrybuilder");
    const balBefore = await tempBuilder.availableBalance();

    const retryTx = await client.callRaw(contract, "retry_payout", {
      job_id: jobId,
    });
    expect(retryTx.succeeded).toBe(true);
    expect(parseEvents(retryTx)).toEqual([
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

    const balAfter = await tempBuilder.availableBalance();
    expect(balAfter - balBefore).toBe(ONE_NEAR);

    const paidView = await contract.view("job_state", { job_id: jobId });
    expect(paidView.state).toBe("Paid");

    // Second retry after Paid is rejected with DOUBLE_SETTLE
    await expect(
      client.call(contract, "retry_payout", { job_id: jobId })
    ).rejects.toThrow(/DOUBLE_SETTLE/);
  });
});

