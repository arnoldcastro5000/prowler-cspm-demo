terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

provider "google" {
  project = var.gcp_project_id
  region  = "us-central1"
}

provider "azurerm" {
  features {}
  subscription_id = var.azure_subscription_id
}

# ─── Shared variables ────────────────────────────────────────────────────────
variable "project_prefix" { type = string }
variable "gcp_project_id" { type = string }
variable "azure_subscription_id" { type = string }

# ─── AWS ─────────────────────────────────────────────────────────────────────
variable "instance_running" { type = bool }
variable "s3_bucket_public" { type = bool }
variable "iam_password_policy_min_length" { type = bool }
variable "security_group_open_ssh" { type = bool }
variable "cloudtrail_enabled" { type = bool }
variable "s3_encryption_enabled" { type = bool }

# ─── GCP ─────────────────────────────────────────────────────────────────────
variable "gcs_bucket_public" { type = bool }
variable "firewall_open_ssh" { type = bool }
variable "service_account_admin" { type = bool }
variable "audit_logging_enabled" { type = bool }
variable "kms_rotation_enabled" { type = bool }

# ─── Azure ───────────────────────────────────────────────────────────────────
variable "blob_public_access" { type = bool }
variable "nsg_rdp_open" { type = bool }
variable "custom_owner_role" { type = bool }
variable "activity_log_alerts" { type = bool }
variable "defender_enabled" { type = bool }

module "aws" {
  source = "../modules/aws"

  project_prefix                 = var.project_prefix
  instance_running               = var.instance_running
  s3_bucket_public               = var.s3_bucket_public
  iam_password_policy_min_length = var.iam_password_policy_min_length
  security_group_open_ssh        = var.security_group_open_ssh
  cloudtrail_enabled             = var.cloudtrail_enabled
  s3_encryption_enabled          = var.s3_encryption_enabled
}

module "gcp" {
  source = "../modules/gcp"

  project_id            = var.gcp_project_id
  project_prefix        = var.project_prefix
  gcs_bucket_public     = var.gcs_bucket_public
  firewall_open_ssh     = var.firewall_open_ssh
  service_account_admin = var.service_account_admin
  audit_logging_enabled = var.audit_logging_enabled
  kms_rotation_enabled  = var.kms_rotation_enabled
}

module "azure" {
  source = "../modules/azure"

  project_prefix      = var.project_prefix
  subscription_id     = var.azure_subscription_id
  blob_public_access  = var.blob_public_access
  nsg_rdp_open        = var.nsg_rdp_open
  custom_owner_role   = var.custom_owner_role
  activity_log_alerts = var.activity_log_alerts
  defender_enabled    = var.defender_enabled
}

# ─── Outputs ─────────────────────────────────────────────────────────────────
output "ec2_instance_id" {
  value = module.aws.ec2_instance_id
}
