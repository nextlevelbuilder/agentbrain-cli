import { Command } from "commander";
import { addGlobalOptions } from "./utils/global-options.js";
import { registerConfigCommand } from "./commands/config-command.js";
import { registerOrgCommand } from "./commands/org-command.js";
import { registerConnectorCommand } from "./commands/connector-command.js";
import { registerConnectorSubtypeCommand } from "./commands/connector-subtype-command.js";
import { registerKnowledgeCommand } from "./commands/knowledge-command.js";
import { registerWorkflowCommand } from "./commands/workflow-command.js";
import { registerSearchCommand } from "./commands/search-command.js";
import { registerQueryLogCommand } from "./commands/query-log-command.js";
import { registerPermissionCommand } from "./commands/permission-command.js";
import { registerCategoryCommand } from "./commands/category-command.js";
import { registerTagCommand } from "./commands/tag-command.js";
import { registerFolderCommand } from "./commands/folder-command.js";
import { registerMediaCommand } from "./commands/media-command.js";
import { registerKgCommand } from "./commands/kg-command.js";
import { registerCheckpointCommand } from "./commands/checkpoint-command.js";
import { registerContextCommand } from "./commands/context-command.js";
import { registerGovernanceCommand } from "./commands/governance-command.js";
import { registerReadinessCommand } from "./commands/readiness-command.js";
import { registerLlmCommand } from "./commands/llm-command.js";
import { registerPromptCommand } from "./commands/prompt-command.js";
import { registerCostCommand } from "./commands/cost-command.js";
import { registerUsageCommand } from "./commands/usage-command.js";
import { registerDashboardCommand } from "./commands/dashboard-command.js";
import { registerAuditCommand } from "./commands/audit-command.js";
import { registerMeCommand } from "./commands/me-command.js";
import { registerSystemCommand } from "./commands/system-command.js";

// Build the fully-wired CLI program. Kept separate from the executable entry
// (index.ts) so tests can construct the program without triggering parse().
export function buildProgram(): Command {
  const program = new Command();

  program
    .name("agentbrain")
    .description("CLI for AgentBrain enterprise data hub — manage organizations, connectors, knowledge bases, workflows, media, knowledge graph, and more")
    .version("0.1.0");

  // Register global options (--output, --org, --api-url, --api-key, --token, --verbose)
  addGlobalOptions(program);

  // Existing command groups
  registerConfigCommand(program);
  registerOrgCommand(program);
  registerConnectorCommand(program);
  registerConnectorSubtypeCommand(program);
  registerKnowledgeCommand(program);
  registerWorkflowCommand(program);
  registerSearchCommand(program);
  registerQueryLogCommand(program);
  registerPermissionCommand(program);
  registerCategoryCommand(program);
  registerTagCommand(program);

  // Parity command groups (full backend coverage)
  registerFolderCommand(program);
  registerMediaCommand(program);
  registerKgCommand(program);
  registerCheckpointCommand(program);
  registerContextCommand(program);
  registerGovernanceCommand(program);
  registerReadinessCommand(program);
  registerLlmCommand(program);
  registerPromptCommand(program);
  registerCostCommand(program);
  registerUsageCommand(program);
  registerDashboardCommand(program);
  registerAuditCommand(program);
  registerMeCommand(program);
  registerSystemCommand(program);

  return program;
}
