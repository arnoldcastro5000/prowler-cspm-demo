
# EC2 running for scan
instance_running = true

# AWS — all misconfigured
s3_bucket_public               = true
iam_password_policy_min_length = true
security_group_open_ssh        = true
cloudtrail_enabled             = true
s3_encryption_enabled          = true

# GCP — all misconfigured
gcs_bucket_public     = true
firewall_open_ssh     = true
service_account_admin = true
audit_logging_enabled = true
kms_rotation_enabled  = true

# Azure — all misconfigured
blob_public_access     = true
nsg_rdp_open           = true
custom_owner_role      = true
activity_log_alerts    = true
storage_https_disabled = true
