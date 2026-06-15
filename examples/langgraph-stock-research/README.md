# LangGraph Stock Research Example

This example shows a LangGraph stock research workflow that sends high-risk
recommendations to TryAgent for human review.

The example defaults to the production TryAgent API:

```bash
https://api.tryagent.ai
```

## Setup

1. Open the TryAgent app:
   `https://app.tryagent.ai`
2. Create an escalation policy with a key such as `stock.research_approval`.
3. Create an API key in **Settings -> API keys**.
4. Export the environment variables:

```bash
export TRYAGENT_API_KEY="ain_live_..."
export TRYAGENT_POLICY_KEY="stock.research_approval"
```

Set `TRYAGENT_BASE_URL` only when you need to point the example at a local or
non-production environment.

## Run

From the repo root:

```bash
corepack pnpm --filter @tryagent/langgraph-stock-research-example start -- NVDA
```

`NVDA` is intentionally high-risk in the static sample data, so the graph sends
an escalation to TryAgent and returns `status: "awaiting_human"`.

For a low-risk local completion path:

```bash
corepack pnpm --filter @tryagent/langgraph-stock-research-example start -- MSFT
```

## Test

```bash
corepack pnpm --filter @tryagent/langgraph-stock-research-example test
```
