import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, createClient } from "../utils/command-helpers.js";
import { Tag } from "../types/api-types.js";

const TAG_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "slug", header: "Slug" },
  { key: "color", header: "Color" },
  { key: "status", header: "Status" },
];

export function registerTagCommand(program: Command): void {
  const tag = program.command("tag").description("Manage tags");

  tag
    .command("list")
    .description("List all tags")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint<Tag[]>(cmd, (c) => c.get("/cms/tags"), TAG_COLUMNS);
    }));

  tag
    .command("get <id>")
    .description("Get tag details")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint<Tag>(cmd, (c) => c.get(`/cms/tags/${id}`));
    }));

  tag
    .command("create")
    .description("Create a tag")
    .requiredOption("--name <name>", "Tag name")
    .option("--color <hex>", "Tag color (hex)")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint<Tag>(cmd, (c) => c.post("/cms/tags", {
        name: opts.name,
        color: opts.color,
      }));
    }));

  tag
    .command("update <id>")
    .description("Update a tag")
    .option("--name <name>", "New name")
    .option("--color <hex>", "New color")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint<Tag>(cmd, (c) => c.put(`/cms/tags/${id}`, {
        name: opts.name,
        color: opts.color,
      }));
    }));

  tag
    .command("delete <id>")
    .description("Delete a tag")
    .action(withErrorHandler(async (cmd, id) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/tags/${id}`);
      console.log("Tag deleted.");
    }));
}
