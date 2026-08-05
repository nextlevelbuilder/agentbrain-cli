import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, createClient, getOutputFormat, parseJsonOption, compact } from "../utils/command-helpers.js";
import { printOutput } from "../formatters/output-formatter.js";
import { Workflow, WorkflowStep, WorkflowRun } from "../types/api-types.js";

const WORKFLOW_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "isEnabled", header: "Enabled", transform: (v: unknown) => v ? "yes" : "no" },
  { key: "cronExpression", header: "Schedule" },
  { key: "status", header: "Status" },
];

const RUN_COLUMNS = [
  { key: "id", header: "Run ID" },
  { key: "status", header: "Status" },
  { key: "startedAt", header: "Started" },
  { key: "finishedAt", header: "Completed" },
  { key: "triggeredBy", header: "Triggered By" },
];

export function registerWorkflowCommand(program: Command): void {
  const wf = program.command("workflow").alias("wf").description("Manage ETL workflows");

  wf
    .command("list")
    .description("List all workflows")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint<Workflow[]>(cmd, (c) => c.get("/cms/workflows"), WORKFLOW_COLUMNS);
    }));

  wf
    .command("get <id>")
    .description("Get workflow details")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint<Workflow>(cmd, (c) => c.get(`/cms/workflows/${id}`));
    }));

  wf
    .command("create")
    .description("Create a new workflow")
    .requiredOption("--name <name>", "Workflow name")
    .option("--description <desc>", "Description")
    .option("--schedule-type <type>", "Schedule type (manual|cron)")
    .option("--cron <expression>", "Cron expression (required when --schedule-type=cron)")
    .option("--enabled <bool>", "Whether the workflow is enabled (true|false)")
    .option("--execution-mode <mode>", "Execution mode")
    .option("--kind <kind>", "Workflow kind (defaults to etl)")
    .option("--folder-id <id>", "Place the workflow in a folder")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint<Workflow>(cmd, (c) => c.post("/cms/workflows", compact({
        name: opts.name,
        description: opts.description,
        scheduleType: opts.scheduleType,
        cronExpression: opts.cron,
        isEnabled: opts.enabled !== undefined ? opts.enabled === "true" : undefined,
        executionMode: opts.executionMode,
        kind: opts.kind,
        folderId: opts.folderId,
      })));
    }));

  wf
    .command("update <id>")
    .description("Update a workflow")
    .option("--name <name>", "New name")
    .option("--description <desc>", "New description")
    .option("--schedule-type <type>", "New schedule type (manual|cron)")
    .option("--cron <expression>", "New cron expression")
    .option("--enabled <bool>", "Enable/disable (true|false)")
    .option("--execution-mode <mode>", "New execution mode")
    .option("--folder-id <id>", "New folder ID")
    .option("--status <status>", "New status")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint<Workflow>(cmd, (c) => c.put(`/cms/workflows/${id}`, compact({
        name: opts.name,
        description: opts.description,
        scheduleType: opts.scheduleType,
        cronExpression: opts.cron,
        isEnabled: opts.enabled !== undefined ? opts.enabled === "true" : undefined,
        executionMode: opts.executionMode,
        folderId: opts.folderId,
        status: opts.status,
      })));
    }));

  wf
    .command("delete <id>")
    .description("Delete a workflow")
    .action(withErrorHandler(async (cmd, id) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/workflows/${id}`);
      console.log("Workflow deleted.");
    }));

  // Steps
  const steps = wf.command("steps").description("Manage workflow steps");

  steps
    .command("list <workflowId>")
    .description("List steps in a workflow")
    .action(withErrorHandler(async (cmd, workflowId) => {
      await fetchAndPrint<WorkflowStep[]>(cmd, (c) => c.get(`/cms/workflows/${workflowId}/steps`));
    }));

  steps
    .command("create <workflowId>")
    .description("Add step to workflow")
    .requiredOption("--step-order <n>", "Step order (position in the DAG)")
    .requiredOption("--step-type <type>", "Step type")
    .requiredOption("--step-name <name>", "Step name")
    .option("--step-alias <alias>", "Step alias")
    .option("--connector-id <id>", "Connector ID used by this step")
    .option("--prompt-template-id <id>", "Prompt template ID used by this step")
    .option("--prompt-use-case <useCase>", "Prompt use case used by this step")
    .option("--config <json>", "Step config as JSON")
    .option("--ui-position <json>", "UI position as JSON")
    .option("--input-step-ids <ids>", "Comma-separated upstream step IDs")
    .action(withErrorHandler(async (cmd, workflowId) => {
      const opts = cmd.opts();
      await fetchAndPrint<WorkflowStep>(cmd, (c) => c.post(`/cms/workflows/${workflowId}/steps`, compact({
        stepOrder: Number(opts.stepOrder),
        stepType: opts.stepType,
        stepName: opts.stepName,
        stepAlias: opts.stepAlias,
        connectorId: opts.connectorId,
        promptTemplateId: opts.promptTemplateId,
        promptUseCase: opts.promptUseCase,
        config: opts.config ? JSON.parse(opts.config) : undefined,
        uiPosition: opts.uiPosition ? JSON.parse(opts.uiPosition) : undefined,
        inputStepIds: opts.inputStepIds ? String(opts.inputStepIds).split(",").map((v: string) => v.trim()).filter(Boolean) : undefined,
      })));
    }));

  steps
    .command("update <workflowId> <stepId>")
    .description("Update a workflow step")
    .option("--step-order <n>", "New step order")
    .option("--step-type <type>", "New step type")
    .option("--step-name <name>", "New step name")
    .option("--step-alias <alias>", "New step alias")
    .option("--connector-id <id>", "New connector ID")
    .option("--prompt-template-id <id>", "New prompt template ID")
    .option("--prompt-use-case <useCase>", "New prompt use case")
    .option("--ui-position <json>", "New UI position as JSON")
    .option("--input-step-ids <ids>", "Comma-separated upstream step IDs")
    .option("--config <json>", "Updated config as JSON")
    .action(withErrorHandler(async (cmd, workflowId, stepId) => {
      const opts = cmd.opts();
      await fetchAndPrint<WorkflowStep>(cmd, (c) => c.put(`/cms/workflows/${workflowId}/steps/${stepId}`, compact({
        stepOrder: opts.stepOrder !== undefined ? Number(opts.stepOrder) : undefined,
        stepType: opts.stepType,
        stepName: opts.stepName,
        stepAlias: opts.stepAlias,
        connectorId: opts.connectorId,
        promptTemplateId: opts.promptTemplateId,
        promptUseCase: opts.promptUseCase,
        config: opts.config ? JSON.parse(opts.config) : undefined,
        uiPosition: opts.uiPosition ? JSON.parse(opts.uiPosition) : undefined,
        inputStepIds: opts.inputStepIds ? String(opts.inputStepIds).split(",").map((v: string) => v.trim()).filter(Boolean) : undefined,
      })));
    }));

  steps
    .command("delete <workflowId> <stepId>")
    .description("Delete a workflow step")
    .action(withErrorHandler(async (cmd, workflowId, stepId) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/workflows/${workflowId}/steps/${stepId}`);
      console.log("Step deleted.");
    }));

  // Run execution
  wf
    .command("run <id>")
    .description("Execute a workflow")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint<WorkflowRun>(cmd, (c) => c.post(`/cms/workflows/${id}/run`));
    }));

  wf
    .command("runs <id>")
    .description("List execution history for a workflow")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint<WorkflowRun[]>(cmd, (c) => c.get(`/cms/workflows/${id}/runs`), RUN_COLUMNS);
    }));

  wf
    .command("run-detail <runId>")
    .description("Get details of a workflow run")
    .action(withErrorHandler(async (cmd, runId) => {
      await fetchAndPrint<WorkflowRun>(cmd, (c) => c.get(`/cms/workflow-runs/${runId}`));
    }));

  wf
    .command("cancel <runId>")
    .description("Cancel a running workflow")
    .action(withErrorHandler(async (cmd, runId) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/workflow-runs/${runId}/cancel`));
    }));

  wf
    .command("run-steps <runId>")
    .description("Get step details of a run")
    .action(withErrorHandler(async (cmd, runId) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/workflow-runs/${runId}/steps`));
    }));

  // Run logs = the run's event timeline. The backend exposes no SSE stream for
  // workflow runs; the authoritative "what happened" feed is GET .../events
  // (same data as `run-events`, offered here under the familiar `logs` name).
  wf
    .command("logs <runId>")
    .description("Show the event log of a workflow run")
    .option("--limit <n>", "Max events")
    .option("--cursor <cursor>", "Pagination cursor")
    .action(withErrorHandler(async (cmd, runId) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get(`/cms/workflow-runs/${runId}/events`, compact({
        limit: o.limit,
        cursor: o.cursor,
      }) as Record<string, string>));
    }));

  // Create workflow + steps in one request
  wf
    .command("create-with-steps")
    .description("Create a workflow together with its steps in a single request")
    .requiredOption("--data <json>", 'Full request body JSON: {"workflow":{"name":"..."},"steps":[{"stepOrder":1,"stepType":"...","stepName":"..."}]}')
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      const body = parseJsonOption(opts.data, "--data");
      await fetchAndPrint(cmd, (c) => c.post("/cms/workflows/with-steps", body));
    }));

  // Replace all steps of a workflow (flow editor save)
  steps
    .command("replace <workflowId>")
    .description("Replace all steps of a workflow with a new set")
    .requiredOption("--data <json>", 'Steps array JSON: [{"stepOrder":1,"stepType":"...","stepName":"..."}]')
    .action(withErrorHandler(async (cmd, workflowId) => {
      const opts = cmd.opts();
      const stepsData = parseJsonOption(opts.data, "--data");
      await fetchAndPrint(cmd, (c) => c.put(`/cms/workflows/${workflowId}/steps/replace`, { steps: stepsData }));
    }));

  // MCP tool catalog available to workflow steps
  wf
    .command("mcp-tools")
    .description("List MCP tools available for use in workflow steps")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/workflows/mcp-tools"));
    }));

  // Node type catalog
  const nodeTypes = wf.command("node-types").description("Inspect the workflow node type catalog");

  nodeTypes
    .command("list")
    .description("List all workflow node type definitions")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/workflows/node-types"));
    }));

  nodeTypes
    .command("get <type>")
    .description("Get a single workflow node type definition")
    .action(withErrorHandler(async (cmd, type) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/workflows/node-types/${type}`));
    }));

  // Reference resolution (connector/prompt/etc. picker fields)
  const references = wf.command("references").description("Resolve step reference fields (connectors, prompts, etc.)");

  references
    .command("options")
    .description("List reference options for a step field")
    .requiredOption("--kind <kind>", "Reference kind")
    .option("--action <action>", "Reference action")
    .option("--node-type <type>", "Node/operator type")
    .option("--field-key <key>", "Step config field key")
    .option("--q <query>", "Search text")
    .option("--limit <n>", "Max results")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/workflows/reference-options", compact({
        kind: opts.kind,
        action: opts.action,
        nodeType: opts.nodeType,
        fieldKey: opts.fieldKey,
        q: opts.q,
        limit: opts.limit,
      })));
    }));

  references
    .command("resolve")
    .description("Resolve reference IDs to display items")
    .requiredOption("--data <json>", 'Request body JSON: {"refs":[{"kind":"...","action":"...","nodeType":"...","fieldKey":"...","ids":["..."]}]}')
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      const body = parseJsonOption(opts.data, "--data");
      await fetchAndPrint(cmd, (c) => c.post("/cms/workflows/reference-resolve", body));
    }));

  // Webhook triggers
  const webhook = wf.command("webhook").description("Manage workflow webhook triggers");

  webhook
    .command("list <workflowId>")
    .description("List webhook triggers for a workflow")
    .action(withErrorHandler(async (cmd, workflowId) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/workflows/${workflowId}/webhooks`));
    }));

  webhook
    .command("create <workflowId>")
    .description("Create a webhook trigger for a workflow")
    .requiredOption("--name <name>", "Trigger name")
    .option("--enabled <bool>", "Enable the trigger (true/false)")
    .option("--payload-limit <bytes>", "Max payload size in bytes")
    .action(withErrorHandler(async (cmd, workflowId) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/workflows/${workflowId}/webhooks`, compact({
        name: opts.name,
        enabled: opts.enabled !== undefined ? opts.enabled === "true" : undefined,
        payloadLimitBytes: opts.payloadLimit !== undefined ? Number(opts.payloadLimit) : undefined,
      })));
    }));

  webhook
    .command("update <workflowId> <triggerId>")
    .description("Update a webhook trigger")
    .option("--name <name>", "New trigger name")
    .option("--enabled <bool>", "Enable/disable the trigger (true/false)")
    .option("--payload-limit <bytes>", "New max payload size in bytes")
    .action(withErrorHandler(async (cmd, workflowId, triggerId) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch(`/cms/workflows/${workflowId}/webhooks/${triggerId}`, compact({
        name: opts.name,
        enabled: opts.enabled !== undefined ? opts.enabled === "true" : undefined,
        payloadLimitBytes: opts.payloadLimit !== undefined ? Number(opts.payloadLimit) : undefined,
      })));
    }));

  webhook
    .command("delete <workflowId> <triggerId>")
    .description("Delete a webhook trigger")
    .action(withErrorHandler(async (cmd, workflowId, triggerId) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/workflows/${workflowId}/webhooks/${triggerId}`);
      console.log("Webhook trigger deleted.");
    }));

  webhook
    .command("rotate-secret <workflowId> <triggerId>")
    .description("Rotate a webhook trigger's secret")
    .action(withErrorHandler(async (cmd, workflowId, triggerId) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/workflows/${workflowId}/webhooks/${triggerId}/rotate-secret`));
    }));

  // Aggregate stats
  wf
    .command("stats <id>")
    .description("Get aggregate run stats for a workflow (24h runs, avg cost, p95 duration)")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/workflows/${id}/stats`));
    }));

  // Folder placement
  wf
    .command("move-to-folder <id>")
    .description("Move a workflow into a folder; omit --folder-id to remove it from any folder")
    .option("--folder-id <folderId>", "Target folder ID (omit to remove from folder)")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch(`/cms/workflows/${id}/folder`, {
        folderId: opts.folderId ?? null,
      }));
    }));

  wf
    .command("bulk-move")
    .description("Move multiple workflows into a folder in one request; omit --folder-id to ungroup them")
    .requiredOption("--ids <ids>", "Comma-separated workflow IDs (max 200)")
    .option("--folder-id <folderId>", "Target folder ID (omit to remove from folder)")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      const workflowIds = String(opts.ids).split(",").map((v: string) => v.trim()).filter(Boolean);
      await fetchAndPrint(cmd, (c) => c.post("/cms/workflows/bulk-move", {
        workflowIds,
        folderId: opts.folderId ?? null,
      }));
    }));

  // Sharing
  wf
    .command("share <id>")
    .description("Grant a principal an action on a workflow")
    .requiredOption("--principal-kind <kind>", "user | group | role")
    .option("--principal-id <id>", "Principal ID (required for user/group)")
    .option("--principal-role <role>", "Principal role (required for role)")
    .requiredOption("--action <action>", "read | write | run | approve_checkpoint")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/workflows/${id}/share`, compact({
        principalKind: opts.principalKind,
        principalId: opts.principalId,
        principalRole: opts.principalRole,
        action: opts.action,
      })));
    }));

  wf
    .command("revoke-share <id>")
    .description("Revoke a principal's action grant on a workflow")
    .requiredOption("--principal-kind <kind>", "user | group | role")
    .option("--principal-id <id>", "Principal ID (required for user/group)")
    .option("--principal-role <role>", "Principal role (required for role)")
    .requiredOption("--action <action>", "read | write | run | approve_checkpoint")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      const { client } = createClient(cmd);
      await client.delete(`/cms/workflows/${id}/share`, compact({
        principalKind: opts.principalKind,
        principalId: opts.principalId,
        principalRole: opts.principalRole,
        action: opts.action,
      }));
      console.log("Share revoked.");
    }));

  // Per-run checkpoints
  wf
    .command("run-checkpoints <workflowId> <runId>")
    .description("List checkpoints for a specific workflow run")
    .action(withErrorHandler(async (cmd, workflowId, runId) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/workflows/${workflowId}/runs/${runId}/checkpoints`));
    }));

  // Run resume/retry/events. Named at top level (not nested under "run",
  // which is already the workflow-execution command) to avoid a command
  // name collision, matching the existing run-detail/run-steps convention.
  wf
    .command("resume <runId>")
    .description("Resume a workflow run paused on external_wait")
    .option("--decision <decision>", "Decision value")
    .option("--form-data <json>", "Form data JSON payload")
    .option("--checkpoint-id <id>", "Checkpoint ID (approval-driven resumes only)")
    .action(withErrorHandler(async (cmd, runId) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/workflow-runs/${runId}/resume`, compact({
        decision: opts.decision,
        formData: parseJsonOption(opts.formData, "--form-data"),
        checkpointId: opts.checkpointId,
      })));
    }));

  wf
    .command("retry <runId>")
    .description("Retry a failed or cancelled workflow run")
    .action(withErrorHandler(async (cmd, runId) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/workflow-runs/${runId}/retry`));
    }));

  wf
    .command("run-events <runId>")
    .description("List events for a workflow run")
    .option("--page <n>", "Page number")
    .option("--limit <n>", "Page size")
    .action(withErrorHandler(async (cmd, runId) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get(`/cms/workflow-runs/${runId}/events`, compact({
        page: opts.page,
        limit: opts.limit,
      })));
    }));

  wf
    .command("run-event <runId> <eventId>")
    .description("Get a single workflow run event")
    .action(withErrorHandler(async (cmd, runId, eventId) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/workflow-runs/${runId}/events/${eventId}`));
    }));
}
