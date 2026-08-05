import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, createClient, compact } from "../utils/command-helpers.js";
import { Category } from "../types/api-types.js";

const CATEGORY_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "slug", header: "Slug" },
  { key: "parentId", header: "Parent" },
  { key: "status", header: "Status" },
];

export function registerCategoryCommand(program: Command): void {
  const cat = program.command("category").alias("cat").description("Manage categories");

  cat
    .command("list")
    .description("List all categories")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint<Category[]>(cmd, (c) => c.get("/cms/categories"), CATEGORY_COLUMNS);
    }));

  cat
    .command("tree")
    .description("Get hierarchical category tree")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint<Category[]>(cmd, (c) => c.get("/cms/categories/tree"));
    }));

  cat
    .command("get <id>")
    .description("Get category details")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint<Category>(cmd, (c) => c.get(`/cms/categories/${id}`));
    }));

  cat
    .command("create")
    .description("Create a category")
    .requiredOption("--name <name>", "Category name")
    .option("--parent-id <id>", "Parent category ID")
    .option("--description <desc>", "Description")
    .option("--icon <icon>", "Icon")
    .option("--sort-order <n>", "Sort order")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint<Category>(cmd, (c) => c.post("/cms/categories", compact({
        name: opts.name,
        parentId: opts.parentId,
        description: opts.description,
        icon: opts.icon,
        sortOrder: opts.sortOrder !== undefined ? Number(opts.sortOrder) : undefined,
      })));
    }));

  cat
    .command("update <id>")
    .description("Update a category")
    .option("--name <name>", "New name")
    .option("--description <desc>", "New description")
    .option("--parent-id <id>", "New parent category ID")
    .option("--icon <icon>", "New icon")
    .option("--sort-order <n>", "New sort order")
    .option("--status <status>", "New status (active|inactive)")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint<Category>(cmd, (c) => c.put(`/cms/categories/${id}`, compact({
        name: opts.name,
        description: opts.description,
        parentId: opts.parentId,
        icon: opts.icon,
        sortOrder: opts.sortOrder !== undefined ? Number(opts.sortOrder) : undefined,
        status: opts.status,
      })));
    }));

  cat
    .command("delete <id>")
    .description("Delete a category")
    .action(withErrorHandler(async (cmd, id) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/categories/${id}`);
      console.log("Category deleted.");
    }));
}
