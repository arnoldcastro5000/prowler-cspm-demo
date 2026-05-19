#!/usr/bin/env bash
set -uo pipefail

PROJECT_ID="***REDACTED-GCP-PROJECT***"
OUTPUT_DIR="/var/tmp/prowler-output"
PROWLER="prowler"
GCP_KEY_FILE=""
SCAN_ERRORS=()

cleanup() {
    [ -n "$GCP_KEY_FILE" ] && rm -f "$GCP_KEY_FILE"
    unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION
    unset GOOGLE_APPLICATION_CREDENTIALS
    unset AZURE_CLIENT_ID AZURE_CLIENT_SECRET AZURE_TENANT_ID AZURE_SUBSCRIPTION_ID
}
trap cleanup EXIT

run_check() {
    "$@"
    local EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ] || [ $EXIT_CODE -eq 3 ]; then
        return 0
    fi
    return $EXIT_CODE
}

mkdir -p "$OUTPUT_DIR"

# ─── Guard 1: run_scan.sh must have no uncommitted changes ────────────────────
echo "=== Checking run_scan.sh is committed ==="
REPO_ROOT=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then
    echo "ERROR: Could not find git repository root."
    exit 1
fi
if [ -n "$(git -C "$REPO_ROOT" diff HEAD -- prowler/run_scan.sh 2>/dev/null)" ] || \
   [ -n "$(git -C "$REPO_ROOT" diff --cached -- prowler/run_scan.sh 2>/dev/null)" ]; then
    echo "ERROR: prowler/run_scan.sh has uncommitted local changes."
    echo "Commit and push to GitHub before running a scan."
    exit 1
fi
echo "OK: run_scan.sh is committed."

# ─── Guard 2: GitHub Actions must all be green ───────────────────────────────
echo "=== Checking GitHub Actions status ==="
NOT_GREEN=$(gh run list --branch main --limit 50 \
    --json workflowName,status,conclusion,createdAt \
    --jq 'group_by(.workflowName) | map(sort_by(.createdAt) | last) | .[] | select(.conclusion != "success") | "\(.workflowName): \(.conclusion // .status)"' \
    2>/dev/null)
if [ -n "$NOT_GREEN" ]; then
    echo "ERROR: GitHub Actions workflows are not all green:"
    echo "$NOT_GREEN"
    echo "Fix all failing workflows before running a scan."
    exit 1
fi
echo "OK: GitHub Actions all green."

# ─── AWS credentials ──────────────────────────────────────────────────────────
echo "=== Fetching AWS credentials ==="
if AWS_KEY_ID=$(gcloud secrets versions access latest --secret=prowler-aws-access-key-id --project="$PROJECT_ID" 2>&1) && \
   AWS_SECRET=$(gcloud secrets versions access latest --secret=prowler-aws-secret-access-key --project="$PROJECT_ID" 2>&1); then
    export AWS_ACCESS_KEY_ID="$AWS_KEY_ID"
    export AWS_SECRET_ACCESS_KEY="$AWS_SECRET"
    export AWS_DEFAULT_REGION="us-east-1"
    AWS_READY=true
else
    echo "ERROR: Failed to fetch AWS credentials:"
    echo "$AWS_KEY_ID"
    AWS_READY=false
    SCAN_ERRORS+=("AWS credentials")
fi

# ─── GCP credentials ──────────────────────────────────────────────────────────
echo "=== Fetching GCP credentials ==="
GCP_KEY_FILE=$(mktemp /var/tmp/gcp_key_XXXXXX.json)
if gcloud secrets versions access latest --secret=prowler-gcp-service-account-key --project="$PROJECT_ID" > "$GCP_KEY_FILE" 2>&1; then
    export GOOGLE_APPLICATION_CREDENTIALS="$GCP_KEY_FILE"
    GCP_READY=true
else
    echo "ERROR: Failed to fetch GCP credentials:"
    cat "$GCP_KEY_FILE"
    GCP_READY=false
    SCAN_ERRORS+=("GCP credentials")
fi

# ─── Azure credentials ────────────────────────────────────────────────────────
echo "=== Fetching Azure credentials ==="
if AZURE_CREDS=$(gcloud secrets versions access latest --secret=prowler-azure-credentials --project="$PROJECT_ID" 2>&1); then
    AZURE_CLIENT_ID=$(echo "$AZURE_CREDS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['client_id'])")
    AZURE_CLIENT_SECRET=$(echo "$AZURE_CREDS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['client_secret'])")
    AZURE_TENANT_ID=$(echo "$AZURE_CREDS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['tenant_id'])")
    AZURE_SUBSCRIPTION_ID=$(echo "$AZURE_CREDS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['subscription_id'])")
    export AZURE_CLIENT_ID AZURE_CLIENT_SECRET AZURE_TENANT_ID AZURE_SUBSCRIPTION_ID
    AZURE_READY=true
else
    echo "ERROR: Failed to fetch Azure credentials:"
    echo "$AZURE_CREDS"
    AZURE_READY=false
    SCAN_ERRORS+=("Azure credentials")
fi

# ─── AWS scan ─────────────────────────────────────────────────────────────────
echo "=== Running Prowler AWS scan ==="
if [ "$AWS_READY" = true ]; then
    for CHECK in \
        s3_bucket_level_public_access_block \
        iam_password_policy_minimum_length_14 \
        ec2_instance_port_ssh_exposed_to_internet \
        cloudtrail_multi_region_enabled \
        s3_bucket_default_encryption; do
        echo "--- AWS check: $CHECK ---"
        run_check "$PROWLER" aws \
            --check "$CHECK" \
            --region us-east-1 \
            --output-formats json-ocsf \
            --output-directory "$OUTPUT_DIR" || {
            echo "ERROR: AWS check $CHECK failed with exit code $?"
            SCAN_ERRORS+=("AWS:$CHECK")
        }
    done
else
    echo "SKIPPED: AWS scan — credentials unavailable."
fi

# ─── GCP scan ─────────────────────────────────────────────────────────────────
echo "=== Running Prowler GCP scan ==="
if [ "$GCP_READY" = true ]; then
    for CHECK in \
        cloudstorage_bucket_public_access \
        compute_firewall_ssh_access_from_the_internet_allowed \
        iam_sa_no_administrative_privileges \
        logging_log_metric_filter_and_alert_for_audit_configuration_changes_enabled \
        kms_key_rotation_enabled; do
        echo "--- GCP check: $CHECK ---"
        run_check "$PROWLER" gcp \
            --check "$CHECK" \
            --project-id "$PROJECT_ID" \
            --output-formats json-ocsf \
            --output-directory "$OUTPUT_DIR" || {
            echo "ERROR: GCP check $CHECK failed with exit code $?"
            SCAN_ERRORS+=("GCP:$CHECK")
        }
    done
else
    echo "SKIPPED: GCP scan — credentials unavailable."
fi

# ─── Azure scan ───────────────────────────────────────────────────────────────
echo "=== Running Prowler Azure scan ==="
if [ "$AZURE_READY" = true ]; then
    for CHECK in \
        storage_blob_public_access_level_is_disabled \
        network_rdp_internet_access_restricted \
        iam_subscription_roles_owner_custom_not_created \
        monitor_alert_create_update_security_solution \
        defender_ensure_defender_for_server_is_on; do
        echo "--- Azure check: $CHECK ---"
        run_check "$PROWLER" azure \
            --check "$CHECK" \
            --output-formats json-ocsf \
            --output-directory "$OUTPUT_DIR" || {
            echo "ERROR: Azure check $CHECK failed with exit code $?"
            SCAN_ERRORS+=("Azure:$CHECK")
        }
    done
else
    echo "SKIPPED: Azure scan — credentials unavailable."
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "=== Scan complete. Output in $OUTPUT_DIR ==="
if [ ${#SCAN_ERRORS[@]} -eq 0 ]; then
    echo "All scans completed successfully."
else
    echo "Errors encountered:"
    for err in "${SCAN_ERRORS[@]}"; do
        echo "  - $err"
    done
    exit 1
fi
