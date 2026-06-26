import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { TryAgent } from "@tryagent/sdk";
import { startMockTryAgentPlatform } from "../../test-support/mock-tryagent-platform.mjs";
import { scenarios } from "../scenarios/index.mjs";

const EXPECTED_WORKFLOW_SLUGS = [
  "account-risk-review",
  "appointment-scheduling",
  "content-moderation",
  "contract-clause-review",
  "customer-support-policy-exception",
  "invoice-approval",
  "job-application-screening",
  "lead-qualification",
  "shipping-exception",
];

test("catalog covers the requested platform workflow examples", () => {
  assert.deepEqual(
    scenarios.map((scenario) => scenario.slug).sort(),
    EXPECTED_WORKFLOW_SLUGS,
  );
});

test("catalog stores runnable example projects", async () => {
  const projectsUrl = new URL("../example-projects.json", import.meta.url);
  const projects = JSON.parse(await readFile(projectsUrl, "utf8"));

  assert.deepEqual(
    projects.map((project) => project.slug).sort(),
    [
      "customer-refund-approval",
      "langgraph-stock-research",
      "workflow-escalation-catalog",
    ],
  );

  for (const project of projects) {
    assert.equal(typeof project.slug, "string");
    assert.equal(typeof project.title, "string");
    assert.equal(typeof project.kind, "string");
    assert.match(project.path, /^examples\//);
    assert.equal(typeof project.packageName, "string");
    assert.ok(Array.isArray(project.sdkCoverage));
  }

  const stockProject = projects.find(
    (project) => project.slug === "langgraph-stock-research",
  );
  assert.equal(stockProject.kind, "langgraph");
  assert.equal(
    stockProject.packageName,
    "@tryagent/langgraph-stock-research-example",
  );
  assert.equal(stockProject.path, "examples/langgraph-stock-research");

  const catalogProject = projects.find(
    (project) => project.slug === "workflow-escalation-catalog",
  );
  assert.equal(catalogProject.kind, "scenario-catalog");
  assert.deepEqual(catalogProject.sdkCoverage.sort(), ["python", "typescript"]);
  assert.deepEqual(
    catalogProject.scenarioSlugs,
    scenarios.map((scenario) => scenario.slug).sort(),
  );
  assert.equal(
    catalogProject.sampleEscalation.metadata.exampleProjectSlug,
    "workflow-escalation-catalog",
  );
});

for (const scenario of scenarios) {
  test(`${scenario.name} completes a TryAgent escalation lifecycle`, async (t) => {
    const platform = await startMockTryAgentPlatform();
    t.after(() => platform.close());

    const tryagent = new TryAgent({
      apiKey: platform.apiKey,
      baseUrl: platform.baseUrl,
    });

    const escalation = await tryagent.escalate(
      scenario.policy,
      scenario.escalation,
    );

    assert.equal(escalation.status, "open");
    assert.equal(escalation.policy, scenario.policy);
    assert.equal(escalation.agentId, scenario.escalation.agentId);
    assert.equal(escalation.runId, scenario.escalation.runId);
    assert.equal(escalation.metadata.workflowSlug, scenario.slug);
    assert.equal(escalation.metadata.trigger, scenario.trigger);
    assert.match(escalation.evidence.join("\n"), scenario.expectedEvidence);

    const acknowledged = await tryagent.escalations.acknowledge(escalation.id);
    assert.equal(acknowledged.status, "acknowledged");

    const decided = await tryagent.escalations.decide(
      escalation.id,
      scenario.decision,
    );

    assert.equal(decided.status, "resolved");
    assert.equal(decided.decision.choice, scenario.decision.choice);
    assert.equal(
      platform.requests.some(
        (request) =>
          request.method === "POST" &&
          request.path === "/escalations" &&
          request.body.policy === scenario.policy,
      ),
      true,
    );
  });
}
