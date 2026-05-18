# How to publish this as a separate public repo

This `submission/` directory is shipped *inside* the main Kinroster monorepo
for convenience during the hackathon. To meet LabLab.ai's open-source rule
without exposing the rest of the Kinroster codebase, push only this
directory to a new public repo.

## One-shot extraction

Run from the repo root:

```bash
# 1. Pick a name and create the empty repo on GitHub (web UI or gh CLI).
#    Suggested name: kinroster-lobster-trap-integration

# 2. Carve out a standalone git tree for just this directory.
git subtree split --prefix=submission HEAD -b lobster-trap-submission

# 3. Push that branch as the main branch of the new repo.
git push https://github.com/Kinroster/kinroster-lobster-trap-integration.git \
  lobster-trap-submission:main

# 4. Clean up the local subtree branch.
git branch -D lobster-trap-submission
```

The result: a new public repo whose entire content is what you see under
`submission/`, with a clean commit history, no Kinroster proprietary code,
and the MIT LICENSE file at the root where GitHub expects it.

## What to put in the LabLab.ai submission form

- **Repo URL:** `https://github.com/Kinroster/kinroster-lobster-trap-integration`
- **Demo video:** record per `docs/DEMO-SCRIPT.md`, upload to YouTube unlisted
  or Loom, paste the link.
- **Live demo URL:** `https://kinroster.com/security` (admin-only — note this
  in the submission notes so judges know to ask for a credential)
- **Description / writeup:** copy the "Hackathon submission summary" section
  from `docs/INTEGRATION.md`.
- **Track:** Security & Trust.

## Verifying before you submit

```bash
# Anyone visiting the repo should be able to run this with zero setup:
git clone https://github.com/Kinroster/kinroster-lobster-trap-integration.git
cd kinroster-lobster-trap-integration
docker compose up --build
```

…and have two working Lobster Trap sidecars on `:8080` and `:8081`. If that
works from a clean clone, the submission is in good shape.
