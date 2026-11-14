# ProofPact worktree protocol (mandatory, all harnesses)

One worktree per stream. Never work in another stream's checkout, never
`git checkout` a branch that another harness owns. A checkout war deletes
nobody's committed work but silently unplugs untracked files from under
running builds — we hit this on day one (lead + family sharing one tree).

Setup (each harness, once):

```bash
cd /Users/ciscomacbook/Projects/proofpact
git fetch origin 2>/dev/null || true
git worktree add /Users/ciscomacbook/Projects/proofpact-<stream> stream/<stream>
cd /Users/ciscomacbook/Projects/proofpact-<stream>
git merge --ff-only main   # pick up the frozen foundation
```

Rules:

- `<stream>` is one of: contract, controller, family, agents, ui, receipts.
- The `proofpact` directory itself is whichever stream got there first — treat
  its branch as foreign. Do your work in your own `proofpact-<stream>` tree.
- Commit only on your `stream/<stream>` branch. Never commit to `main`
  directly; the lead merges after your done-when commands pass.
- `git worktree list` shows who lives where. Never `git worktree remove`
  someone else's tree, never `--force` anything.
- Merges to `main` happen in the lead tree only.
