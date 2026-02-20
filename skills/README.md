# LegacyLens Agent Skills

LegacyLens skills enable AI agents (Claude Code, Cursor, Antigravity) to use LegacyLens capabilities directly within their chat interface.

## 🎯 What Are Skills?

Skills are instructions that tell AI agents **when** and **how** to use LegacyLens. Instead of forcing developers to leave their IDE, agents can call LegacyLens commands automatically when needed.

## 📦 Available Skills

### 1. `legacylens-get-map` - Architectural Context
**Purpose**: Get complete project structure and dependency graph

**When to use**: When agent needs to understand project structure, imports/exports, or file relationships

**Command**: `legacylens get-map [path] --compact`

### 2. `legacylens-audit` - Legacy Code Analysis
**Purpose**: Deep code audit with three-level analysis (skeleton → semantic → deep dive)

**When to use**: When analyzing code quality, finding dead code, or creating refactoring plans

**Command**: `legacylens analyze [path] --format skill-context`

### 3. `legacylens-safe-clean` - Safe Dead Code Removal
**Purpose**: Safely remove dead code with Project Map verification

**When to use**: Before deleting code to ensure it's not used elsewhere

**Command**: `legacylens auto-fix [path] --dry-run` (preview) or `legacylens auto-fix [path]` (execute)

### 4. `legacylens-detect-side-effects` - Side-Effect Detection
**Purpose**: Before changing a file, list which files are affected (dependencies + dependents)

**When to use**: Before refactoring, renaming, or deleting; "what will break if I change this?"

**Command**: `legacylens affected <file> [path]`

### 5. `legacylens-find-obsolete-logic` - Find Obsolete Logic
**Purpose**: Use semantic index to find code that duplicates newer project libraries

**When to use**: Find "old way" code replaceable by the "new way" already in the project

**Commands**: `legacylens index`, then `legacylens find "<query>"`

### 6. `legacylens-clean-house` - Full Cleanup with Verification
**Purpose**: Audit → safe dead code removal → verify (0 broken imports)

**When to use**: "Clean up the project" / "remove all dead code" with a verification step

**Commands**: `analyze` → `auto-fix --dry-run` → `auto-fix` → `verify`

## 🚀 Installation

### One-command setup (recommended)

```bash
npx legacylens-cli setup-skills
```

This copies all 6 skills into Claude Code, Cursor, and Antigravity config folders and checks for `GEMINI_API_KEY`. Works on Windows, macOS, and Linux.

### For Claude Code (manual)

1. Copy skills to your Claude skills directory:
   ```bash
   cp -r skills/legacylens-* ~/.claude/skills/
   ```
   Or run: `legacylens setup-skills`

2. Restart Claude Code

### For Cursor

1. Copy skills to your Cursor skills directory:
   ```bash
   # Windows
   cp -r skills/legacylens-* %APPDATA%\Cursor\User\skills\
   
   # macOS
   cp -r skills/legacylens-* ~/Library/Application\ Support/Cursor/User/skills/
   
   # Linux
   cp -r skills/legacylens-* ~/.config/Cursor/User/skills/
   ```

2. Restart Cursor

### For Antigravity

1. Copy skills to your Antigravity skills directory:
   ```bash
   cp -r skills/legacylens-* ~/.antigravity/skills/
   ```

2. Restart Antigravity

## 📋 Prerequisites

- LegacyLens CLI installed: `npm install -g legacylens-cli`
- Gemini API key set: `export GEMINI_API_KEY=your_key`

## 💡 How It Works

1. **Agent recognizes trigger**: User asks about "project structure", "dead code", etc.
2. **Skill activates**: Agent reads `SKILL.md` and understands when to use it
3. **Command executes**: Agent runs `legacylens` CLI command
4. **Results parsed**: Agent uses `--format skill-context` for machine-readable output
5. **Response generated**: Agent presents findings in natural language

## 🔄 Example Workflow

**User**: "Find dead code in this project"

**Agent** (using `legacylens-audit` skill):
1. Runs: `legacylens analyze . --format skill-context`
2. Parses JSON response
3. Presents: "Found 5 dead code items: ..."
4. Suggests: "Use `legacylens-safe-clean` to remove them safely"

**User**: "Remove them"

**Agent** (using `legacylens-safe-clean` skill):
1. Runs: `legacylens auto-fix . --dry-run` (preview)
2. Shows what will be removed
3. Asks for confirmation
4. Runs: `legacylens auto-fix .` (execute)

## 🎨 Skill Format

Each skill follows the Antigravity skill format:
- `SKILL.md` with YAML frontmatter
- Description of when to use
- Step-by-step instructions
- Example commands and outputs

## 🔧 Customization

You can customize skills by editing `SKILL.md` files:
- Change trigger conditions
- Add project-specific instructions
- Modify command flags

## 📚 Learn More

- [LegacyLens CLI Documentation](../README.md)
- [Antigravity Skills Documentation](https://antigravity.codes/agent-skills/documentation)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## 🤝 Contributing

To add new skills:
1. Create new directory: `skills/your-skill-name/`
2. Add `SKILL.md` following the format
3. Test with your AI agent
4. Submit PR

## ⚠️ Important Notes

- Skills require LegacyLens CLI to be installed and accessible in PATH
- API key must be set (via env var or `--api-key` flag)
- Skills use `--format skill-context` for optimal AI consumption
- Always use `--dry-run` with `auto-fix` before executing
