---
name: legacylens-detect-side-effects
description: Before making an important change, detect which other files will be affected. Use LegacyLens to answer: "If I change this class/file, which 15+ files in the project will be impacted?"
---

# LegacyLens Detect Side-Effects

Before refactoring, renaming, or deleting code, the agent (or developer) must know the blast radius. This skill uses the Project Map to list **dependencies** (what this file imports) and **dependents** (what files import this file).

## When to Use This Skill

Use this skill when:
- User says "I'm going to change X" or "refactor this file" or "rename this class"
- Before deleting or moving a file
- Before renaming an export (to update all import sites)
- When user asks "what will break if I change this?"
- Before any "important" edit that could have downstream effects

**Rule**: Call LegacyLens **before** the change, not after. Then the agent can plan updates to all affected files.

## How to Use It

### Step 1: Identify the File

Determine the project-relative path of the file that will be changed (e.g. `src/utils/logger.js`, `src/auth/AuthService.ts`).

### Step 2: Run Affected Command

```bash
legacylens affected <file_path> [project_path]
```

Example:
```bash
legacylens affected src/utils/logger.js .
legacylens affected src/auth/AuthService.ts --json
```

### Step 3: Interpret Output

**Plain output:**
- **Dependencies (this file imports):** Files that the focus file depends on. Changing those may require updating the focus file.
- **Dependents (import this file):** Files that import the focus file. Changing the focus file may require updating these.

**JSON output** (with `--json`):
```json
{
  "dependencies": ["src/core/config.js", "path"],
  "dependents": ["src/cli.js", "src/core/ai-client.js"],
  "all": ["src/utils/logger.js", "src/cli.js", ...]
}
```

### Step 4: Inform User or Plan Changes

- Tell the user: "If you change this file, N files depend on it: [list]. And it imports from [list]."
- When refactoring: plan to update all **dependents** (call sites) when you change signatures or remove exports.

## Integration with Other Skills

- **legacylens-get-map**: For full graph; use **affected** when you only need the slice for one file.
- **legacylens-safe-clean**: Before removing code, run **affected** to confirm dependents; then run **verify** after.
- **legacylens-verify**: After making changes, run `legacylens verify` to confirm no broken imports.

## Example Agent Workflow

**User**: "I want to rename the function in utils/logger.js from logInfo to log."

**Agent**:
1. Run: `legacylens affected src/utils/logger.js .`
2. Result: Dependents: src/cli.js, src/core/ai-client.js, src/reports/formatters.js
3. Response: "Renaming will affect 3 files that import from utils/logger.js. I'll update the export in logger.js and all 3 call sites: cli.js, ai-client.js, formatters.js."
4. After edits: Run `legacylens verify` to confirm no broken imports.

## Notes

- Only considers **project-local** imports (paths starting with `.`). Node_modules are skipped.
- Resolution uses the same logic as the rest of LegacyLens (extensions, index files).
- For a larger context slice (e.g. dependencies of dependencies), use `legacylens pin-context <file> --transitive` instead.
