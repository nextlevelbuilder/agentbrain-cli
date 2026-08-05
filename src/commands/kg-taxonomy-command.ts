import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, compact, parseJsonOption } from "../utils/command-helpers.js";

const TYPE_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "slug", header: "Slug" },
  { key: "label", header: "Label" },
  { key: "isSystem", header: "System" },
];

// Registers `kg entity-type ...` and `kg relation-type ...` catalog CRUD.
// Covers GET/POST/PATCH/DELETE /cms/kg/entity-types(/:id) and
// GET/POST/PATCH/DELETE /cms/kg/relation-types(/:id).
export function registerKgTaxonomyCommand(kg: Command): void {
  const entityType = kg.command("entity-type").description("Manage the KG entity-type catalog");

  entityType
    .command("list")
    .description("List entity types")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/entity-types"), TYPE_COLUMNS);
    }));

  entityType
    .command("create")
    .description("Create a custom entity type")
    .requiredOption("--slug <slug>", "Type slug")
    .requiredOption("--label <label>", "Display label (max 100 chars)")
    .option("--description <text>", "Description (max 2000 chars)")
    .option("--parent-id <id>", "Parent type UUID")
    .option("--properties-schema <json>", "JSON Schema (type:object, <=16KB)")
    .option("--is-interface", "Mark as an interface type")
    .option("--sensitivity-level <level>", "low|medium|high|critical")
    .option("--default-owner-group-id <id>", "Default owner group UUID")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/kg/entity-types", compact({
        slug: opts.slug,
        label: opts.label,
        description: opts.description,
        parentId: opts.parentId,
        propertiesSchema: parseJsonOption(opts.propertiesSchema, "--properties-schema"),
        isInterface: opts.isInterface ? true : undefined,
        sensitivityLevel: opts.sensitivityLevel,
        defaultOwnerGroupId: opts.defaultOwnerGroupId,
      })));
    }));

  entityType
    .command("update <id>")
    .description("Update an entity type (slug is immutable)")
    .option("--label <label>", "New label")
    .option("--description <text>", "New description")
    .option("--parent-id <id>", "Parent type UUID")
    .option("--properties-schema <json>", "JSON Schema (type:object, <=16KB)")
    .option("--is-interface", "Mark as an interface type")
    .option("--sensitivity-level <level>", "low|medium|high|critical")
    .option("--default-owner-group-id <id>", "Default owner group UUID")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch(`/cms/kg/entity-types/${id}`, compact({
        label: opts.label,
        description: opts.description,
        parentId: opts.parentId,
        propertiesSchema: parseJsonOption(opts.propertiesSchema, "--properties-schema"),
        isInterface: opts.isInterface ? true : undefined,
        sensitivityLevel: opts.sensitivityLevel,
        defaultOwnerGroupId: opts.defaultOwnerGroupId,
      })));
    }));

  entityType
    .command("delete <id>")
    .description("Delete an entity type")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.delete(`/cms/kg/entity-types/${id}`));
    }));

  const relationType = kg.command("relation-type").description("Manage the KG relation-type catalog");

  relationType
    .command("list")
    .description("List relation types")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/relation-types"), TYPE_COLUMNS);
    }));

  relationType
    .command("create")
    .description("Create a custom relation type")
    .requiredOption("--slug <slug>", "Type slug")
    .requiredOption("--label <label>", "Display label (max 100 chars)")
    .option("--description <text>", "Description (max 2000 chars)")
    .option("--parent-id <id>", "Parent type UUID")
    .option("--properties-schema <json>", "JSON Schema (type:object, <=16KB)")
    .option("--source-type-id <id>", "Allowed source entity-type UUID")
    .option("--target-type-id <id>", "Allowed target entity-type UUID")
    .option("--cardinality-min <n>", "Minimum cardinality (default 0)", (v) => parseInt(v, 10))
    .option("--cardinality-max <n>", "Maximum cardinality (unbounded if omitted)", (v) => parseInt(v, 10))
    .option("--is-reifiable", "Allow this relation to be reified")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/kg/relation-types", compact({
        slug: opts.slug,
        label: opts.label,
        description: opts.description,
        parentId: opts.parentId,
        propertiesSchema: parseJsonOption(opts.propertiesSchema, "--properties-schema"),
        sourceTypeId: opts.sourceTypeId,
        targetTypeId: opts.targetTypeId,
        cardinalityMin: opts.cardinalityMin,
        cardinalityMax: opts.cardinalityMax,
        isReifiable: opts.isReifiable ? true : undefined,
      })));
    }));

  relationType
    .command("update <id>")
    .description("Update a relation type (slug is immutable)")
    .option("--label <label>", "New label")
    .option("--description <text>", "New description")
    .option("--parent-id <id>", "Parent type UUID")
    .option("--properties-schema <json>", "JSON Schema (type:object, <=16KB)")
    .option("--source-type-id <id>", "Allowed source entity-type UUID")
    .option("--target-type-id <id>", "Allowed target entity-type UUID")
    .option("--cardinality-min <n>", "Minimum cardinality", (v) => parseInt(v, 10))
    .option("--cardinality-max <n>", "Maximum cardinality", (v) => parseInt(v, 10))
    .option("--is-reifiable", "Allow this relation to be reified")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch(`/cms/kg/relation-types/${id}`, compact({
        label: opts.label,
        description: opts.description,
        parentId: opts.parentId,
        propertiesSchema: parseJsonOption(opts.propertiesSchema, "--properties-schema"),
        sourceTypeId: opts.sourceTypeId,
        targetTypeId: opts.targetTypeId,
        cardinalityMin: opts.cardinalityMin,
        cardinalityMax: opts.cardinalityMax,
        isReifiable: opts.isReifiable ? true : undefined,
      })));
    }));

  relationType
    .command("delete <id>")
    .description("Delete a relation type")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.delete(`/cms/kg/relation-types/${id}`));
    }));
}
