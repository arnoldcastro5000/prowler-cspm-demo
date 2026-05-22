variable "project_prefix" { type = string }
variable "location" {
  type    = string
  default = "East US"
}
variable "subscription_id" { type = string }
variable "blob_public_access" { type = bool }
variable "nsg_rdp_open" { type = bool }
variable "custom_owner_role" { type = bool }
variable "activity_log_alerts" { type = bool }
variable "storage_https_disabled" { type = bool }

resource "azurerm_resource_group" "prowler" {
  name     = "${var.project_prefix}-rg"
  location = var.location
}

# ─── Storage blob public access ──────────────────────────────────────────────
resource "azurerm_storage_account" "prowler_test" {
  name                            = substr(lower(replace("${var.project_prefix}sa", "-", "")), 0, 24)
  resource_group_name             = azurerm_resource_group.prowler.name
  location                        = azurerm_resource_group.prowler.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  allow_nested_items_to_be_public = var.blob_public_access
  https_traffic_only_enabled      = !var.storage_https_disabled
}

# ─── NSG — RDP open to internet ──────────────────────────────────────────────
resource "azurerm_network_security_group" "prowler_test" {
  name                = "${var.project_prefix}-nsg"
  location            = azurerm_resource_group.prowler.location
  resource_group_name = azurerm_resource_group.prowler.name

}

resource "azurerm_network_security_rule" "rdp_open" {
  count                       = var.nsg_rdp_open ? 1 : 0
  name                        = "rdp-open"
  priority                    = 100
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "3389"
  source_address_prefix       = "*"
  destination_address_prefix  = "*"
  resource_group_name         = azurerm_resource_group.prowler.name
  network_security_group_name = azurerm_network_security_group.prowler_test.name
}

# ─── Custom owner role ───────────────────────────────────────────────────────
resource "azurerm_role_definition" "prowler_owner" {
  count       = var.custom_owner_role ? 1 : 0
  name        = "${var.project_prefix}-custom-owner"
  scope       = "/subscriptions/${var.subscription_id}"
  description = "Prowler demo custom owner role"

  permissions {
    actions     = ["*"]
    not_actions = []
  }

  assignable_scopes = ["/subscriptions/${var.subscription_id}"]
}

# ─── Activity log alert for security solution changes ────────────────────────
resource "azurerm_monitor_action_group" "prowler" {
  count               = var.activity_log_alerts ? 0 : 1
  name                = "${var.project_prefix}-ag"
  resource_group_name = azurerm_resource_group.prowler.name
  short_name          = "prowler"
}

resource "azurerm_monitor_activity_log_alert" "security_solution" {
  count               = var.activity_log_alerts ? 0 : 1
  name                = "${var.project_prefix}-security-solution-alert"
  resource_group_name = azurerm_resource_group.prowler.name
  location            = "global"
  scopes              = ["/subscriptions/${var.subscription_id}"]
  description         = "Alert on security solution changes"

  criteria {
    category       = "Security"
    operation_name = "Microsoft.Security/policies/write"
  }

  action {
    action_group_id = azurerm_monitor_action_group.prowler[0].id
  }
}

