variable "project_prefix" { type = string }
variable "instance_running" { type = bool }
variable "s3_bucket_public" { type = bool }
variable "iam_password_policy_min_length" { type = bool }
variable "security_group_open_ssh" { type = bool }
variable "cloudtrail_enabled" { type = bool }
variable "s3_encryption_enabled" { type = bool }

# ─── S3 public access block ──────────────────────────────────────────────────
resource "aws_s3_bucket" "public_test" {
  bucket        = "${var.project_prefix}-public-test"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "public_test" {
  bucket                  = aws_s3_bucket.public_test.id
  block_public_acls       = !var.s3_bucket_public
  block_public_policy     = !var.s3_bucket_public
  ignore_public_acls      = !var.s3_bucket_public
  restrict_public_buckets = !var.s3_bucket_public
}

# ─── IAM password policy ─────────────────────────────────────────────────────
resource "aws_iam_account_password_policy" "main" {
  minimum_password_length        = var.iam_password_policy_min_length ? 8 : 14
  require_lowercase_characters   = true
  require_uppercase_characters   = true
  require_numbers                = true
  require_symbols                = true
  allow_users_to_change_password = true
}

# ─── Security group and EC2 instance — SSH exposure check ────────────────────
data "aws_vpc" "default" {
  default = true
}

resource "aws_security_group" "ssh_test" {
  name        = "${var.project_prefix}-ssh-test"
  description = "Prowler SSH exposure check"
  vpc_id      = data.aws_vpc.default.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group_rule" "ssh_open" {
  count             = var.security_group_open_ssh ? 1 : 0
  type              = "ingress"
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.ssh_test.id
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_instance" "ssh_test" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = "t3.micro"
  vpc_security_group_ids = [aws_security_group.ssh_test.id]
  tags                   = { Name = "${var.project_prefix}-ssh-test" }
}

resource "aws_ec2_instance_state" "ssh_test" {
  instance_id = aws_instance.ssh_test.id
  state       = var.instance_running ? "running" : "stopped"
}

# ─── CloudTrail ──────────────────────────────────────────────────────────────
data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "cloudtrail" {
  count         = var.cloudtrail_enabled ? 0 : 1
  bucket        = "${var.project_prefix}-cloudtrail"
  force_destroy = true
}

resource "aws_s3_bucket_policy" "cloudtrail" {
  count  = var.cloudtrail_enabled ? 0 : 1
  bucket = aws_s3_bucket.cloudtrail[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AWSCloudTrailAclCheck"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:GetBucketAcl"
        Resource  = aws_s3_bucket.cloudtrail[0].arn
      },
      {
        Sid       = "AWSCloudTrailWrite"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.cloudtrail[0].arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
        Condition = {
          StringEquals = { "s3:x-amz-acl" = "bucket-owner-full-control" }
        }
      }
    ]
  })
}

resource "aws_cloudtrail" "main" {
  count                         = var.cloudtrail_enabled ? 0 : 1
  name                          = "${var.project_prefix}-trail"
  s3_bucket_name                = aws_s3_bucket.cloudtrail[0].bucket
  is_multi_region_trail         = true
  include_global_service_events = true
  enable_logging                = true
  depends_on                    = [aws_s3_bucket_policy.cloudtrail]
}

# ─── S3 default encryption ───────────────────────────────────────────────────
resource "aws_s3_bucket" "encryption_test" {
  bucket        = "${var.project_prefix}-encryption-test"
  force_destroy = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "encryption_test" {
  count  = var.s3_encryption_enabled ? 0 : 1
  bucket = aws_s3_bucket.encryption_test.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ─── Outputs ─────────────────────────────────────────────────────────────────
output "ec2_instance_id" {
  value = aws_instance.ssh_test.id
}
