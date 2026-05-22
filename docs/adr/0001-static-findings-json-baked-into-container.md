# Static findings JSON baked into the container at build time

The dashboard has no backend API. Instead, `ingest_prowler.py` writes `findings_before.json` and `findings_after.json` directly to `dashboard/public/`, and `make deploy` bakes both files into the container image before pushing to Cloud Run. The React app fetches them as static assets at runtime.

This is deliberate: the project is a point-in-time portfolio piece, not a live monitoring system. There is no need for a dynamic data layer — the two snapshots are fixed at deploy time and never change between deploys. Adding a backend (Firestore, Cloud Run API, etc.) would introduce cost, complexity, and attack surface with no benefit for this use case.

The only failure mode is a malformed JSON file, which would be caught by zod schema validation at runtime and surfaced as an error state in the UI.
