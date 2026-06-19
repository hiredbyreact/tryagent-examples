# Customer Refund Approval Example

This example shows a LangGraph customer support workflow that uses TryAgent when
an AI agent should not approve a refund on its own.

The agent loads a refund request, evaluates policy risk, and either
auto-approves a low-risk request or creates a TryAgent escalation for a human
reviewer. This is the kind of production decision boundary TryAgent is built
for: the agent can gather evidence and recommend an outcome, while the platform
routes, records, and resumes the human decision.

High-risk requests use two LangGraph interrupts:

1. Refund approval: pauses with a TryAgent escalation payload for approving,
   offering store credit, or denying the refund.
2. Customer message review: after the refund decision is resumed, pauses again
   with a TryAgent escalation payload for reviewing the customer-facing message.

Both pauses use LangGraph's `interrupt()` / `Command({ resume })` pattern:
`https://docs.langchain.com/oss/javascript/langgraph/interrupts`.

The example defaults to the production TryAgent API:

```bash
https://api.tryagent.ai
```

## Setup

1. Open the TryAgent app:
   `https://tryagent.ai`
2. Create an escalation policy with a key such as `support.refund_approval`.
3. Create an API key in **Settings -> API keys**.
4. Export the environment variables:

```bash
export TRYAGENT_API_KEY="ain_live_..."
export TRYAGENT_POLICY_KEY="support.refund_approval"
```

Set `TRYAGENT_BASE_URL` only when you need to point the example at a local or
non-production environment.

## Run

From the repo root:

```bash
corepack pnpm --filter @tryagent/customer-refund-approval-example start -- refund_high_value_late
```

`refund_high_value_late` is intentionally risky: it is a high-value refund,
outside the policy window, with prior refund history. The graph creates a
LangGraph interrupt, the CLI publishes that interrupt payload as a TryAgent
escalation, and the run waits for a future `Command({ resume: ... })`.

The first resume payload should look like:

```typescript
new Command({
  resume: {
    escalationId: "esc_...",
    choice: "approve_refund",
    answeredBy: "reviewer@example.com",
  },
});
```

After that resume, the graph pauses at the second interrupt for customer message
review. Resume that one with:

```typescript
new Command({
  resume: {
    escalationId: "esc_...",
    action: "send_message",
    message: "Your refund has been approved...",
  },
});
```

For a low-risk automatic completion path:

```bash
corepack pnpm --filter @tryagent/customer-refund-approval-example start -- refund_low_value_duplicate_shipping
```

## Sample requests

- `refund_high_value_late`: creates a TryAgent escalation for human approval.
- `refund_low_value_duplicate_shipping`: auto-approves without escalation.
- `refund_lost_package`: demonstrates carrier-loss evidence in the policy
  assessment.

## Test

```bash
corepack pnpm --filter @tryagent/customer-refund-approval-example test
```
