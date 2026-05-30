# Docker Process Hardening

Tracks the four hardening gaps identified in the Docker build/push/deploy
pipeline, their implementation status, and deferred doc updates.

---

## Gaps being closed

| # | Gap | Risk register | PR |
|---|---|---|---|
| 1 | Built image never scanned for CVEs | Appendix B + CICD-R02 | PR 1 |
| 2 | nginx Stage 2 runs as root | CIS Docker 4.1 | PR 1 |
| 3 | `make deploy` not gated on CI status | CICD-R01 | PR 2 |
| 4 | Deploy references mutable tag; no audit trail | CICD-R02 + CICD-R03 | PR 2 |

---

## PR 1 — Dockerfile + CI image scan

**Status: complete and validated (2026-05-30)**

### Code changes

**`dashboard/Dockerfile`**
- Base image upgraded from `nginx:1.27-alpine` to `nginx:1.30-alpine`
  (`sha256:5f979dcfed4c...`) — 1.27 had 9 unfixed HIGH CVEs (musl, nghttp2,
  libxml2, zlib) with no rebuilt image available on Docker Hub; 1.30.2 ships
  the patched Alpine packages and passes the Trivy gate.
- Combined `chmod`, `chown`, PID file setup, and `user` directive removal into
  one `RUN` layer; added `USER nginx` before `CMD`.
- `chown -R nginx:nginx /etc/nginx/conf.d` — recursive because `nginx:alpine`
  ships with a root-owned `default.conf`; the nginx user needs to overwrite it
  at startup. Non-recursive chown on the directory alone is not sufficient.
- `chown -R nginx:nginx /var/cache/nginx` — nginx creates temp directories here
  at startup; root-owned by default in the base image.
- `touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid` — nginx
  writes its PID here; pre-creating it ensures the nginx user owns the file.
- `sed -i '/^user /d' /etc/nginx/nginx.conf` — removes the `user nginx;`
  directive from the base image's main nginx.conf, which is only meaningful
  when the master runs as root and causes a warning otherwise.

**`.github/workflows/docker-build.yml`**
- Added `security-events: write` to `build` job permissions (required for
  SARIF upload).
- Added `load: true` + `tags: prowler-dashboard:scan` to `Build image` step
  so the image is available in the local Docker daemon for Trivy to scan.
- Added `Scan image with Trivy` step: `scan-type: image`, `severity:
  CRITICAL,HIGH`, `ignore-unfixed: true`, `exit-code: '1'`. Reuses the same
  `aquasecurity/trivy-action` SHA already pinned in `trivy.yml`.
- Added `Upload image scan results to GitHub Security tab` step with
  `if: !cancelled()` so SARIF is uploaded even when the scan step fails.

### Verification
- [x] CI run `26695504972` — Build image ✓, Scan image with Trivy ✓,
  Upload image scan results ✓ — passed in 51s.
- [x] `docker run --rm prowler-dashboard:test id` → `uid=101(nginx)`.
- [x] `docker run --rm -e CF_ACCESS_SECRET=test prowler-dashboard:test` →
  nginx 1.30.2 starts cleanly, no warnings, no permission errors.
- [x] `make deploy` succeeded — revision `prowler-cspm-dashboard-00054-nbd`
  live on Cloud Run with nginx 1.30 image.

### Doc updates (deferred — do after PR 2 validated)
- `docs/threat-model.md` Appendix B: replace "container image is not scanned"
  row with implemented state.
- `docs/security.md` Docker Build row: update description to include CVE
  scanning and SARIF upload.
- `docs/owasp-cicd.md`: add Trivy image scan to CICD-R02 compensating
  controls; add RL-06 change log entry.

---

## PR 2 — `make deploy` hardening

**Status: complete and validated (2026-05-30)**

### Code changes

**`Makefile` — `deploy` target**

Three additions. Changes (ii) and (iii) share a single `&&`-chained recipe
line so the `DIGEST` variable is available to both.

**(i) CI status gate — before `docker build` (CICD-R01)**
```makefile
@echo "=== Checking CI status ===" && \
CONCLUSION=$$(gh run list --branch main --limit 1 \
    --json conclusion --jq '.[0].conclusion') && \
if [ "$$CONCLUSION" != "success" ]; then \
    echo "ERROR: Latest CI run is '$$CONCLUSION'. Fix CI before deploying." >&2 && \
    echo "Run: gh run list --branch main --limit 5" >&2 && \
    exit 1; \
fi
```

**(ii) Capture digest; deploy by digest not mutable tag (CICD-R02)**
```makefile
@echo "=== Pushing to Artifact Registry ===" && \
docker push $(IMAGE) && \
DIGEST=$$(docker inspect --format='{{index .RepoDigests 0}}' $(IMAGE)) && \
echo "=== Image digest: $$DIGEST ===" && \
echo "=== Deploying to Cloud Run ===" && \
gcloud run deploy $(SERVICE) \
    --image $$DIGEST \
    --region $(REGION) \
    --project $(PROJECT_ID) \
    --set-env-vars "CF_ACCESS_SECRET=$$(gcloud secrets versions access latest \
        --secret=$(CF_SECRET_NAME) \
        --project=$(PROJECT_ID))" && \
```

**(iii) Append audit log entry (CICD-R03)**
```makefile
printf "%s\t%s\t%s\n" \
    "$$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "$$(git rev-parse HEAD)" \
    "$$DIGEST" \
    >> ~/.prowler-deploy.log && \
echo "=== Deploy complete. Logged to ~/.prowler-deploy.log ==="
```

### Verification
- [x] `make deploy` succeeds — revision `prowler-cspm-dashboard-00060-wcl`
  deployed by immutable digest.
- [x] `deploy.log` written: `2026-05-30T21:56:04Z  d081aa6...  ...@sha256:219f0c1...`
- [x] CI gate prints `=== CI status: PASSING (success) — proceeding ===`.
- [x] Image digest captured and used: `us-central1-docker.pkg.dev/...@sha256:219f0c1...`

**Notes:**
- `docker inspect --format='{{index .RepoDigests 0}}'` returns whichever repo
  tag was pushed first for the image ID — may not be the registry path if a
  local test tag exists. Fix: extract the SHA with `awk -F@ '{print $2}'` and
  prepend `$(IMAGE)` to construct the correct full digest reference.
- `deploy.log` lives at repo root, added to `.gitignore`. Variable `DEPLOY_LOG`
  defined in Makefile config block.

### Doc updates (deferred — pending commit of PR 2)
- `docs/owasp-cicd.md`: update CICD-R01, CICD-R02, CICD-R03 compensating
  controls; add RL-07 change log entry.
- `docs/threat-model.md` Build & Supply Chain table: reflect CI gate and
  digest deploy.
- `docs/security.md` `make deploy` description: document CI gate, digest
  deploy, and audit log.

---

## PR 3 — hadolint Dockerfile linter in CI

**Status: candidate**

Add `hadolint` as a step in `docker-build.yml` to lint the Dockerfile on every
PR. Catches future regressions: `ADD` from URLs, missing `--no-cache`, shell
form `RUN`, running as root. One step, SARIF output to Security tab. No new
action SHA to vet — hadolint has a maintained GitHub Action.

---

## What these changes don't close

| Open item | What's still needed |
|---|---|
| CICD-R01 fully | Branch protection on `main` (GitHub repo settings) |
| CICD-R02 fully | cosign image signing + SLSA provenance (separate PR) |
| CICD-R03 fully | CI failure webhook (not a deploy change) |
