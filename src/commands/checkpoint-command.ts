import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, parseJsonOption, compact } from "../utils/command-helpers.js";

const CHECKPOINT_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "workflowName", header: "Workflow" },
  { key: "stepName", header: "Step" },
  { key: "status", header: "Status" },
  { key: "approvalQuorum", header: "Quorum" },
  { key: "approvedCount", header: "Approved" },
  { key: "rejectedCount", header: "Rejected" },
  { key: "createdAt", header: "Created" },
];

export function registerCheckpointCommand(program: Command): void {
  const checkpoint = program.command("checkpoint").alias("cpt").description("Manage workflow approval checkpoints");

  checkpoint
    .command("list")
    .description("List checkpoints where you are an approver (defaults to status=pending)")
    .option("--status <status>", "Filter by status: pending | approved | rejected | cancelled | expired | all")
    .option("--page <n>", "Page number")
    .option("--limit <n>", "Page size")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/checkpoints", compact({
        status: opts.status,
        page: opts.page,
        limit: opts.limit,
      })), CHECKPOINT_COLUMNS);
    }));

  checkpoint
    .command("get <id>")
    .description("Get checkpoint details (form schema, approver roster, decision state)")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/checkpoints/${id}`));
    }));

  checkpoint
    .command("approve <id>")
    .description("Approve a checkpoint")
    .option("--form-data <json>", "Form data JSON payload")
    .option("--comment <comment>", "Decision comment")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/checkpoints/${id}/approve`, compact({
        formData: parseJsonOption(opts.formData, "--form-data"),
        comment: opts.comment,
      })));
    }));

  checkpoint
    .command("reject <id>")
    .description("Reject a checkpoint")
    .option("--comment <comment>", "Decision comment")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/checkpoints/${id}/reject`, compact({
        comment: opts.comment,
      })));
    }));

  checkpoint
    .command("cancel <id>")
    .description("Cancel a checkpoint (requires workflow write access on the parent workflow)")
    .option("--reason <reason>", "Cancellation reason")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/checkpoints/${id}/cancel`, compact({
        reason: opts.reason,
      })));
    }));
}
