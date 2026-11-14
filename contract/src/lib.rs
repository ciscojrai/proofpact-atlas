//! ProofPact Escrow — implements INTERFACES §1 exactly.
//!
//! Trust model, in one line: the client funds, the builder submits, the
//! verifier certifies, and the contract pays only on verified acceptance.
//! The verifier never holds a key and no model output ever moves money on
//! its own — every transition is gated by predecessor identity and state.
//!
//! Conventions kept from the proven escrow baseline: `LookupMap` storage,
//! NEP-297 events, client/verifier/builder role separation, UPPER_SNAKE
//! panic strings the UI shows verbatim, and a `--cfg near` build so panic
//! strings survive (see the root package.json `build:contract` script).

use borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupMap;
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, require, AccountId, NearToken, Promise};

pub type JobId = String;

/// All amounts are integer yoctoNEAR (`u128`). We convert to/from `NearToken`
/// only at the SDK boundary (`attached_deposit`, `Promise::transfer`).
pub type Balance = u128;

/// Minimum gas reserve the deposit must exceed the payout by. Kept so the
/// contract can always cover the transfer gas of a payout without the
/// final payment failing. 0.01 NEAR is comfortably above a transfer+callback.
pub const RESERVE_YOCTO: Balance = 10_000_000_000_000_000_000_000;

// ---------------------------------------------------------------------------
// State (frozen by INTERFACES §1)
// ---------------------------------------------------------------------------

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub enum JobState {
    Funded,
    Active,
    CandidateSubmitted,
    VerifiedPass,
    PayoutPending,
    Paid,
    PayoutFailed,
    RefundPending,
    Refunded,
    Cancelled,
}

/// The verifier's recorded verdict for a candidate revision.
#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct Verification {
    pub rev: u32,
    pub pass: bool,
    pub run_id: String,
    pub result_digest: String,
    pub recorded_at: u64,
}

/// On-chain job record. `deposited` is the full escrow this job holds
/// (>= `payout` + reserve); refunds/cancels return it, payouts send `payout`.
#[derive(BorshSerialize, BorshDeserialize)]
pub struct Job {
    pub job_id: JobId,
    pub title: String,
    pub spec_digest: String,
    pub policy_digest: String,
    pub client: AccountId,
    pub verifier: AccountId,
    pub builder: AccountId,
    pub payout: Balance,
    pub deposited: Balance,
    pub submit_by_ms: u64,
    pub verify_by_ms: u64,
    pub state: JobState,
    pub rev: u32,
    pub artifact_digest: Option<String>,
    pub verification: Option<Verification>,
}

// ---------------------------------------------------------------------------
// View shapes returned to the server and the UI
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct VerificationView {
    pub rev: u32,
    pub pass: bool,
    pub run_id: String,
    pub result_digest: String,
    pub recorded_at: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct JobView {
    pub job_id: JobId,
    pub title: String,
    pub spec_digest: String,
    pub policy_digest: String,
    pub client: AccountId,
    pub verifier: AccountId,
    pub builder: AccountId,
    pub payout: U128,
    pub submit_by_ms: u64,
    pub verify_by_ms: u64,
    pub state: JobState,
    pub rev: u32,
    pub artifact_digest: Option<String>,
    pub verification: Option<VerificationView>,
}

#[near(contract_state)]
pub struct Contract {
    jobs: LookupMap<JobId, Job>,
}

impl Default for Contract {
    fn default() -> Self {
        Self {
            jobs: LookupMap::new(b"j"),
        }
    }
}

/// NEP-297 style event. `standard`/`version` are frozen by INTERFACES §1;
/// literal braces are doubled for `format!`.
fn log_event(event: &str, job_id: &str, extra: &str) {
    env::log_str(&format!(
        "EVENT_JSON:{{\"standard\":\"proofpact\",\"version\":\"1.0.0\",\"event\":\"{}\",\"job_id\":\"{}\"{}}}",
        event, job_id, extra
    ));
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self::default()
    }

    /// Client funds a job. The attached deposit becomes the job's escrow and
    /// must cover `payout` plus the gas reserve. `Funded`.
    #[payable]
    pub fn fund_job(
        &mut self,
        job_id: String,
        title: String,
        spec_digest: String,
        policy_digest: String,
        verifier: AccountId,
        builder: AccountId,
        payout: U128,
        submit_by_ms: u64,
        verify_by_ms: u64,
    ) -> JobView {
        require!(!self.jobs.contains_key(&job_id), "JOB_ID_TAKEN");
        require!(is_sha256_hex(&spec_digest), "DIGEST_MUST_BE_SHA256_HEX");
        require!(is_sha256_hex(&policy_digest), "DIGEST_MUST_BE_SHA256_HEX");

        let payout_amt = payout.0;
        require!(payout_amt > 0, "PAYOUT_MUST_BE_POSITIVE");

        let deposit: Balance = env::attached_deposit().as_yoctonear();
        require!(deposit >= payout_amt + RESERVE_YOCTO, "DEPOSIT_TOO_SMALL");

        let job = Job {
            job_id: job_id.clone(),
            title,
            spec_digest,
            policy_digest,
            client: env::predecessor_account_id(),
            verifier,
            builder,
            payout: payout_amt,
            deposited: deposit,
            submit_by_ms,
            verify_by_ms,
            state: JobState::Funded,
            rev: 0,
            artifact_digest: None,
            verification: None,
        };
        self.jobs.insert(&job_id, &job);
        log_event(
            "job_funded",
            &job_id,
            &format!(
                ",\"client\":\"{}\",\"verifier\":\"{}\",\"builder\":\"{}\",\"payout\":\"{}\"",
                job.client, job.verifier, job.builder, job.payout
            ),
        );
        self.job_state(job_id)
    }

    /// Client moves `Funded -> Active`, opening the job for submissions.
    pub fn activate(&mut self, job_id: String) -> JobView {
        let mut job = self.get_job(&job_id);
        require!(env::predecessor_account_id() == job.client, "NOT_CLIENT");
        require!(job.state == JobState::Funded, "BAD_STATE");
        job.state = JobState::Active;
        self.jobs.insert(&job_id, &job);
        log_event("job_activated", &job_id, "");
        self.job_state(job_id)
    }

    /// Builder submits a candidate. Only the next revision is accepted and any
    /// prior verification is invalidated the moment a new revision lands.
    pub fn submit_candidate(
        &mut self,
        job_id: String,
        rev: u32,
        artifact_digest: String,
    ) -> JobView {
        let mut job = self.get_job(&job_id);
        require!(env::predecessor_account_id() == job.builder, "NOT_BUILDER");
        require!(job.state == JobState::Active, "BAD_STATE");
        require!(rev == job.rev + 1, "REV_MISMATCH");
        require!(env::block_timestamp_ms() < job.submit_by_ms, "DEADLINE_PASSED");
        require!(is_sha256_hex(&artifact_digest), "DIGEST_MUST_BE_SHA256_HEX");

        job.rev = rev;
        job.artifact_digest = Some(artifact_digest.clone());
        job.verification = None; // invalidate any prior verification
        job.state = JobState::CandidateSubmitted;
        self.jobs.insert(&job_id, &job);
        log_event(
            "candidate_submitted",
            &job_id,
            &format!(",\"rev\":{},\"digest\":\"{}\"", rev, artifact_digest),
        );
        self.job_state(job_id)
    }

    /// Verifier certifies the current candidate. Pass advances to
    /// `VerifiedPass`; fail returns the job to `Active` (rev+1 required).
    pub fn record_verification(
        &mut self,
        job_id: String,
        rev: u32,
        pass: bool,
        run_id: String,
        result_digest: String,
    ) -> JobView {
        let mut job = self.get_job(&job_id);
        require!(env::predecessor_account_id() == job.verifier, "NOT_VERIFIER");
        require!(job.state == JobState::CandidateSubmitted, "BAD_STATE");
        require!(rev == job.rev, "REV_MISMATCH");
        require!(is_sha256_hex(&result_digest), "DIGEST_MUST_BE_SHA256_HEX");

        job.verification = Some(Verification {
            rev,
            pass,
            run_id: run_id.clone(),
            result_digest: result_digest.clone(),
            recorded_at: env::block_timestamp_ms(),
        });
        job.state = if pass {
            JobState::VerifiedPass
        } else {
            JobState::Active
        };
        self.jobs.insert(&job_id, &job);
        log_event(
            "verification_recorded",
            &job_id,
            &format!(",\"rev\":{},\"pass\":{},\"run_id\":\"{}\"", rev, pass, run_id),
        );
        self.job_state(job_id)
    }

    /// Client or builder requests payout after a passing verification, before
    /// the verify deadline. Schedules the transfer plus a private callback.
    pub fn request_payout(&mut self, job_id: String) -> Promise {
        let mut job = self.get_job(&job_id);
        let caller = env::predecessor_account_id();
        require!(caller == job.client || caller == job.builder, "NOT_AUTHORIZED");
        require!(
            job.state != JobState::Paid && job.state != JobState::Refunded,
            "DOUBLE_SETTLE"
        );
        require!(job.state == JobState::VerifiedPass, "BAD_STATE");
        let v = job
            .verification
            .as_ref()
            .unwrap_or_else(|| env::panic_str("NO_VERIFICATION"));
        require!(v.rev == job.rev, "REV_MISMATCH");
        require!(env::block_timestamp_ms() < job.verify_by_ms, "DEADLINE_PASSED");

        job.state = JobState::PayoutPending;
        self.jobs.insert(&job_id, &job);
        log_event("payout_requested", &job_id, "");

        Promise::new(job.builder.clone())
            .transfer(NearToken::from_yoctonear(job.payout))
            .then(Self::ext(env::current_account_id()).on_payout_complete(job_id))
    }

    /// Private callback for the payout transfer. Success settles to `Paid`;
    /// any failure settles to `PayoutFailed` (retryable via `retry_payout`).
    #[private]
    pub fn on_payout_complete(&mut self, job_id: String) {
        let mut job = self.get_job(&job_id);
        require!(job.state == JobState::PayoutPending, "BAD_STATE");
        match env::promise_result_checked(0, usize::MAX) {
            Ok(_) => {
                job.state = JobState::Paid;
                self.jobs.insert(&job_id, &job);
                log_event("payout_confirmed", &job_id, "");
            }
            Err(_) => {
                job.state = JobState::PayoutFailed;
                self.jobs.insert(&job_id, &job);
                log_event("payout_failed", &job_id, "");
            }
        }
    }

    /// Retry a payout whose transfer failed, under the same authorization,
    /// revision and deadline guards as `request_payout`.
    pub fn retry_payout(&mut self, job_id: String) -> Promise {
        let mut job = self.get_job(&job_id);
        let caller = env::predecessor_account_id();
        require!(caller == job.client || caller == job.builder, "NOT_AUTHORIZED");
        require!(
            job.state != JobState::Paid && job.state != JobState::Refunded,
            "DOUBLE_SETTLE"
        );
        require!(job.state == JobState::PayoutFailed, "BAD_STATE");
        let v = job
            .verification
            .as_ref()
            .unwrap_or_else(|| env::panic_str("NO_VERIFICATION"));
        require!(v.rev == job.rev, "REV_MISMATCH");
        require!(env::block_timestamp_ms() < job.verify_by_ms, "DEADLINE_PASSED");

        job.state = JobState::PayoutPending;
        self.jobs.insert(&job_id, &job);
        log_event("payout_requested", &job_id, "");

        Promise::new(job.builder.clone())
            .transfer(NearToken::from_yoctonear(job.payout))
            .then(Self::ext(env::current_account_id()).on_payout_complete(job_id))
    }

    /// Client claims a refund once the verify deadline has passed and the job
    /// is not paid. `RefundPending` then a private callback settles `Refunded`.
    pub fn claim_refund(&mut self, job_id: String) -> Promise {
        let mut job = self.get_job(&job_id);
        require!(env::predecessor_account_id() == job.client, "NOT_CLIENT");
        require!(
            job.state != JobState::Paid && job.state != JobState::Refunded,
            "DOUBLE_SETTLE"
        );
        require!(
            env::block_timestamp_ms() >= job.verify_by_ms,
            "DEADLINE_NOT_PASSED"
        );
        // Never race an in-flight payout or refund; the job must be quiescent to refund.
        require!(
            job.state != JobState::PayoutPending
                && job.state != JobState::RefundPending
                && job.state != JobState::Cancelled,
            "BAD_STATE"
        );

        job.state = JobState::RefundPending;
        self.jobs.insert(&job_id, &job);
        log_event("refund_claimed", &job_id, "");

        let refund = job.deposited;
        Promise::new(job.client.clone())
            .transfer(NearToken::from_yoctonear(refund))
            .then(Self::ext(env::current_account_id()).on_refund_complete(job_id))
    }

    /// Private callback for the refund transfer. Success settles `Refunded`.
    /// On failure the job stays `RefundPending` so the client can re-claim.
    #[private]
    pub fn on_refund_complete(&mut self, job_id: String) {
        let mut job = self.get_job(&job_id);
        require!(job.state == JobState::RefundPending, "BAD_STATE");
        if env::promise_result_checked(0, usize::MAX).is_ok() {
            job.state = JobState::Refunded;
            self.jobs.insert(&job_id, &job);
            log_event("refund_confirmed", &job_id, "");
        }
        // Failure: remain RefundPending (retryable); no frozen "refund_failed"
        // event exists, so nothing is emitted.
    }

    /// Client cancels before payment, refunding the full escrow and closing
    /// the job. Direct transfer (no callback), matching the baseline pattern.
    pub fn cancel_job(&mut self, job_id: String) -> Promise {
        let mut job = self.get_job(&job_id);
        require!(env::predecessor_account_id() == job.client, "NOT_CLIENT");
        require!(
            job.state != JobState::Paid && job.state != JobState::Refunded,
            "DOUBLE_SETTLE"
        );
        require!(
            job.state != JobState::PayoutPending
                && job.state != JobState::RefundPending
                && job.state != JobState::Cancelled,
            "BAD_STATE"
        );

        job.state = JobState::Cancelled;
        self.jobs.insert(&job_id, &job);
        log_event("job_cancelled", &job_id, "");

        Promise::new(job.client.clone()).transfer(NearToken::from_yoctonear(job.deposited))
    }

    /// Read-only view: full job state (rev, digests, deadlines, state,
    /// verification record or null).
    pub fn job_state(&self, job_id: String) -> JobView {
        let job = self.get_job(&job_id);
        JobView {
            job_id: job.job_id,
            title: job.title,
            spec_digest: job.spec_digest,
            policy_digest: job.policy_digest,
            client: job.client,
            verifier: job.verifier,
            builder: job.builder,
            payout: U128(job.payout),
            submit_by_ms: job.submit_by_ms,
            verify_by_ms: job.verify_by_ms,
            state: job.state,
            rev: job.rev,
            artifact_digest: job.artifact_digest,
            verification: job.verification.map(|v| VerificationView {
                rev: v.rev,
                pass: v.pass,
                run_id: v.run_id,
                result_digest: v.result_digest,
                recorded_at: v.recorded_at,
            }),
        }
    }

    // ---- internal helper (not exposed) ----

    fn get_job(&self, job_id: &JobId) -> Job {
        self.jobs
            .get(job_id)
            .unwrap_or_else(|| env::panic_str("JOB_NOT_FOUND"))
    }
}

/// Returns true if `s` is exactly 64 lowercase hex characters (a sha256 digest
/// as the server computes it).
fn is_sha256_hex(s: &str) -> bool {
    s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
}
