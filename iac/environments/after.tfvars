
# EC2 stopped after hardening
instance_running = false

# AWS — all hardened
s3_bucket_public               = false
iam_password_policy_min_length = false
security_group_open_ssh        = false
cloudtrail_enabled             = false
s3_encryption_enabled          = false

# GCP — all hardened
gcs_bucket_public     = false
firewall_open_ssh     = false
service_account_admin = false
audit_logging_enabled = false
kms_rotation_enabled  = false

# Azure — all hardened
blob_public_access     = false
nsg_rdp_open           = false
custom_owner_role      = false
activity_log_alerts    = false
storage_https_disabled = false
