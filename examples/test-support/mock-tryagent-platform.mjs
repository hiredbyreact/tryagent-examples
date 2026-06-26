import { createServer } from "node:http";

const DEFAULT_API_KEY = "ain_live_example_platform_e2e";
const DEFAULT_PROJECT = "tenant_example_e2e";
const DEFAULT_REVIEWER = {
  id: "usr_example_platform_e2e",
  name: "Example Platform E2E",
};

export async function startMockTryAgentPlatform(options = {}) {
  const apiKey = options.apiKey ?? DEFAULT_API_KEY;
  const project = options.project ?? DEFAULT_PROJECT;
  const reviewer = options.reviewer ?? DEFAULT_REVIEWER;
  const escalations = new Map();
  const requests = [];
  let nextEscalationNumber = 1;

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const method = request.method ?? "GET";
    const body = await readJsonBody(request);

    requests.push({ method, path: url.pathname, query: url.search, body });

    if (request.headers.authorization !== `Bearer ${apiKey}`) {
      writeJson(response, 401, {
        message: "Missing or invalid API key",
      });
      return;
    }

    try {
      if (method === "POST" && url.pathname === "/escalations") {
        const escalation = createEscalation({
          body,
          id: `esc_example_${String(nextEscalationNumber).padStart(3, "0")}`,
          project,
        });
        nextEscalationNumber += 1;
        escalations.set(escalation.id, escalation);
        writeJson(response, 200, escalation);
        return;
      }

      if (method === "GET" && url.pathname === "/escalations") {
        const status = url.searchParams.get("status");
        const rows = [...escalations.values()].filter(
          (escalation) => !status || escalation.status === status,
        );
        writeJson(response, 200, { escalations: rows });
        return;
      }

      const match = /^\/escalations\/([^/]+)(?:\/([^/]+))?$/.exec(url.pathname);
      if (!match) {
        writeJson(response, 404, { message: "Not found" });
        return;
      }

      const id = decodeURIComponent(match[1]);
      const action = match[2];
      const escalation = escalations.get(id);
      if (!escalation) {
        writeJson(response, 404, { message: "No escalation found for that id" });
        return;
      }

      if (method === "GET" && !action) {
        writeJson(response, 200, escalation);
        return;
      }

      if (method === "POST" && action === "acknowledge") {
        requireStatus(escalation, ["open"]);
        const updated = updateEscalation(escalation, { status: "acknowledged" });
        escalations.set(id, updated);
        writeJson(response, 200, updated);
        return;
      }

      if (method === "POST" && action === "decide") {
        requireStatus(escalation, ["open", "acknowledged"]);
        const choice = readRequiredChoice(body, escalation);
        const decision = {
          choice,
          ...(readString(body, "reason") ? { reason: readString(body, "reason") } : {}),
          ...(readRecord(body, "response") ? { response: readRecord(body, "response") } : {}),
          decidedBy: reviewer,
          decidedAt: new Date().toISOString(),
        };
        const updated = updateEscalation(escalation, {
          status: "resolved",
          decision,
        });
        escalations.set(id, updated);
        writeJson(response, 200, updated);
        return;
      }

      if (method === "POST" && action === "cancel") {
        requireStatus(escalation, ["open", "acknowledged"]);
        const decision = {
          ...(readString(body, "reason") ? { reason: readString(body, "reason") } : {}),
          decidedBy: reviewer,
          decidedAt: new Date().toISOString(),
        };
        const updated = updateEscalation(escalation, {
          status: "canceled",
          decision,
        });
        escalations.set(id, updated);
        writeJson(response, 200, updated);
        return;
      }

      writeJson(response, 404, { message: "Not found" });
    } catch (error) {
      writeJson(response, error.statusCode ?? 400, {
        message: error instanceof Error ? error.message : "Bad request",
      });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Mock TryAgent platform did not bind to a TCP port");
  }

  return {
    apiKey,
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    escalations,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function createEscalation({ body, id, project }) {
  const input = readRecordRoot(body);
  const choices = readChoices(input.choices);
  const now = new Date();
  const dueAt = new Date(now.getTime() + 15 * 60 * 1000);

  return {
    id,
    object: "escalation",
    project,
    policy: readRequiredString(input, "policy"),
    policyVersion: 1,
    queue: "Operations",
    agentId: readRequiredString(input, "agentId"),
    runId: readRequiredString(input, "runId"),
    subject: readSubject(input.subject),
    question: readRequiredString(input, "question"),
    evidence: readEvidence(input.evidence),
    choices,
    responseFields: Array.isArray(input.responseFields) ? input.responseFields : [],
    tier: "primary",
    severity: readString(input, "severity") ?? "sev3",
    status: "open",
    dueAt: dueAt.toISOString(),
    timeRemainingMs: dueAt.getTime() - Date.now(),
    defaultChoice: readChoiceId(choices[0]),
    resume: publicResume(input.resume),
    decision: null,
    recommendation: null,
    metadata: readPlainObject(input.metadata) ?? {},
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function updateEscalation(escalation, updates) {
  const dueAt = new Date(escalation.dueAt);
  return {
    ...escalation,
    ...updates,
    timeRemainingMs: dueAt.getTime() - Date.now(),
    updatedAt: new Date().toISOString(),
  };
}

function publicResume(value) {
  const resume = readPlainObject(value);
  if (!resume) {
    return value ?? null;
  }
  if (resume.mode !== "webhook") {
    return resume;
  }

  return {
    mode: "webhook",
    url: readRequiredString(resume, "url"),
    ...(Object.hasOwn(resume, "secret") ? { secretConfigured: true } : {}),
  };
}

function requireStatus(escalation, statuses) {
  if (!statuses.includes(escalation.status)) {
    const error = new Error("Escalation was already updated");
    error.statusCode = 409;
    throw error;
  }
}

function readRequiredChoice(body, escalation) {
  const input = readRecordRoot(body);
  const choice = readRequiredString(input, "choice");
  const validChoices = new Set(escalation.choices.map(readChoiceId).filter(Boolean));
  if (!validChoices.has(choice)) {
    throw new Error("choice must match an escalation choice");
  }
  return choice;
}

function readChoices(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("choices must be a non-empty array");
  }

  const choices = value.map((choice) => {
    if (typeof choice === "string" && choice.trim()) {
      return choice.trim();
    }
    if (readPlainObject(choice)) {
      return choice;
    }
    throw new Error("choices must contain strings or objects");
  });

  if (!choices.some((choice) => readChoiceId(choice))) {
    throw new Error("choices must include at least one id");
  }

  return choices;
}

function readChoiceId(choice) {
  if (typeof choice === "string" && choice.trim()) {
    return choice.trim();
  }
  const record = readPlainObject(choice);
  if (!record) {
    return undefined;
  }

  for (const key of ["id", "value", "key", "choice"]) {
    if (typeof record[key] === "string" && record[key].trim()) {
      return record[key].trim();
    }
  }

  return undefined;
}

function readEvidence(value) {
  if (!Array.isArray(value)) {
    throw new Error("evidence must be an array of strings");
  }
  return value.map((entry) => {
    if (typeof entry !== "string" || !entry.trim()) {
      throw new Error("evidence must be an array of strings");
    }
    return entry.trim();
  });
}

function readSubject(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  const subject = readPlainObject(value);
  if (subject) {
    return subject;
  }
  throw new Error("subject must be a string or object");
}

function readRequiredString(record, field) {
  const value = readString(record, field);
  if (!value) {
    throw new Error(`${field} is required`);
  }
  return value;
}

function readString(record, field) {
  return typeof record?.[field] === "string" && record[field].trim()
    ? record[field].trim()
    : undefined;
}

function readRecord(record, field) {
  return readPlainObject(record?.[field]);
}

function readRecordRoot(value) {
  const record = readPlainObject(value);
  if (!record) {
    throw new Error("body must be a JSON object");
  }
  return record;
}

function readPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : undefined;
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : undefined;
}

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json",
    "x-request-id": `req_example_${statusCode}`,
  });
  response.end(JSON.stringify(body));
}
