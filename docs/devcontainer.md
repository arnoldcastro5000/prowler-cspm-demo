# Claude Code Devcontainer

This project runs Claude Code inside a Docker devcontainer for sandboxed AI-assisted development. No cloud credentials, no gcloud binary, and an iptables egress firewall are the primary isolation controls.

---

## Baseline: Feature 1.0.5

`ghcr.io/anthropics/devcontainer-features/claude-code:1.0.5` is the official Anthropic devcontainer feature. It is the minimum viable Claude Code container — CLI install only.

**What it does:**
- Installs `@anthropic-ai/claude-code` via `npm install -g`
- Copies `init-firewall.sh` to `/usr/local/bin/` but does **not** run it
- Adds the `anthropic.claude-code` VS Code extension

**What it does not do:**
- Does not run the firewall
- Does not configure managed settings or sandbox policy
- Does not set environment variables
- Does not mount volumes or persist auth

**Minimal devcontainer.json using the feature:**
```json
{
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "features": {
    "ghcr.io/anthropics/devcontainer-features/claude-code:1.0": {}
  }
}
```

The feature requires Node.js. If the base image does not include it, add the Node feature first:
```json
"features": {
  "ghcr.io/devcontainers/features/node:1": {},
  "ghcr.io/anthropics/devcontainer-features/claude-code:1.0": {}
}
```

---

## What We Use: Reference Container Superset

This project does not use the devcontainer feature. It follows the reference container from `anthropics/claude-code` — a fully hardened setup that adds an active egress firewall, persistent volumes, and managed sandbox policy on top of the feature baseline.

### Why not the feature

The 1.0.5 feature installs Claude Code via npm and copies (but does not run) the firewall script. The reference container approach:
- Installs Claude Code via the **native installer** (`curl https://claude.ai/install.sh | bash`) — the current Anthropic recommendation. Both npm and the native installer install the same underlying native binary; the `claude` binary does not invoke Node at runtime. The difference is delivery mechanism only.
- **Runs** the firewall on every container start via `postStartCommand`
- Delivers managed settings via Dockerfile `COPY` — survives feature overwrites
- Persists auth and config across rebuilds via named volumes

### File inventory

| File | Purpose |
|---|---|
| `.devcontainer/Dockerfile` | Container image — `node:20` base, dev tools, native Claude Code install, managed settings, firewall script |
| `.devcontainer/devcontainer.json` | Container config — volumes, env vars, firewall activation, VS Code settings |
| `.devcontainer/init-firewall.sh` | iptables egress firewall — runs on every container start via `postStartCommand` |
| `.devcontainer/managed-settings.json` | Claude Code org policy — sandbox configuration, delivered via Dockerfile COPY |
| `.devcontainer/firewall-extra-domains.txt` | Optional extra egress allowlist — bind-mounted read-only; edit on WSL2, re-run firewall to apply |
| `.claude/settings.local.json` | Project-level Claude Code config — sandbox `excludedCommands`, tool permissions allow/deny/ask |

---

## Configuration Reference

### `devcontainer.json`

```json
{
  "name": "Claude Code Sandbox",
  "build": {
    "dockerfile": "Dockerfile",
    "args": {
      "TZ": "${localEnv:TZ:America/Toronto}"
    }
  },
  "runArgs": ["--cap-add=NET_ADMIN", "--cap-add=NET_RAW"],
  "remoteUser": "node",
  "mounts": [
    "source=claude-code-bashhistory-${devcontainerId},target=/commandhistory,type=volume",
    "source=claude-code-config-${devcontainerId},target=/home/node/.claude,type=volume",
    "source=${localWorkspaceFolder}/.devcontainer/firewall-extra-domains.txt,target=/workspace/.devcontainer/firewall-extra-domains.txt,type=bind,readonly"
  ],
  "containerEnv": {
    "NODE_OPTIONS": "--max-old-space-size=4096",
    "CLAUDE_CONFIG_DIR": "/home/node/.claude",
    "POWERLEVEL9K_DISABLE_GITSTATUS": "true"
  },
  "workspaceMount": "source=${localWorkspaceFolder},target=/workspace,type=bind,consistency=delegated",
  "workspaceFolder": "/workspace",
  "postStartCommand": "sudo /usr/local/bin/init-firewall.sh",
  "waitFor": "postStartCommand"
}
```

| Field | Value | Reason |
|---|---|---|
| `remoteUser` | `node` | Matches `node:20` base image default user |
| `runArgs` | NET_ADMIN, NET_RAW | Required for iptables inside Docker |
| `mounts` | Two named volumes + one bind mount | Named volumes persist Claude auth/config and bash history across rebuilds, scoped per container via `${devcontainerId}`. Bind mount exposes `firewall-extra-domains.txt` read-only inside the container so WSL2 edits take effect on the next firewall run without a rebuild |
| `workspaceMount` | bind `/workspace` | Project files on host visible inside container |
| `postStartCommand` | `init-firewall.sh` | Firewall re-applied on every start — DNS resolutions must be fresh each time |
| `waitFor` | `postStartCommand` | VS Code does not connect until firewall is up |
| `NODE_OPTIONS` | `--max-old-space-size=4096` | Prevents OOM on large codebases |

### `Dockerfile`

Base: `node:20`

**Installed packages:** `git`, `gh`, `zsh`, `fzf`, `sudo`, `iptables`, `ipset`, `iproute2`, `dnsutils`, `aggregate`, `jq`, `nano`, `vim`, `bubblewrap`, `socat`, and standard dev tools. `bubblewrap` and `socat` are required for Claude Code's bubblewrap-based Bash sandbox.

**Claude Code:** installed via native installer at build time:
```dockerfile
RUN curl -fsSL https://claude.ai/install.sh | bash
```
Binary lands at `~/.local/bin/claude`.

**Managed settings:** copied into the image so they cannot be overridden by features or user config:
```dockerfile
COPY --chown=root:root managed-settings.json /etc/claude-code/managed-settings.json
```

**Firewall:** script copied and `node` user granted passwordless sudo to run it:
```dockerfile
COPY init-firewall.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/init-firewall.sh \
  && echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall
```

### `managed-settings.json`

Delivered via Dockerfile `COPY` to `/etc/claude-code/managed-settings.json`. Applied at highest precedence — overrides user and project settings.

```json
{
  "sandbox": {
    "enabled": true,
    "enableWeakerNestedSandbox": true,
    "failIfUnavailable": false,
    "allowUnsandboxedCommands": false
  }
}
```

| Field | Value | Reason |
|---|---|---|
| `enabled` | `true` | Enable bubblewrap sandbox for Bash |
| `enableWeakerNestedSandbox` | `true` | Allows bubblewrap inside Docker — uses unprivileged user namespace mode |
| `failIfUnavailable` | `false` | Degrade gracefully if bubblewrap is unavailable — `bubblewrap` is installed in the Dockerfile but `false` avoids a hard startup block if the kernel blocks user namespaces (e.g. restrictive WSL2 configs) |
| `allowUnsandboxedCommands` | `false` | Blocks `dangerouslyDisableSandbox` escape hatch |

### `init-firewall.sh`

Runs via `postStartCommand` on every container start. Blocks all outbound traffic except:

| Domain / Range | Purpose |
|---|---|
| GitHub IPs (dynamic, from `api.github.com/meta`) | git operations, `gh` CLI |
| `api.anthropic.com` | Claude Code inference |
| `downloads.claude.ai` | Claude Code native installer and binary updates |
| `registry.npmjs.org` | npm |
| `marketplace.visualstudio.com` | VS Code extension installs |
| `vscode.blob.core.windows.net` | VS Code extension downloads |
| `update.code.visualstudio.com` | VS Code update metadata |
| Host network subnet | Docker host communication |
| DNS (UDP 53), SSH (TCP 22), localhost | Infrastructure |

Verification: on completion the script confirms `https://example.com` is blocked and `https://api.github.com/zen` is reachable.

### `firewall-extra-domains.txt`

Allows extra egress domains to be allowlisted without editing `init-firewall.sh`. One domain per line; lines starting with `#` are ignored.

Edit the file on WSL2 (it is bind-mounted read-only inside the container), then re-run the firewall inside the container to pick up the change:

```bash
sudo /usr/local/bin/init-firewall.sh
```

### `.claude/settings.local.json`

Project-level Claude Code configuration. Controls the sandbox escape hatches and pre-approved tool permissions for this repo.

```json
{
  "permissions": {
    "allow": [...],
    "ask": ["WebFetch(*)"],
    "deny": [
      "Read(**/.aws/**)",
      "Read(**/.ssh/**)",
      "Read(**/.azure/**)",
      "Read(**/.config/gcloud/**)"
    ]
  },
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": false,
    "allowUnsandboxedCommands": false,
    "excludedCommands": ["gh *", "git *"],
    "filesystem": {
      "denyRead": ["~/.aws", "~/.ssh", "~/.azure", "~/.config/gcloud"]
    }
  }
}
```

| Field | Value | Reason |
|---|---|---|
| `sandbox.excludedCommands` | `["gh *", "git *"]` | `gh` and `git` run outside bubblewrap — both need network and filesystem access that the sandbox blocks |
| `sandbox.allowUnsandboxedCommands` | `false` | Blocks the `dangerouslyDisableSandbox` escape hatch at the project level |
| `permissions.ask` | `["WebFetch(*)"]` | All web fetches prompt for confirmation; `api.github.com` is pre-approved via the `allow` list |
| `permissions.deny` | credential paths | Read access to cloud credential directories blocked as a second line of defence (behind the firewall) |

---

## Comparison: Feature vs Reference vs This Project

| Capability | 1.0.5 Feature | Reference Container | This Project |
|---|---|---|---|
| Claude Code install | npm | npm | Native installer |
| Egress firewall | Script present, not run | Active via `postStartCommand` | Active via `postStartCommand` |
| Managed settings | None | None | Sandbox policy via Dockerfile COPY |
| Auth persistence | None | Named volume | Named volume |
| Bash history | None | Named volume | Named volume |
| Project sandbox policy | None | None | `excludedCommands`, `permissions` via `.claude/settings.local.json` |
| Auto-updates | Via npm | Via npm | Native installer (background auto-update) |

---

## Rebuild Instructions

From WSL2 at the project root:

```bash
# Remove existing container
docker rm -f $(docker ps -aq --filter "label=devcontainer.local_folder=/home/arnold/projects/prowler-cspm")

# Full rebuild — no cache
devcontainer up --workspace-folder . --build-no-cache

# Enter the container
./claude-sandbox
```

**Subsequent starts** (no rebuild needed):
```bash
./claude-sandbox
```

`devcontainer up` re-runs `postStartCommand`, which re-applies the firewall with fresh DNS resolutions.

**First-time auth:** after rebuild, re-authenticate inside the container:
```bash
claude  # follow the browser prompt
```

---

## Verification

Run the validation script inside the container. It checks every factual claim in this document against the live environment and exits 0 if all pass:

```bash
bash /workspace/.devcontainer/validate.sh
```

The script covers: running user, installed packages, environment variables (present and absent), managed settings values, firewall script permissions, mount and volume existence, project-level sandbox policy, absence of cloud credential tooling, and live firewall rules (example.com blocked, api.github.com reachable).

