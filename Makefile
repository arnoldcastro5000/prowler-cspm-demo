# ─── Configuration ────────────────────────────────────────────────────────────
PROJECT_ID     := $(shell gcloud config get-value project 2>/dev/null)
PROJECT_PREFIX := prowler-cspm
REGION         := us-central1
AWS_REGION     := us-east-1
AR_REPO        := prowler-cspm
IMAGE          := $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(AR_REPO)/dashboard
SERVICE        := prowler-cspm-dashboard
CF_SECRET_NAME := prowler-cf-access-secret

ENV_DIR    := iac/environments
OUTPUT_DIR := /var/tmp/prowler-output
COMBINED   := /tmp/prowler-combined.ocsf.json

TF_VARS    = -var="project_prefix=$(PROJECT_PREFIX)" -var="gcp_project_id=$(PROJECT_ID)"
TF_APPLY   = bash iac/tf_apply.sh -chdir=$(ENV_DIR) apply

.PHONY: setup before scan after rescan deploy _prowl

# ─── setup: one-time init + create resources in hardened state ───────────────
setup:
	@echo "=== Fetching credentials ===" && \
	AZURE_JSON=$$(gcloud secrets versions access latest --secret=prowler-azure-credentials --project=$(PROJECT_ID)) && \
	export AWS_ACCESS_KEY_ID=$$(gcloud secrets versions access latest --secret=prowler-aws-access-key-id --project=$(PROJECT_ID)) && \
	export AWS_SECRET_ACCESS_KEY=$$(gcloud secrets versions access latest --secret=prowler-aws-secret-access-key --project=$(PROJECT_ID)) && \
	export AWS_DEFAULT_REGION=$(AWS_REGION) && \
	export ARM_CLIENT_ID=$$(echo "$$AZURE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['client_id'])") && \
	export ARM_CLIENT_SECRET=$$(echo "$$AZURE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['client_secret'])") && \
	export ARM_TENANT_ID=$$(echo "$$AZURE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['tenant_id'])") && \
	export ARM_SUBSCRIPTION_ID=$$(echo "$$AZURE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['subscription_id'])") && \
	AZURE_SUB_ID=$$(echo "$$AZURE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['subscription_id'])") && \
	echo "=== Initialising Terraform ===" && \
	terraform -chdir=$(ENV_DIR) init && \
	echo "=== [1/3] Creating AWS resources ===" && \
	$(TF_APPLY) -target=module.aws -var-file=after.tfvars $(TF_VARS) -var="azure_subscription_id=$$AZURE_SUB_ID" -auto-approve && \
	echo "=== [2/3] Creating GCP resources ===" && \
	$(TF_APPLY) -target=module.gcp -var-file=after.tfvars $(TF_VARS) -var="azure_subscription_id=$$AZURE_SUB_ID" -auto-approve && \
	echo "=== [3/3] Creating Azure resources ===" && \
	$(TF_APPLY) -target=module.azure -var-file=after.tfvars $(TF_VARS) -var="azure_subscription_id=$$AZURE_SUB_ID" -auto-approve && \
	echo "=== Setup complete. Run 'make before' to begin. ==="

# ─── before: apply misconfigured state, start EC2 ────────────────────────────
before:
	@echo "=== Fetching credentials ===" && \
	AZURE_JSON=$$(gcloud secrets versions access latest --secret=prowler-azure-credentials --project=$(PROJECT_ID)) && \
	export AWS_ACCESS_KEY_ID=$$(gcloud secrets versions access latest --secret=prowler-aws-access-key-id --project=$(PROJECT_ID)) && \
	export AWS_SECRET_ACCESS_KEY=$$(gcloud secrets versions access latest --secret=prowler-aws-secret-access-key --project=$(PROJECT_ID)) && \
	export AWS_DEFAULT_REGION=$(AWS_REGION) && \
	export ARM_CLIENT_ID=$$(echo "$$AZURE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['client_id'])") && \
	export ARM_CLIENT_SECRET=$$(echo "$$AZURE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['client_secret'])") && \
	export ARM_TENANT_ID=$$(echo "$$AZURE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['tenant_id'])") && \
	export ARM_SUBSCRIPTION_ID=$$(echo "$$AZURE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['subscription_id'])") && \
	AZURE_SUB_ID=$$(echo "$$AZURE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['subscription_id'])") && \
	echo "=== [1/3] Misconfiguring AWS resources ===" && \
	$(TF_APPLY) -target=module.aws -var-file=before.tfvars $(TF_VARS) -var="azure_subscription_id=$$AZURE_SUB_ID" -auto-approve && \
	echo "=== [2/3] Misconfiguring GCP resources ===" && \
	$(TF_APPLY) -target=module.gcp -var-file=before.tfvars $(TF_VARS) -var="azure_subscription_id=$$AZURE_SUB_ID" -auto-approve && \
	echo "=== [3/3] Misconfiguring Azure resources ===" && \
	$(TF_APPLY) -target=module.azure -var-file=before.tfvars $(TF_VARS) -var="azure_subscription_id=$$AZURE_SUB_ID" -auto-approve

# ─── after: apply hardened state, stop EC2 ───────────────────────────────────
after:
	@echo "=== Fetching credentials ===" && \
	AZURE_JSON=$$(gcloud secrets versions access latest --secret=prowler-azure-credentials --project=$(PROJECT_ID)) && \
	export AWS_ACCESS_KEY_ID=$$(gcloud secrets versions access latest --secret=prowler-aws-access-key-id --project=$(PROJECT_ID)) && \
	export AWS_SECRET_ACCESS_KEY=$$(gcloud secrets versions access latest --secret=prowler-aws-secret-access-key --project=$(PROJECT_ID)) && \
	export AWS_DEFAULT_REGION=$(AWS_REGION) && \
	export ARM_CLIENT_ID=$$(echo "$$AZURE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['client_id'])") && \
	export ARM_CLIENT_SECRET=$$(echo "$$AZURE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['client_secret'])") && \
	export ARM_TENANT_ID=$$(echo "$$AZURE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['tenant_id'])") && \
	export ARM_SUBSCRIPTION_ID=$$(echo "$$AZURE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['subscription_id'])") && \
	AZURE_SUB_ID=$$(echo "$$AZURE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['subscription_id'])") && \
	echo "=== [1/3] Hardening AWS resources ===" && \
	$(TF_APPLY) -target=module.aws -var-file=after.tfvars $(TF_VARS) -var="azure_subscription_id=$$AZURE_SUB_ID" -auto-approve && \
	echo "=== [2/3] Hardening GCP resources ===" && \
	$(TF_APPLY) -target=module.gcp -var-file=after.tfvars $(TF_VARS) -var="azure_subscription_id=$$AZURE_SUB_ID" -auto-approve && \
	echo "=== [3/3] Hardening Azure resources ===" && \
	$(TF_APPLY) -target=module.azure -var-file=after.tfvars $(TF_VARS) -var="azure_subscription_id=$$AZURE_SUB_ID" -auto-approve

# ─── _prowl: clear output, run scan, merge per-check output files ─────────────
_prowl:
	@echo "=== Clearing previous scan output ==="
	rm -rf $(OUTPUT_DIR)
	@echo "=== Running Prowler scan ==="
	bash prowler/run_scan.sh
	@echo "=== Merging Prowler output files ==="
	python3 -c "\
import json, glob; \
files = sorted(glob.glob('$(OUTPUT_DIR)/*.ocsf.json')); \
combined = []; \
[combined.extend(d if isinstance((d := json.load(open(f))), list) else [d]) for f in files]; \
json.dump(combined, open('$(COMBINED)', 'w'), indent=2); \
print(f'Merged {len(files)} file(s), {len(combined)} finding(s) total')"

# ─── scan: run Prowler, write findings_before.json ───────────────────────────
scan: _prowl
	@echo "=== Ingesting to findings_before.json ==="
	python3 ingest/ingest_prowler.py $(COMBINED) findings_before

# ─── rescan: run Prowler, write findings_after.json ──────────────────────────
rescan: _prowl
	@echo "=== Ingesting to findings_after.json ==="
	python3 ingest/ingest_prowler.py $(COMBINED) findings_after

# ─── deploy: build, push, deploy to Cloud Run ────────────────────────────────
deploy:
	@test -f dashboard/package.json \
		|| (echo "ERROR: dashboard not scaffolded. Build the dashboard (Phase 5) first." && exit 1)
	@test -f dashboard/public/findings_before.json \
		|| (echo "ERROR: findings_before.json missing. Run 'make scan' first." && exit 1)
	@test -f dashboard/public/findings_after.json \
		|| (echo "ERROR: findings_after.json missing. Run 'make rescan' first." && exit 1)
	@echo "=== Building Docker image ==="
	docker build -t $(IMAGE) dashboard/
	@echo "=== Pushing to Artifact Registry ==="
	docker push $(IMAGE)
	@echo "=== Deploying to Cloud Run ==="
	gcloud run deploy $(SERVICE) \
		--image $(IMAGE) \
		--region $(REGION) \
		--project $(PROJECT_ID) \
		--set-env-vars "CF_ACCESS_SECRET=$$(gcloud secrets versions access latest \
			--secret=$(CF_SECRET_NAME) \
			--project=$(PROJECT_ID))"
	@echo "=== Deploy complete ==="
