# Installing the `agentbrain` skill

This skill teaches an AI agent how to use the `agentbrain` CLI (npm package
`agentbrain-cli`) end-to-end. Install it once per machine or per project.

## Prerequisite

Install the CLI itself:

```bash
npm install -g agentbrain-cli    # or: pnpm add -g agentbrain-cli
agentbrain --version
```

Requires Node.js ≥ 20.

## Option A — Install with `skills` CLI (recommended)

The [`skills`](https://www.skills.sh/) CLI wires an Agent Skill into the
Claude configuration in one command.

```bash
npx skills add nextlevelbuilder/agentbrain-cli
```

`skills add <owner>/<repo>` fetches the skill from this GitHub repo. To disable
telemetry:

```bash
DISABLE_TELEMETRY=1 npx skills add nextlevelbuilder/agentbrain-cli
```

If the CLI can't locate the skill inside the repo (this skill lives at
`.claude/skills/agentbrain/`), fall back to Option B below.

## Option B — Manual install (user scope, all projects)

Copy the skill into your global Claude skills directory:

```bash
mkdir -p ~/.claude/skills
git clone --depth=1 https://github.com/nextlevelbuilder/agentbrain-cli \
  /tmp/agentbrain-cli-src
cp -r /tmp/agentbrain-cli-src/.claude/skills/agentbrain ~/.claude/skills/
rm -rf /tmp/agentbrain-cli-src
```

The skill is now available to Claude Code, Claude Agent SDK, and any tool that
loads user-scope skills from `~/.claude/skills/`.

## Option C — Manual install (project scope, single repo)

To install only for one project (skill activates only when working in that
repo):

```bash
mkdir -p .claude/skills
git clone --depth=1 https://github.com/nextlevelbuilder/agentbrain-cli \
  /tmp/agentbrain-cli-src
cp -r /tmp/agentbrain-cli-src/.claude/skills/agentbrain .claude/skills/
rm -rf /tmp/agentbrain-cli-src
```

## Verify

Start a fresh Claude session in a directory where the skill is installed and
ask something like _"how do I upload a document to AgentBrain?"_ — the agent
should activate this skill and answer with the `agentbrain media upload` flow.

You can also confirm the file exists:

```bash
ls -la ~/.claude/skills/agentbrain/SKILL.md          # user scope
ls -la ./.claude/skills/agentbrain/SKILL.md          # project scope
```

## Update

```bash
# skills CLI: re-run add
npx skills add nextlevelbuilder/agentbrain-cli

# Manual: overwrite the copy
git clone --depth=1 https://github.com/nextlevelbuilder/agentbrain-cli /tmp/ab
cp -r /tmp/ab/.claude/skills/agentbrain/* ~/.claude/skills/agentbrain/
rm -rf /tmp/ab
```

## Uninstall

```bash
rm -rf ~/.claude/skills/agentbrain            # user scope
rm -rf ./.claude/skills/agentbrain            # project scope
```

## Report an issue

- CLI bugs → https://github.com/nextlevelbuilder/agentbrain-cli/issues
- Skill content bugs → same repo, prefix issue with `skill:`
