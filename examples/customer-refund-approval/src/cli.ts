import { INTERRUPT, isInterrupted } from "@langchain/langgraph";
import { parseRequestIdArg } from "./cli-args.js";
import { createTryAgentClientFromEnv } from "./env.js";
import { createRefundApprovalGraph } from "./graph.js";
import { createStaticRefundRequestStore } from "./refunds.js";
import type { TryAgentInterruptPayload } from "./types.js";

const requestId = parseRequestIdArg(process.argv.slice(2));
if (!requestId) {
  console.error(
    "Usage: pnpm --filter @tryagent/customer-refund-approval-example start -- <REFUND_REQUEST_ID>",
  );
  process.exit(1);
}

const policy = process.env.TRYAGENT_POLICY_KEY ?? "support.refund_approval";
const messageReviewPolicy =
  process.env.TRYAGENT_MESSAGE_REVIEW_POLICY_KEY ??
  "support.refund_message_review";
const runId =
  process.env.LANGGRAPH_THREAD_ID ??
  `refund-${requestId.toLowerCase()}-${Date.now()}`;

const tryagent = createTryAgentClientFromEnv();
const graph = createRefundApprovalGraph({
  requestStore: createStaticRefundRequestStore(),
  policy,
  messageReviewPolicy,
  resumeUrl: process.env.TRYAGENT_RESUME_URL,
});
const config = { configurable: { thread_id: runId } };

const result = await graph.invoke({ requestId, runId }, config);

if (isInterrupted(result)) {
  const interrupt = result[INTERRUPT][0];
  const payload = interrupt.value as TryAgentInterruptPayload;
  const escalation = await tryagent.escalate(payload.policy, payload.tryagentInput);

  console.log(
    JSON.stringify(
      {
        requestId,
        runId,
        status: "awaiting_human",
        interruptId: interrupt.id,
        interruptKind: payload.kind,
        escalationId: escalation.id,
        nextStep:
          "Resume this LangGraph thread with new Command({ resume: ... }) when TryAgent returns a decision.",
        resumeExample:
          payload.kind === "tryagent_refund_decision"
            ? {
                escalationId: escalation.id,
                choice: "approve_refund",
                answeredBy: "reviewer@example.com",
              }
            : {
                escalationId: escalation.id,
                action: "send_message",
                message: payload.draftMessage,
              },
      },
      null,
      2,
    ),
  );
} else {
  console.log(
    JSON.stringify(
      {
        requestId: result.requestId,
        runId: result.runId,
        status: result.status,
        summary: result.summary,
        customerMessage: result.customerMessage,
      },
      null,
      2,
    ),
  );
}
