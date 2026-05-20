#!/usr/bin/env bash
# shellcheck disable=SC2329
set -uo pipefail

PROJECT_ID="***REDACTED-GCP-PROJECT***"
OUTPUT_DIR="/var/tmp/prowler-output"
PROWLER="prowler"
STATUS_FILE="/tmp/prowler-scan-status.json"
GCP_KEY_FILE=""

# Per-provider status and check-level error counts
AWS_STATUS="skipped"
GCP_STATUS="skipped"
AZURE_STATUS="skipped"
AWS_DETAIL="credentials unavailable"
GCP_DETAIL="credentials unavailable"
AZURE_DETAIL="credentials unavailable"

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

write_status() {
    OUTPUT_COUNT=$(find "$OUTPUT_DIR" -name "*.ocsf.json" 2>/dev/null | wc -l | tr -d ' ')
    cat > "$STATUS_FILE" <<EOF
{
  "providers": {
    "aws":   { "status": "$AWS_STATUS",   "detail": "$AWS_DETAIL" },
    "gcp":   { "status": "$GCP_STATUS",   "detail": "$GCP_DETAIL" },
    "azure": { "status": "$AZURE_STATUS", "detail": "$AZURE_DETAIL" }
  },
  "output_files": $OUTPUT_COUNT,
  "output_dir": "$OUTPUT_DIR"
}
EOF
    echo ""
    echo "=== Scan status written to $STATUS_FILE ==="
    cat "$STATUS_FILE"
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
    --json workflowName,status,conclusion,createdAt,event \
    --jq '[.[] | select(.event == "push")] | group_by(.workflowName) | map(sort_by(.createdAt) | last) | .[] | select(.conclusion != "success") | "\(.workflowName): \(.conclusion // .status)"' \
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
AWS_READY=false
if AWS_KEY_ID=$(gcloud secrets versions access latest --secret=prowler-aws-access-key-id --project="$PROJECT_ID" 2>&1) && \
   AWS_SECRET=$(gcloud secrets versions access latest --secret=prowler-aws-secret-access-key --project="$PROJECT_ID" 2>&1); then
    export AWS_ACCESS_KEY_ID="$AWS_KEY_ID"
    export AWS_SECRET_ACCESS_KEY="$AWS_SECRET"
    export AWS_DEFAULT_REGION="us-east-1"
    AWS_READY=true
else
    echo "WARNING: Failed to fetch AWS credentials — skipping AWS scan."
    AWS_DETAIL="credential fetch failed"
fi

# ─── GCP credentials ──────────────────────────────────────────────────────────
echo "=== Fetching GCP credentials ==="
GCP_READY=false
GCP_KEY_FILE=$(mktemp /var/tmp/gcp_key_XXXXXX.json)
if gcloud secrets versions access latest --secret=prowler-gcp-service-account-key --project="$PROJECT_ID" > "$GCP_KEY_FILE" 2>&1; then
    export GOOGLE_APPLICATION_CREDENTIALS="$GCP_KEY_FILE"
    GCP_READY=true
else
    echo "WARNING: Failed to fetch GCP credentials — skipping GCP scan."
    GCP_DETAIL="credential fetch failed"
fi

# ─── Azure credentials ────────────────────────────────────────────────────────
echo "=== Fetching Azure credentials ==="
AZURE_READY=false
if AZURE_CREDS=$(gcloud secrets versions access latest --secret=prowler-azure-credentials --project="$PROJECT_ID" 2>&1); then
    AZURE_CLIENT_ID=$(echo "$AZURE_CREDS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['client_id'])")
    AZURE_CLIENT_SECRET=$(echo "$AZURE_CREDS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['client_secret'])")
    AZURE_TENANT_ID=$(echo "$AZURE_CREDS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['tenant_id'])")
    AZURE_SUBSCRIPTION_ID=$(echo "$AZURE_CREDS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['subscription_id'])")
    export AZURE_CLIENT_ID AZURE_CLIENT_SECRET AZURE_TENANT_ID AZURE_SUBSCRIPTION_ID
    AZURE_READY=true
else
    echo "WARNING: Failed to fetch Azure credentials — skipping Azure scan."
    AZURE_DETAIL="credential fetch failed"
fi

# ─── AWS scan ─────────────────────────────────────────────────────────────────
if [ "$AWS_READY" = true ]; then
    echo "=== Running Prowler AWS scan ==="
    AWS_ERRORS=0
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
            echo "WARNING: AWS check $CHECK failed — continuing."
            AWS_ERRORS=$((AWS_ERRORS + 1))
        }
    done
    if [ $AWS_ERRORS -eq 0 ]; then
        AWS_STATUS="success"
        AWS_DETAIL="all 5 checks completed"
    else
        AWS_STATUS="partial"
        AWS_DETAIL="$AWS_ERRORS of 5 check(s) failed"
    fi
else
    echo "SKIPPED: AWS scan."
fi

# ─── GCP scan ─────────────────────────────────────────────────────────────────
if [ "$GCP_READY" = true ]; then
    echo "=== Running Prowler GCP scan ==="
    GCP_ERRORS=0
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
            echo "WARNING: GCP check $CHECK failed — continuing."
            GCP_ERRORS=$((GCP_ERRORS + 1))
        }
    done
    if [ $GCP_ERRORS -eq 0 ]; then
        GCP_STATUS="success"
        GCP_DETAIL="all 5 checks completed"
    else
        GCP_STATUS="partial"
        GCP_DETAIL="$GCP_ERRORS of 5 check(s) failed"
    fi
else
    echo "SKIPPED: GCP scan."
fi

# ─── Azure scan ───────────────────────────────────────────────────────────────
if [ "$AZURE_READY" = true ]; then
    echo "=== Running Prowler Azure scan ==="
    AZURE_ERRORS=0
    for CHECK in \
        storage_blob_public_access_level_is_disabled \
        network_rdp_internet_access_restricted \
        iam_subscription_roles_owner_custom_not_created \
        monitor_alert_create_update_security_solution \
        storage_secure_transfer_required_is_enabled; do
        echo "--- Azure check: $CHECK ---"
        run_check "$PROWLER" azure \
            --check "$CHECK" \
            --output-formats json-ocsf \
            --output-directory "$OUTPUT_DIR" || {
            echo "WARNING: Azure check $CHECK failed — continuing."
            AZURE_ERRORS=$((AZURE_ERRORS + 1))
        }
    done
    if [ $AZURE_ERRORS -eq 0 ]; then
        AZURE_STATUS="success"
        AZURE_DETAIL="all 5 checks completed"
    else
        AZURE_STATUS="partial"
        AZURE_DETAIL="$AZURE_ERRORS of 5 check(s) failed"
    fi
else
    echo "SKIPPED: Azure scan."
fi

# ─── Write status file and determine exit code ────────────────────────────────
write_status

OUTPUT_COUNT=$(find "$OUTPUT_DIR" -name "*.ocsf.json" 2>/dev/null | wc -l | tr -d ' ')
echo ""
if [ "$OUTPUT_COUNT" -eq 0 ]; then
    echo "ERROR: No scan output produced — all providers failed or were skipped."
    exit 1
else
    echo "=== Scan complete. $OUTPUT_COUNT output file(s) in $OUTPUT_DIR ==="
    exit 0
fi
