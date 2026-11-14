#!/usr/bin/env bash
# Swap in a nearcore 2.14 sandbox binary (protocol 88).
#
# near-workspaces@5 bundles near-sandbox@0.1.5, which pins nearcore 2.6.2
# (protocol 77). That predates near-sdk 5.30's host ABI, so every call fails
# with PrepareError(Deserialization) — even a correct contract. The contract
# tests (and the panic-string demo) need protocol 84+.
#
# The 2.14 tarball is already on disk at ~/.near/sandbox/near-sandbox-2.14.tar.gz
# (no network needed). If the extraction directory is also present we copy from
# it directly. The S3 download is kept only as a last-resort fallback.
#
# Usage:  cd <repo-root> && ./contract/scripts/setup-sandbox.sh
set -euo pipefail

VERSION="2.14.0"
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS-$ARCH" in
  Darwin-arm64) PLAT="Darwin-arm64" ;;
  Linux-x86_64) PLAT="Linux-x86_64" ;;
  *)
    echo "Unsupported platform: $OS-$ARCH (need Darwin-arm64 or Linux-x86_64)" >&2
    exit 1
    ;;
esac

BIN="node_modules/near-sandbox/bin/near-sandbox"
TARBALL="$HOME/.near/sandbox/near-sandbox-2.14.tar.gz"
EXTRACTED="$HOME/.near/sandbox/$PLAT/near-sandbox"

if [ ! -d "node_modules/near-sandbox" ]; then
  echo "near-sandbox not found — run 'npm install' first." >&2
  exit 1
fi
mkdir -p "$(dirname "$BIN")"

CURRENT="$("$BIN" --version 2>/dev/null | head -1 || echo unknown)"
if echo "$CURRENT" | grep -q "$VERSION"; then
  echo "Already on nearcore $VERSION ($CURRENT)."
  exit 0
fi

echo "Swapping in nearcore $VERSION for $PLAT ..."
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ -f "$EXTRACTED" ]; then
  cp "$EXTRACTED" "$BIN"
elif [ -f "$TARBALL" ]; then
  tar -xzf "$TARBALL" -C "$TMP"
  cp "$(find "$TMP" -name near-sandbox -type f | head -1)" "$BIN"
else
  echo "Local 2.14 binary not found; downloading from S3 ..." >&2
  URL="https://s3-us-west-1.amazonaws.com/build.nearprotocol.com/nearcore/$PLAT/$VERSION/near-sandbox.tar.gz"
  curl -sSL "$URL" -o "$TMP/near-sandbox.tar.gz"
  tar -xzf "$TMP/near-sandbox.tar.gz" -C "$TMP"
  cp "$(find "$TMP" -name near-sandbox -type f | head -1)" "$BIN"
fi

chmod +x "$BIN"
echo "Sandbox now: $("$BIN" --version | head -1)"
