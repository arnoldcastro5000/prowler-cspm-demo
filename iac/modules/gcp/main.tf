variable "project_id" { type = string }
variable "project_prefix" { type = string }
variable "region" {
  type    = string
  default = "us-central1"
}
variable "gcs_bucket_public" { type = bool }
variable "firewall_open_ssh" { type = bool }
variable "service_account_admin" { type = bool }
variable "audit_logging_enabled" { type = bool }
variable "kms_rotation_enabled" { type = bool }

# ─── GCS bucket public access ────────────────────────────────────────────────
resource "google_storage_bucket" "public_test" {
  name          = "${var.project_prefix}-public-test"
  location      = var.region
  force_destroy = true

  public_access_prevention = var.gcs_bucket_public ? "inherited" : "enforced"
}

# ─── Firewall — SSH open to internet ─────────────────────────────────────────
resource "google_compute_firewall" "ssh_open" {
  count   = var.firewall_open_ssh ? 1 : 0
  name    = "${var.project_prefix}-allow-ssh"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
}

# ─── Service account with admin privileges ───────────────────────────────────
resource "google_service_account" "prowler_test" {
  account_id   = substr("${var.project_prefix}-test", 0, 28)
  display_name = "Prowler test"
  project      = var.project_id
}

resource "google_project_iam_member" "prowler_test" {
  project = var.project_id
  role    = var.service_account_admin ? "roles/editor" : "roles/viewer"
  member  = "serviceAccount:${google_service_account.prowler_test.email}"
}

# ─── Log metric filter and alert for audit config changes ────────────────────
resource "google_logging_metric" "audit_config_changes" {
  count  = var.audit_logging_enabled ? 0 : 1
  name   = "${var.project_prefix}-audit-config-changes"
  filter = "protoPayload.methodName=\"SetIamPolicy\" AND protoPayload.serviceData.policyDelta.auditConfigDeltas:*"

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_monitoring_alert_policy" "audit_config_changes" {
  count        = var.audit_logging_enabled ? 0 : 1
  display_name = "${var.project_prefix}-audit-config-alert"
  combiner     = "OR"

  conditions {
    display_name = "audit config changes"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${var.project_prefix}-audit-config-changes\" AND resource.type=\"global\""
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = []

  depends_on = [google_logging_metric.audit_config_changes]
}

# ─── KMS key rotation ────────────────────────────────────────────────────────
resource "google_kms_key_ring" "prowler_test" {
  name     = "${var.project_prefix}-keyring"
  location = var.region
  project  = var.project_id
}

resource "google_kms_crypto_key" "prowler_test" {
  name            = "${var.project_prefix}-key"
  key_ring        = google_kms_key_ring.prowler_test.id
  rotation_period = var.kms_rotation_enabled ? null : "7776000s"

  lifecycle {
    prevent_destroy = false
  }
}
