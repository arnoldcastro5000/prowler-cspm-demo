#!/usr/bin/env bash
# Wrapper around terraform apply that auto-imports duplicate resources and retries.
# Usage: tf_apply.sh <terraform args...>
set -uo pipefail

MAX_RETRIES=3
ARGS=("$@")

run_apply() {
    TF_OUT=$(terraform "${ARGS[@]}" 2>&1)
    TF_EXIT=$?
    echo "$TF_OUT"
    echo "$TF_OUT"  # keep a copy for parsing
    printf '%s' "$TF_OUT"
}

for attempt in $(seq 1 $MAX_RETRIES); do
    TF_OUT=$(terraform "${ARGS[@]}" 2>&1)
    TF_EXIT=$?
    echo "$TF_OUT"

    if [ $TF_EXIT -eq 0 ]; then
        exit 0
    fi

    # AWS duplicate security group rule — can't auto-import, just warn and continue
    if echo "$TF_OUT" | grep -q "InvalidPermission.Duplicate"; then
        echo "WARNING: Duplicate AWS security group rule — already exists in cloud, continuing."
        exit 0
    fi

    # GCP already exists
    if echo "$TF_OUT" | grep -qE "Error 409|ALREADY_EXISTS"; then
        echo "WARNING: GCP resource already exists in cloud, continuing."
        exit 0
    fi

    # Azure / generic "already exists - to be managed via Terraform" — auto-import and retry
    if echo "$TF_OUT" | grep -q "already exists"; then
        # Extract resource ID from: a resource with the ID "XXXX" already exists
        RESOURCE_ID=$(echo "$TF_OUT" | grep -oP 'with the ID "\K[^"]+')
        # Extract resource address from: with module.xxx.yyy[0],
        RESOURCE_ADDR=$(echo "$TF_OUT" | grep -oP 'with \Kmodule\.[^\s,]+')

        if [ -n "$RESOURCE_ID" ] && [ -n "$RESOURCE_ADDR" ]; then
            echo "=== Auto-importing $RESOURCE_ADDR ==="
            terraform import "${ARGS[@]}" "$RESOURCE_ADDR" "$RESOURCE_ID" 2>&1 || true
            echo "=== Retrying apply (attempt $((attempt + 1))/$MAX_RETRIES) ==="
            continue
        fi

        # Couldn't parse — warn and continue
        echo "WARNING: Duplicate resource skipped — already exists in cloud, continuing."
        exit 0
    fi

    # Any other error — fail
    exit $TF_EXIT
done

echo "ERROR: terraform apply failed after $MAX_RETRIES attempts."
exit 1
