/**
 * D4: Stale verification dies on new rev (`npm test -- stale-rev`)
 * Also covers D6 (failed verification returns job to Active, escrow preserved)
 * and REV_MISMATCH guards across submit_candidate and record_verification.
 */
const {
  MIN_DEPOSIT,
  ARTIFACT_DIGEST_1,
  ARTIFACT_DIGEST_2,
  RESULT_DIGEST_1,
  RESULT_DIGEST_2,
  initSandbox,
  parseEvents,
  defaultJobArgs,
} = require("./helpers.cjs");

jest.setTimeout(300_000);

describe("D4 stale-rev and failed-verification revision cycle", () => {
  let worker, contract, client, verifier, builder;

  beforeAll(async () => {
    ({ worker, contract, client, verifier, builder } = await initSandbox());
  });

  afterAll(async () => {
    if (worker) await worker.tearDown().catch(() => {});
  });

  it("D4 stale-rev: failed verification returns to Active, rev+1 invalidates prior verification, and stale rev is rejected", async () => {
    const jobId = "pp_d4000001";
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
    await client.call(contract, "activate", { job_id: jobId });

    // Skipping rev 1 is rejected with REV_MISMATCH
    await expect(
      builder.call(contract, "submit_candidate", {
        job_id: jobId,
        rev: 2,
        artifact_digest: ARTIFACT_DIGEST_1,
      })
    ).rejects.toThrow(/REV_MISMATCH/);

    // Submit rev 1
    await builder.call(contract, "submit_candidate", {
      job_id: jobId,
      rev: 1,
      artifact_digest: ARTIFACT_DIGEST_1,
    });

    // Verifying wrong rev is rejected with REV_MISMATCH
    await expect(
      verifier.call(contract, "record_verification", {
        job_id: jobId,
        rev: 2,
        pass: true,
        run_id: "r_00000001",
        result_digest: RESULT_DIGEST_1,
      })
    ).rejects.toThrow(/REV_MISMATCH/);

    // D6: Verifier records failing verification on rev 1 -> returns to Active
    const failVerifyTx = await verifier.callRaw(contract, "record_verification", {
      job_id: jobId,
      rev: 1,
      pass: false,
      run_id: "r_00000001",
      result_digest: RESULT_DIGEST_1,
    });
    expect(failVerifyTx.succeeded).toBe(true);
    expect(parseEvents(failVerifyTx)).toEqual([
      {
        standard: "proofpact",
        version: "1.0.0",
        event: "verification_recorded",
        job_id: jobId,
        rev: 1,
        pass: false,
        run_id: "r_00000001",
      },
    ]);

    const afterFail = await contract.view("job_state", { job_id: jobId });
    expect(afterFail.state).toBe("Active");
    expect(afterFail.rev).toBe(1);
    expect(afterFail.verification).toMatchObject({
      rev: 1,
      pass: false,
      run_id: "r_00000001",
      result_digest: RESULT_DIGEST_1,
    });

    // Cannot request payout after failed verification
    await expect(
      builder.call(contract, "request_payout", { job_id: jobId })
    ).rejects.toThrow(/BAD_STATE/);

    // Re-submitting rev 1 is rejected with REV_MISMATCH (must be rev 2)
    await expect(
      builder.call(contract, "submit_candidate", {
        job_id: jobId,
        rev: 1,
        artifact_digest: ARTIFACT_DIGEST_2,
      })
    ).rejects.toThrow(/REV_MISMATCH/);

    // Submitting rev 2 transitions to CandidateSubmitted and wipes prior verification
    const rev2View = await builder.call(contract, "submit_candidate", {
      job_id: jobId,
      rev: 2,
      artifact_digest: ARTIFACT_DIGEST_2,
    });
    expect(rev2View.state).toBe("CandidateSubmitted");
    expect(rev2View.rev).toBe(2);
    expect(rev2View.artifact_digest).toBe(ARTIFACT_DIGEST_2);
    expect(rev2View.verification).toBeNull();

    // Stale rev 1 verification call against rev 2 candidate is rejected with REV_MISMATCH
    await expect(
      verifier.call(contract, "record_verification", {
        job_id: jobId,
        rev: 1,
        pass: true,
        run_id: "r_stale001",
        result_digest: RESULT_DIGEST_2,
      })
    ).rejects.toThrow(/REV_MISMATCH/);

    // Cannot settle rev 2 before rev 2 is verified
    await expect(
      client.call(contract, "request_payout", { job_id: jobId })
    ).rejects.toThrow(/BAD_STATE/);

    // Verifier certifies rev 2 -> VerifiedPass
    const passView = await verifier.call(contract, "record_verification", {
      job_id: jobId,
      rev: 2,
      pass: true,
      run_id: "r_00000002",
      result_digest: RESULT_DIGEST_2,
    });
    expect(passView.state).toBe("VerifiedPass");
    expect(passView.verification).toMatchObject({
      rev: 2,
      pass: true,
      run_id: "r_00000002",
      result_digest: RESULT_DIGEST_2,
    });
  });
});

