# X post drafts

Three options. Publish one, and only with a video file attached in the composer. Do not post while the video is still this script.

Each body is ASCII. The count is JavaScript `String.length` of the fenced text, including the newline between the sentence and the tags, and excluding a trailing newline. Measurement is recorded under each fence.

Every option contains `@NEARProtocol` and `#NEARHackathon`. None contains a URL. No URL is invented here.

If the filmed video drops a beat, delete the sentence that describes that beat before posting. A post that describes a frame the video does not show is not ready.

## Option A — product, local simulation

Matches the timed cut's title and the D1/D5 beat (`npm run demo:e2e`, `sim:` ref).

```text
AI agents can move money. Almost none prove the work before getting paid. ProofPact pays a bounded revision only after a recorded check. Built at NEAR HACKATHON. Video attached. Payment on screen is local simulation, not a testnet transfer.
@NEARProtocol #NEARHackathon
```

Character count: 269.

## Option B — malformed agents

Matches the D9 beat only (`node agents/fixture.mjs --malformed`). Do not attach this text to a video that skips that command.

The "13" figure is the lead's recorded result at merge `84b0196` for `agents/fixture.mjs`, which is unchanged on `main` through `d34f6d5`.

```text
Video attached. Bad model output stays blocked: 13 fixture-agent cases end blocked, with no passing review and no network call. Built at NEAR HACKATHON. Not a live model.
@NEARProtocol #NEARHackathon
```

Character count: 199.

## Option C — ProofPact Atlas + NEAR Testnet settlement

Matches the 3D Atlas console (`https://proofpact-atlas.netlify.app`) and the recorded NEAR Testnet lifecycle in `docs/TESTNET.md` (`proofpact.addychief.testnet`).

```text
AI agents can move money. Almost none prove the work before getting paid. ProofPact locks NEAR in escrow and pays only after recorded verification: 1 NEAR payout on Chicago, full refund on London, 27/27 CSV fixtures locally. Built at NEAR HACKATHON.
@NEARProtocol #NEARHackathon
```

Character count: 278.

## Held

- TODO: attach the video file in the X composer. The sentences "Video attached." are instructions for that moment, not a claim that a file exists today.
- TODO: the human publishes. This draft does not post.
- TODO: confirm the posting account's character limit. These drafts are written for the default 280-character post. If the measured count is over the account's limit, shorten the option and remeasure.
- TODO: if a URL is added later, recount. This draft's counts do not include a URL.
