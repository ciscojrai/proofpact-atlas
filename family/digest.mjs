// family/digest.mjs — canonical-JSON + sha256 hooks for the family CLI.
// Imports THE implementation (receipts/canonical.mjs, INTERFACES §0).
// The pre-integration vendored fallback was deleted at S3 merge (lead):
// receipts/ is on main, so no switch remains. digest_src is always "receipts".
import { canonicalize, sha256hex } from "../receipts/canonical.mjs";

export async function loadDigest() {
  return { canonicalize, sha256hex, src: "receipts" };
}
