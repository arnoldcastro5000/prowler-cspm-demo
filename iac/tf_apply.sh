#!/usr/bin/env bash
# Wrapper around terraform apply that auto-imports duplicate resources and retries.
# Usage: tf_apply.sh <terraform args...>
set -uo pipefail

MAX_RETRIES=3
ARGS=("$@")
TMPLOG=$(mktemp)

cleanup() { rm -f "$TMPLOG"; }
trap cleanup EXIT

for attempt in $(seq 1 $MAX_RETRIES); do
    # Show output in real time AND capture it for error detection
    terraform "${ARGS[@]}" 2>&1 | tee "$TMPLOG"
    TF_EXIT=${PIPESTATUS[0]}

    if [ $TF_EXIT -eq 0 ]; then
        exit 0
    fi

    TF_OUT=$(cat "$TMPLOG")

    # AWS duplicate security group rule
    if echo "$TF_OUT" | grep -q "InvalidPermission.Duplicate"; then
        echo "WARNING: Duplicate AWS security group rule — already exists in cloud, continuing."
        exit 0
    fi

    # GCP already exists
    if echo "$TF_OUT" | grep -qE "Error 409|ALREADY_EXISTS"; then
        echo "WARNING: GCP resource already exists in cloud, continuing."
        exit 0
    fi

    # Azure / generic "already exists" — auto-import and retry
    if echo "$TF_OUT" | grep -q "already exists"; then
        RESOURCE_ID=$(echo "$TF_OUT" | grep -oP 'with the ID "\K[^"]+')
        RESOURCE_ADDR=$(echo "$TF_OUT" | grep -oP 'with \Kmodule\.[^\s,]+')

        if [ -n "$RESOURCE_ID" ] && [ -n "$RESOURCE_ADDR" ]; then
            echo "=== Auto-importing $RESOURCE_ADDR ==="
            # -chdir is a global option (before subcommand); -var/-var-file are import flags
            CHDIR_ARG=""
            IMPORT_FLAGS=()
            for arg in "${ARGS[@]}"; do
                case "$arg" in
                    -chdir=*) CHDIR_ARG="$arg" ;;
                    apply|-auto-approve|-target=*) ;;
                    *) IMPORT_FLAGS+=("$arg") ;;
                esac
            done
            terraform $CHDIR_ARG import "${IMPORT_FLAGS[@]}" "$RESOURCE_ADDR" "$RESOURCE_ID" 2>&1 || true
            echo "=== Retrying apply (attempt $((attempt + 1))/$MAX_RETRIES) ==="
            continue
        fi

        echo "WARNING: Duplicate resource skipped — already exists in cloud, continuing."
        exit 0
    fi

    # Any other error — fail
    exit $TF_EXIT
done

echo "ERROR: terraform apply failed after $MAX_RETRIES attempts."
exit 1
