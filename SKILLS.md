# LegacyLens as Skill Provider

LegacyLens can be used as a **Skill Provider** for AI agents (Claude Code, Cursor, Antigravity). This allows agents to use LegacyLens capabilities directly within their chat interface.

## 🎯 Strategy: Skill Provider vs Extension

**Why Skills Instead of IDE Extension?**

1. **Lower barrier to entry**: No need to install/manage extensions
2. **Works everywhere**: Any IDE that supports skills (Claude Code, Cursor, Antigravity)
3. **Focus on analysis**: We focus on core logic (context-builder, analyzer) not UI
4. **Agent-native**: Agents understand when and how to use skills automatically

## 📦 Available Skills

### 1. Architectural Context (`legacylens-get-map`)

**What it does**: Provides instant Project Map (dependency graph, imports/exports)

**When agent uses it**: 
- Needs to understand project structure
- Planning refactoring
- Finding where functions are used

**Command**: `legacylens get-map [path] --compact`

**Output**: JSON with tree, files, exports, imports

### 2. Legacy Audit (`legacylens-audit`)

**What it does**: Deep code analysis using three-level architecture

**When agent uses it**:
- User asks to "analyze codebase" or "find dead code"
- Needs refactoring plan
- Wants to understand technical debt

**Command**: `legacylens analyze [path] --format skill-context`

**Output**: Minimal JSON with deadCode, criticalIssues, refactoringPlan

### 3. Safe Clean (`legacylens-safe-clean`)

**What it does**: Safely removes dead code with Project Map verification

**When agent uses it**:
- User asks to "remove dead code"
- Before deleting code (safety check)
- After audit finds dead code

**Command**: `legacylens auto-fix [path] --dry-run` (preview) or `legacylens auto-fix [path]` (execute)

**Output**: Summary of removals

### 4. Detect Side-Effects (`legacylens-detect-side-effects`)

**What it does**: Before an important change, lists which files are affected (dependencies + dependents)

**When agent uses it**: User is about to change/rename/delete a file; need to know "which 15 files will this touch?"

**Command**: `legacylens affected <file> [path]`

**Output**: Dependencies (this file imports), Dependents (files that import this file)

### 5. Find Obsolete Logic (`legacylens-find-obsolete-logic`)

**What it does**: Uses semantic index to find code that duplicates newer project libraries or shared utilities

**When agent uses it**: Find "old way" code that can be replaced by the "new way" already in the project

**Commands**: `legacylens index` (once), then `legacylens find "<query>"` with intent-based queries

### 6. Clean House (`legacylens-clean-house`)

**What it does**: Full autonomous pass: audit → safe dead code removal → verify (0 broken imports)

**When agent uses it**: User asks for "full cleanup" or "remove all dead code" with verification

**Commands**: `legacylens analyze` → `legacylens auto-fix --dry-run` → `legacylens auto-fix` → `legacylens verify`

---

## 🔄 Multi-step Reasoning: Refactoring Roadmap

LegacyLens now outputs a **Refactoring Roadmap** in a format agents can execute step-by-step:

- Each step includes **target** (file to change) and **verification** (e.g. "Run npm test").
- In `--format skill-context`, the response includes a `roadmap` array: `Step 1: ... Target: ... Verify: ...`
- Agents (Cursor, Claude) can follow: Step 1 → do → verify → Step 2 → do → verify.

## 📌 Context-Pinning (Relevant Context)

To avoid context pollution, use **pinned context** — only the slice of the Project Map related to the file the user is working on:

- **Command**: `legacylens pin-context <file> [path]`
- **Output**: `focusFile`, `dependencies`, `dependents`, and `files` (only those in the subgraph).
- Option `--transitive`: include one more level of dependencies/dependents.

Agents can call this when the user has a file open and only need related context.

## ✅ Loop-based Verification (legacylens-verify)

After refactors or dead-code removal, verify that no imports are broken:

- **Command**: `legacylens verify [path]`
- **Output**: `OK: N imports checked, 0 broken. System stable.` or a list of broken imports.
- No AI call; pure static check over the Project Map.

Use after **auto-fix** or any bulk edit to confirm stability.

## 🚀 Installation

### One-command setup (recommended)

```bash
npx legacylens-cli setup-skills
```

This will:
- Detect your environment and copy all 6 LegacyLens skills into **Claude Code**, **Cursor**, and **Antigravity** config folders (creating them if needed)
- Check for `GEMINI_API_KEY` and warn if missing

Works on Windows, macOS, and Linux.

### Manual Quick Start

1. **Install LegacyLens CLI**:
   ```bash
   npm install -g legacylens-cli
   ```

2. **Set API key**:
   ```bash
   export GEMINI_API_KEY=your_key
   ```

3. **Install skills** (automatic):
   ```bash
   legacylens setup-skills
   ```
   Or copy skills by hand:
   ```bash
   # Claude Code
   cp -r skills/legacylens-* ~/.claude/skills/
   
   # Cursor
   cp -r skills/legacylens-* ~/Library/Application\ Support/Cursor/User/skills/
   
   # Antigravity
   cp -r skills/legacylens-* ~/.antigravity/skills/
   ```

4. **Restart your IDE/agent**

## 💡 How Agents Use Skills

### Example 1: Understanding Structure

**User**: "How is this project organized?"

**Agent** (using `legacylens-get-map`):
```bash
legacylens get-map . --compact
```

**Agent response**: "The project has 42 files organized as: src/ (core logic), tests/ (test files), utils/ (shared utilities). Main entry point is src/index.js which imports from..."

### Example 2: Finding Dead Code

**User**: "Find unused code"

**Agent** (using `legacylens-audit`):
```bash
legacylens analyze . --format skill-context
```

**Agent response**: "Found 5 dead code items:
1. src/utils/old.js:unusedFunction (High confidence - never imported)
2. src/components/Legacy.tsx:LegacyComponent (Medium confidence - replaced by NewComponent)
..."

### Example 3: Safe Removal

**User**: "Remove the dead code"

**Agent** (using `legacylens-safe-clean`):
```bash
legacylens auto-fix . --dry-run
```

**Agent response**: "Preview: Will remove 3 exports from 2 files. Dependencies checked: ✓ safe. Proceed? (y/n)"

## 🔧 Technical Details

### Skill-Context Format

The `--format skill-context` flag returns minimal JSON optimized for AI consumption:

```json
{
  "project": "my-project",
  "complexity": 75,
  "summary": "Executive summary...",
  "deadCode": [...],
  "criticalIssues": [...],
  "refactoringPlan": [...],
  "meta": {...}
}
```

**Benefits**:
- Compact (no pretty printing, saves tokens)
- Structured (guaranteed valid JSON)
- Actionable (arrays ready for iteration)

### Project Map Format

The `get-map` command returns:

```json
{
  "tree": {...},
  "files": [
    {
      "path": "src/utils/logger.js",
      "signatures": ["logInfo", "logError"],
      "exports": {"named": [...], "default": null},
      "imports": [...]
    }
  ],
  "summary": "..."
}
```

## 🎨 Skill Format

Skills follow Antigravity format:
- `SKILL.md` with YAML frontmatter
- Description of when to use
- Step-by-step instructions
- Example commands

See `skills/*/SKILL.md` for examples.

## 🔄 Integration Workflow

1. **Agent recognizes trigger**: User asks about "dead code", "structure", etc.
2. **Skill activates**: Agent reads `SKILL.md` and understands context
3. **Command executes**: Agent runs `legacylens` CLI command
4. **Results parsed**: Agent uses JSON output
5. **Response generated**: Agent presents findings naturally

## 🆚 Comparison: Skills vs Extension

| Feature | Skills | Extension |
|---------|--------|-----------|
| Installation | Copy folder | Install from marketplace |
| Works in | Any IDE with skills | VS Code only |
| Maintenance | Update SKILL.md | Update extension code |
| Focus | Core logic | UI + logic |
| Agent integration | Native | Manual |

## 📚 Next Steps

1. **Try skills**: Copy to your agent and test
2. **Customize**: Edit `SKILL.md` for your needs
3. **Contribute**: Add new skills or improve existing ones

## 🤝 Contributing

To add new skills:
1. Create `skills/your-skill/SKILL.md`
2. Follow Antigravity format
3. Test with your agent
4. Submit PR

## ⚠️ Requirements

- LegacyLens CLI installed globally
- Gemini API key set
- Agent supports skills (Claude Code, Cursor, Antigravity)
