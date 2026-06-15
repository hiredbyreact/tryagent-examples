# LangGraph Stock Research Example

This example shows a portfolio research workflow that uses LangGraph and
TryAgent when an AI research agent should not publish a stock memo on its own.

The agent loads a static equity research snapshot, evaluates the thesis against
a client mandate, and either drafts a memo automatically or pauses for human
review. This is a realistic TryAgent use case: the agent can gather evidence and
recommend a stance, while TryAgent routes, records, and resumes the decisions
that need a portfolio manager or compliance reviewer.

High-risk research uses two LangGraph interrupts:

1. Investment committee review: pauses with a TryAgent escalation payload for
   approving the buy thesis, moving the name to a watchlist, or rejecting it.
2. Compliance review: after the committee decision is resumed, pauses again
   with a TryAgent escalation payload for approving, revising, or blocking the
   client-facing memo.

Both pauses use LangGraph's `interrupt()` / `Command({ resume })` pattern:
`https://docs.langchain.com/oss/javascript/langgraph/interrupts`.

The example defaults to the production TryAgent API:

```bash
https://api.tryagent.ai
```

## Setup

1. Open the TryAgent app:
   `https://app.tryagent.ai`
2. Create escalation policies with keys such as
   `research.investment_committee` and `research.compliance_review`.
3. Create an API key in **Settings -> API keys**.
4. Export the environment variables:

```bash
export TRYAGENT_API_KEY="ain_live_..."
export TRYAGENT_INVESTMENT_POLICY_KEY="research.investment_committee"
export TRYAGENT_COMPLIANCE_POLICY_KEY="research.compliance_review"
```

Set `TRYAGENT_BASE_URL` only when you need to point the example at a local or
non-production environment.

## Run

From the repo root:

```bash
corepack pnpm --filter @tryagent/langgraph-stock-research-example start -- NVDA
```

`NVDA` is intentionally high-risk in the static sample data: valuation,
volatility, portfolio sizing, and headline risk all require review. The graph
creates a LangGraph interrupt, the CLI publishes that interrupt payload as a
TryAgent escalation, and the run waits for a future `Command({ resume: ... })`.

The first resume payload should look like:

```typescript
new Command({
  resume: {
    escalationId: "esc_...",
    decision: "move_to_watchlist",
    reviewedBy: "pm@example.com",
    notes: "Valuation risk is acceptable for watchlist, not a new buy.",
  },
});
```

After that resume, the graph pauses at the second interrupt for compliance
review. Resume that one with:

```typescript
new Command({
  resume: {
    escalationId: "esc_...",
    action: "publish_memo",
  },
});
```

For a lower-risk automatic completion path:

```bash
corepack pnpm --filter @tryagent/langgraph-stock-research-example start -- MSFT
```

## Sample tickers

- `NVDA`: creates TryAgent escalations for investment committee and compliance
  review.
- `MSFT`: drafts a memo without escalation.
- `TSLA`: demonstrates a rejected or watchlist-style thesis with margin and
  valuation risks.

The snapshots are static example data so the workflow is deterministic in CI.
They are not market data and are not investment advice.

## Test

```bash
corepack pnpm --filter @tryagent/langgraph-stock-research-example test
```
