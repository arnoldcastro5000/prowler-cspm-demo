# Threat Model

This project intentionally creates security vulnerabilities in real cloud environments to demonstrate that they can be detected and fixed. That means real risk exists during two phases: while the vulnerabilities are active during a scan, and while the public dashboard is running.

---

## Phase 1: Scan Window Risk

During a scan cycle, real cloud resources across AWS, Google Cloud, and Azure are deliberately left in an insecure state. This window is kept as short as possible — typically under an hour — but during that time, the following exposures exist:

| Misconfiguration | Provider | What is exposed | What could happen |
|---|---|---|---|
| Remote login open to the internet | AWS | Server accepts SSH connections from any IP address | Unauthorized access attempts against the server |
| Storage bucket public access enabled | AWS | Bucket contents readable by anyone on the internet | Data theft if files were present |
| Weak password policy | AWS | Minimum password length set below 14 characters | Brute-force attacks against console login |
| Storage bucket public access enabled | Google Cloud | Bucket contents readable by anyone on the internet | Data theft if files were present |
| Firewall allows remote login from any source | Google Cloud | SSH connections accepted from any IP address | Unauthorized access to any server using this firewall rule |
| Service account has administrative access | Google Cloud | A service account can perform any action in the project | Full project takeover if the service account key is compromised |
| Audit logging alert disabled | Google Cloud | No alert when audit configuration is changed | An attacker could modify logging without detection |
| Encryption key rotation disabled | Google Cloud | Encryption key is not rotated annually | Longer exposure window if the key is compromised |
| Storage account allows public access | Azure | Blobs readable by anyone on the internet | Data theft if files were present |
| Remote desktop open to the internet | Azure | Server accepts RDP connections from any IP address | Brute-force attacks, ransomware entry point |
| Custom role with owner permissions | Azure | A role with full subscription-level access exists | Full subscription takeover if the role is assigned to a compromised identity |
| Activity log alert disabled | Azure | No alert when security solutions are created or modified | An attacker could disable security controls without detection |
| Unencrypted storage connections allowed | Azure | Storage account accepts HTTP requests without encryption | Network traffic could be intercepted in transit |

### Why this is acceptable

- **No real data exists in these resources.** Storage buckets are empty. Servers run no applications. There is nothing to steal.
- **No real users are affected.** These are isolated demo accounts with no other users or workloads.
- **The window is minimized.** Misconfigurations are applied, scanned, and remediated in a single session.
- **The server is shut down after the scan.** Once remediation is applied, the server stops running entirely.
- **Credentials are limited in scope.** Each cloud provider's credentials can only modify the specific resources in this project.

### What could still go wrong

An attacker scanning the internet during the scan window could discover the open network ports. While login would fail (no credentials are configured on the server), the open port signals that the account exists and could attract further probing.

---

## Phase 2: Running Dashboard Risk

The dashboard runs 24/7 at `prowler.cloudsecuritypractice.com` and is accessible to anyone on the internet.

### How traffic flows

All visitor traffic passes through Cloudflare (which provides firewall, DDoS protection, and caching) before reaching the application server on Google Cloud. A secret shared between Cloudflare and the server ensures that only traffic routed through Cloudflare is accepted. Direct access to the server is blocked.

```
Visitor → Cloudflare (firewall, DDoS protection) → Cloudflare Worker (adds secret) → Application server (verifies secret)
```

### What could go wrong

| Scenario | What happens | How it is addressed |
|---|---|---|
| Someone discovers the application server's direct address | They try to access it without going through Cloudflare | The server rejects any request that does not carry the shared secret |
| The shared secret is leaked | An attacker could bypass Cloudflare and reach the server directly | The secret is stored in Google Cloud's Secret Manager and can be rotated by redeploying |
| The Cloudflare Worker stops working | The dashboard goes down because the secret is no longer being added to requests | Manual intervention is required to fix and redeploy the Worker |
| Someone compromises the code repository | Malicious code could be deployed to the dashboard | 10 automated security checks run on every code change; deployment is a manual step, not automatic |
| A third-party code dependency is compromised | Malicious code enters through a software library update | Automated dependency scanning flags known vulnerabilities; all CI action versions are pinned to exact releases |
| The local development machine is compromised | Infrastructure configuration files contain resource identifiers | Single-user machine with restricted file permissions; configuration files are never uploaded to the code repository |

### What the HTTP security headers protect against

The dashboard is a static site with no login, no forms, and no user input. These headers protect against threats that exist even for a read-only public site:

| Header | Realistic threat for this project |
|---|---|
| `Content-Security-Policy` | If the code repository is compromised and malicious JavaScript is injected, CSP limits where that script can send stolen data and blocks inline scripts without the per-request nonce. Also prevents a compromised npm dependency from loading external resources. |
| `Strict-Transport-Security` | Without HSTS, a visitor's first request could be intercepted over HTTP before the redirect to HTTPS (SSL stripping). HSTS tells the browser to never attempt HTTP for this domain. |
| `X-Frame-Options: DENY` | Prevents an attacker from embedding the dashboard in a hidden iframe on a malicious site to perform clickjacking. Low risk since there are no interactive controls, but it closes the path entirely. |
| `X-Content-Type-Options: nosniff` | Prevents a browser from misinterpreting a JSON findings file as executable JavaScript. Without this, a crafted findings file could theoretically be executed if served with the wrong MIME type. |
| `Referrer-Policy` | When a visitor clicks the GitHub or LinkedIn links on the landing page, this prevents the full URL path from leaking to those external sites. |
| `Permissions-Policy` | Blocks any injected script from accessing camera, microphone, geolocation, or payment APIs. The dashboard does not use these, so disabling them eliminates an entire class of attack surface if code is compromised. |

The most meaningful headers for this project are **CSP** (limits the blast radius of a code compromise) and **HSTS** (prevents downgrade attacks). The others are defense-in-depth — low effort, but they close off attack paths that would otherwise exist by browser default.

### What this project does not include

These are intentional scope decisions, not oversights:

| Feature not included | Reason |
|---|---|
| Continuous monitoring | This project captures point-in-time snapshots, not live state |
| Security event forwarding (SIEM) | The dashboard is self-contained and does not integrate with external security platforms |
| Real-time alerting | No notifications are sent when findings change |
| Multi-account scanning | One account per cloud provider is sufficient for the demonstration |
| Encryption of findings data | Findings are public by design and contain no sensitive information after redaction |
| Dashboard container scanning | Infrastructure code is scanned for misconfigurations; the dashboard container image is not |

---

## If a credential is compromised

1. **Create a new version** of the secret in Google Cloud Secret Manager
2. **Revoke the old credential** in the affected cloud provider's console
3. **Redeploy the dashboard** if the compromised secret is the one shared with Cloudflare
4. **Review access logs** in Google Cloud Run and Cloudflare for unauthorized activity during the exposure window
5. **Check the code repository** for any accidental credential commits (automated scanning runs on every push, but verify manually)
