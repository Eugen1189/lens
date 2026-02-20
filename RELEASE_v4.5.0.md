# LegacyLens v4.5.0 — First AI-Agentic Code Auditor

**We don't just chat, we analyze, clean, and verify.**

---

## What's New

### 🎯 LegacyLens as Skill Provider

Use LegacyLens **inside** Claude Code, Cursor, and Antigravity. Six agent skills let your AI assistant:

| Skill | What it does |
|-------|----------------|
| **get-map** | Get full Project Map (dependency graph) |
| **audit** | Deep legacy analysis with `--format skill-context` |
| **safe-clean** | Remove dead code with Project Map verification |
| **detect-side-effects** | "If I change this file, which 15 files are affected?" |
| **find-obsolete-logic** | Semantic search for duplicate/old patterns |
| **clean-house** | Audit → auto-fix → verify in one loop |

**One-command setup:**
```bash
npx legacylens-cli setup-skills
```
Installs skills into detected IDEs and checks `GEMINI_API_KEY`.

---

### 📋 Refactoring Roadmap (multi-step for agents)

Analysis now outputs **executable steps** for agents:

- Each step has **target** (file to change) and **verification** (e.g. "Run npm test").
- `--format skill-context` includes a `roadmap` array: *Step 1: … Target: … Verify: …*
- Cursor/Claude can follow: Step 1 → do → verify → Step 2 → …

---

### 📌 Context-Pinning

Reduce context pollution: get only the slice of the Project Map for the file you’re editing.

```bash
legacylens pin-context src/utils/logger.js
```

Returns only dependencies + dependents (option: `--transitive`).

---

### ✅ Loop-based Verification

After refactors or dead-code removal, confirm nothing is broken:

```bash
legacylens verify
```

Output: *OK: N imports checked, 0 broken. System stable.* (or a list of broken imports.)

---

### 🔧 New CLI Commands

- `legacylens get-map [path]` — Export Project Map as JSON
- `legacylens pin-context <file> [path]` — Pinned context for one file
- `legacylens affected <file> [path]` — List dependencies + dependents
- `legacylens verify [path]` — Verify all imports resolve
- `legacylens setup-skills` — Install skills into IDEs + check API key

---

## Install

```bash
npm install -g legacylens-cli
legacylens setup-skills
```

Or run without installing:

```bash
npx legacylens-cli setup-skills
npx legacylens-cli . --format skill-context
```

---

## Links

- [README](https://github.com/Eugen1189/lens#readme)
- [SKILLS.md](https://github.com/Eugen1189/lens/blob/main/SKILLS.md) — Skill Provider strategy & installation
- [CHANGELOG](https://github.com/Eugen1189/lens/blob/main/CHANGELOG.md)
