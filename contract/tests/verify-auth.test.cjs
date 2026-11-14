/**
 * D3: Unauthorized verifier rejected (`npm test -- verify-auth`)
 * Plus role separation (NOT_CLIENT, NOT_BUILDER, NOT_VERIFIER), input guards,
 * private callback guards, and client cancel flow (`job_cancelled`).
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

describe("D3 verify-auth and role/input guards", () => {
  let worker, contract, client, verifier, builder, outsider;

  beforeAll(async () => {
    ({ worker, contract, client, verifier, builder, outsider } = await initSandbox());
  });

  afterAll(async () => {
    if (worker) await worker.tearDown().catch(() => {});
  });

  it("enforces fund_job input guards and JOB_NOT_FOUND", async () => {
    await expect(
      contract.view("job_state", { job_id: "pp_deadbeef" })
    ).rejects.toThrow(/JOB_NOT_FOUND/);

    // Zero payout rejected
    await expect(
      client.call(
        contract,
        "fund_job",
        defaultJobArgs({
          job_id: "pp_badpay00",
          verifier: verifier.accountId,
          builder: builder.accountId,
          payout: "0",
        }),
        { attachedDeposit: MIN_DEPOSIT }
      )
    ).rejects.toThrow(/PAYOUT_MUST_BE_POSITIVE/);

    // Deposit < payout + RESERVE_YOCTO rejected
    await expect(
      client.call(
        contract,
        "fund_job",
        defaultJobArgs({
          job_id: "pp_lowdep00",
          verifier: verifier.accountId,
          builder: builder.accountId,
        }),
        { attachedDeposit: ONE_NEAR } // missing reserve
      )
    ).rejects.toThrow(/DEPOSIT_TOO_SMALL/);

    // Non-sha256 digest rejected
    await expect(
      client.call(
        contract,
        "fund_job",
        defaultJobArgs({
          job_id: "pp_badhex00",
          spec_digest: "NOT_64_LOWERCASE_HEX",
          verifier: verifier.accountId,
          builder: builder.accountId,
        }),
        { attachedDeposit: MIN_DEPOSIT }
      )
    ).rejects.toThrow(/DIGEST_MUST_BE_SHA256_HEX/);
  });

  it("D3 verify-auth: rejects unauthorized verifier with NOT_VERIFIER and leaves state unchanged", async () => {
    const jobId = "pp_d3000001";
    const fundTx = await client.callRaw(
      contract,
      "fund_job",
      defaultJobArgs({
        job_id: jobId,
        verifier: verifier.accountId,
        builder: builder.accountId,
      }),
      { attachedDeposit: MIN_DEPOSIT }
    );
    expect(fundTx.succeeded).toBe(true);
    expect(parseEvents(fundTx)).toEqual([
      expect.objectContaining({
        standard: "proofpact",
        version: "1.0.0",
        event: "job_funded",
        job_id: jobId,
      }),
    ]);

    // Duplicate job_id rejected
    await expect(
      client.call(
        contract,
        "fund_job",
        defaultJobArgs({
          job_id: jobId,
          verifier: verifier.accountId,
          builder: builder.accountId,
        }),
        { attachedDeposit: MIN_DEPOSIT }
      )
    ).rejects.toThrow(/JOB_ID_TAKEN/);

    // Non-client cannot activate
    await expect(
      builder.call(contract, "activate", { job_id: jobId })
    ).rejects.toThrow(/NOT_CLIENT/);

    const actTx = await client.callRaw(contract, "activate", { job_id: jobId });
    expect(actTx.succeeded).toBe(true);
    expect(parseEvents(actTx)).toEqual([
      {
        standard: "proofpact",
        version: "1.0.0",
        event: "job_activated",
        job_id: jobId,
      },
    ]);

    // Non-builder cannot submit candidate
    await expect(
      client.call(contract, "submit_candidate", {
        job_id: jobId,
        rev: 1,
        artifact_digest: ARTIFACT_DIGEST_1,
      })
    ).rejects.toThrow(/NOT_BUILDER/);

    const subTx = await builder.callRaw(contract, "submit_candidate", {
      job_id: jobId,
      rev: 1,
      artifact_digest: ARTIFACT_DIGEST_1,
    });
    expect(subTx.succeeded).toBe(true);
    expect(parseEvents(subTx)).toEqual([
      {
        standard: "proofpact",
        version: "1.0.0",
        event: "candidate_submitted",
        job_id: jobId,
        rev: 1,
        digest: ARTIFACT_DIGEST_1,
      },
    ]);

    // D3: Outsider, client, and builder are all rejected from record_verification with NOT_VERIFIER
    for (const caller of [outsider, client, builder]) {
      await expect(
        caller.call(contract, "record_verification", {
          job_id: jobId,
          rev: 1,
          pass: true,
          run_id: "r_bad00001",
          result_digest: RESULT_DIGEST_1,
        })
      ).rejects.toThrow(/NOT_VERIFIER/);
    }

    // State must remain CandidateSubmitted with verification === null
    const stateAfter = await contract.view("job_state", { job_id: jobId });
    expect(stateAfter.state).toBe("CandidateSubmitted");
    expect(stateAfter.rev).toBe(1);
    expect(stateAfter.verification).toBeNull();

    // Private callbacks cannot be invoked by external accounts
    await expect(
      outsider.call(contract, "on_payout_complete", { job_id: jobId })
    ).rejects.toThrow(/private/i);
    await expect(
      outsider.call(contract, "on_refund_complete", { job_id: jobId })
    ).rejects.toThrow(/private/i);
  });

  it("supports client cancel_job before Paid and emits job_cancelled", async () => {
    const jobId = "pp_cancel01";
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

    await expect(
      builder.call(contract, "cancel_job", { job_id: jobId })
    ).rejects.toThrow(/NOT_CLIENT/);

    const beforeBal = await client.availableBalance();
    const cancelTx = await client.callRaw(contract, "cancel_job", { job_id: jobId });
    expect(cancelTx.succeeded).toBe(true);
    expect(parseEvents(cancelTx)).toEqual([
      {
        standard: "proofpact",
        version: "1.0.0",
        event: "job_cancelled",
        job_id: jobId,
      },
    ]);

    const afterBal = await client.availableBalance();
    expect(afterBal).toBeGreaterThan(beforeBal);

    const view = await contract.view("job_state", { job_id: jobId });
    expect(view.state).toBe("Cancelled");

    // Second cancel rejected with BAD_STATE
    await expect(
      client.call(contract, "cancel_job", { job_id: jobId })
    ).rejects.toThrow(/BAD_STATE/);
  });
});

