# Security model

## Trust boundaries

1. **Untrusted skill input** — manifests and instructions are parsed but external code is not executed during resolution.
2. **Model output** — model-proposed actions are requests, never authority.
3. **Policy engine** — validates declared capability and risk before tool execution.
4. **Execution sandbox** — filesystem/shell/browser access is isolated from the control plane.
5. **Secret boundary** — future production adapters must inject scoped secret references at the network boundary rather than exposing values to model or shell output.

## Default approval actions

Production deployments, merges, resource deletion, outbound messaging, payments, privileged database writes and credential changes should require approval unless an organization administrator explicitly creates a narrower policy.

## Supply-chain controls

A production skill registry should retain package checksum, source provenance, requested permission diff, static analysis results, signer identity and version pinning. Permission escalation between versions must never silently auto-upgrade.
