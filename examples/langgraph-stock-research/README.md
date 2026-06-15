# LangGraph Stock Research Example

This example shows a LangGraph stock research workflow that sends high-risk
recommendations to TryAgent for human review.

The example intentionally defaults to the deployed test API:

```bash
https://agent-inbox-test-api-ekvu46wa6q-uc.a.run.app
```

## Setup

1. Open the test app:
   `https://agent-inbox-test-web-ekvu46wa6q-uc.a.run.app`
2. Create an escalation policy with a key such as `stock.research_approval`.
3. Create an API key in **Settings -> API keys**.
4. Export the test environment variables:

```bash
export TRYAGENT_API_KEY="ain_live_..."
export TRYAGENT_BASE_URL="https://agent-inbox-test-api-ekvu46wa6q-uc.a.run.app"
export TRYAGENT_POLICY_KEY="stock.research_approval"
```

`TRYAGENT_BASE_URL` is optional because this sample defaults to the test API,
but setting it explicitly makes the target environment obvious.

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
