# LegacyLens Architecture (Atlas / Codex-style)

This document describes the **hybrid engine** design, **three-level analysis architecture**, and the **Codex-style** modules (ContextEngine, SemanticIndexer, CodeGenerator) and the planned **Code Execution** feature.

---

## 0. Three-Level Analysis Architecture

LegacyLens uses a **three-level analysis architecture** that makes it faster and deeper than traditional AI code analysis:

### Level 1: Architectural Skeleton (Local)
- **Speed:** Pure Node.js code, runs at light speed
- **What:** Extracts signatures, imports, exports from all files locally
- **Result:** Complete dependency graph - sees every connection, even through 3 intermediate modules
- **Implementation:** `context-builder.js` builds Project Map in seconds

### Level 2: Semantic Compression (Semantic Mapping)
- **What:** Sends Project Map instead of raw code to AI
- **Benefit:** Instead of reading 1000 lines where 800 are brackets and stdlib, AI gets compressed "logical snapshot"
- **Result:** Model sees entire project at once (thanks to 1M context), finds bugs across frontend/backend/database in different folders
- **Implementation:** Project Map summary prepended to prompts

### Level 3: Targeted Deep Dive (On-Demand)
- **What:** If Project Map shows suspicious node (complex class with many dependencies), LegacyLens does Targeted Deep Dive
- **Process:** Pulls full text of that specific file for detailed audit
- **Analogy:** Like medical consultation: first look at X-ray (skeleton), then MRI specific area
- **Implementation:** `identifySuspiciousFiles()` finds complex files, adds full content to prompt

**Why this is "Deeper" than competitors:**

| Parameter | Regular AI Chat (Claude/GPT) | LegacyLens |
|----------|----------------------------|------------|
| Overview | Only what you copied | Entire repository (Project Map) |
| Connections | Guesses by names | Knows exactly (Graph of Edges) |
| Context | Loses thread on large files | Keeps structure in cache |
| Time | Long text loading | 30 sec for architectural conclusion |

---

## 1. Engine selection per task

We do **not** use one model for everything. Each task uses the right engine:

| Engine | Model (default) | Role | Tasks |
|-------|------------------|------|--------|
| **Flash** | `gemini-3-flash-preview` | Workhorse, 1M context | Full-repo scan, dead code, docs, quick fixes, code generation |
| **Pro** | `gemini-3-pro-preview` | Architect | Complex refactoring, DB design, new feature design |
| **Embedding** | `gemini-embedding-001` | Vectors | Semantic index: find code by meaning (e.g. "auth logic" in `utils_old_2.js`) |

Configuration:

- **Environment:** `GEMINI_MODEL_FLASH`, `GEMINI_MODEL_PRO`, `GEMINI_MODEL_EMBEDDING`
- **File:** `.legacylens.json` → `"engines": { "flash": "...", "pro": "...", "embedding": "..." }`
- **CLI:** `--model <name>` overrides the model for the current command (e.g. analyze).

**Code:** `src/core/engines.js` — `getModelForTask(task)`, `getEmbeddingModel()`.  
Analyze command uses **Flash** by default for audit (see `getModelForTask('audit')`).

---

## 2. New modules (Codex-style)

### Context Builder (`src/core/context-builder.js`) — **Intelligence core**

- **Role:** Turn a chaotic set of files into a **structured Project Map** that Gemini can consume in one shot (1M context). "Better than Codex": Codex forgets files not open in the editor; we index the whole repo so e.g. "Change logging logic" finds `src/utils/logger.js`, `src/core/scanner.js` and all call sites.
- **Responsibilities:** Ignore junk (node_modules, dist, logs, .git); build project tree; extract function/class signatures; extract **imports/exports** so the model understands relationships.
- **Output:** `{ tree, files: [{ path, signatures, imports, exports }], summary }` and `getProjectMapForPrompt()` → string for prompts.
- **API:** `buildProjectMap(projectPath, options)`, `getProjectMapForPrompt()`, `extractSignatures()`, `extractImports()`, `extractExports()`.

### ContextEngine (`src/core/context-engine.js`)

- **Role:** Thin layer that **delegates to context-builder**. Builds the project map before each AI action so the model does not hallucinate.
- **Usage:** Prepended to prompts in CodeGenerator; same API as before for compatibility.
- **API:** `getContextForPrompt(projectPath, options)` → string (from context-builder); `buildProjectMap()` → `{ structure, interfaces, map }`.

### SemanticIndexer (`src/core/semantic-indexer.js`)

- **Role:** Turn code into **vectors** (Gemini Embedding). Atlas can find “where is auth” without re-reading the whole repo.
- **Storage:** `.legacylens-index.json` in the project (chunks + embeddings).
- **CLI:** `legacylens index [project]` — build index; `legacylens find "<query>" [project]` — semantic search.
- **API:** `buildIndex()`, `saveIndex()`, `loadIndex()`, `search(query, indexData, apiKey, embeddingModel, topK)`.

### CodeGenerator (`src/core/code-generator.js`)

- **Role:** Use **Flash** to generate code and write it to files (e.g. new API route).
- **Context:** ContextEngine provides the project map; model is instructed to output a single code block.
- **Framework Detection:** Automatically detects framework (Express, FastAPI, Flask, Django, Koa, Next.js) from `package.json`/`requirements.txt`.
- **Context-Aware:** Generates code matching project's framework and coding style.
- **CLI:** `legacylens create-api --route /users [project]` — generates framework-appropriate code.
- **API:** `detectFramework()`, `generateCode()`, `createApiRoute()`, `writeToFile()`.

### AutoFix (`src/core/auto-fix.js`)

- **Role:** Safely remove dead code using Project Map and AI confirmation.
- **Process:** Finds unused exports → AI confirms safety → Removes with user confirmation.
- **Safety:** Checks for public API, dynamic usage, plugin systems before removal.
- **CLI:** `legacylens auto-fix [project]` — removes dead exports; `--dry-run` for preview.
- **API:** `findDeadExports()`, `confirmSafeToRemove()`, `removeExportFromFile()`, `autoFix()`.

---

## 3. Code Execution (planned “killer feature”)

Gemini 3 Flash with **Code Execution** support would allow:

1. **Write a test** (e.g. unit test for a new function).
2. **Run the test** (tool/API runs the test in a sandbox).
3. **If it fails** — rewrite the code and re-run until it passes.

That is the **autonomous agent** level for Atlas: the tool not only suggests changes but verifies them by executing tests.

Implementation outline (when the API supports it):

- New module: `src/core/code-executor.js` (or use Gemini’s built-in execution).
- Flow: `generate test` → `run test` → if fail → `generate fix` → `run test` (loop with a max number of steps).
- CLI: e.g. `legacylens fix-test --file path/to/test.js` or `legacylens agent "add login endpoint and tests"`.

---

## 4. File layout

```
src/
├── core/
│   ├── ai-client.js       # Gemini generate (audit schema)
│   ├── engines.js         # Flash / Pro / Embedding selection
│   ├── context-engine.js  # Project map (structure + interfaces)
│   ├── semantic-indexer.js# Embeddings + vector search
│   ├── code-generator.js   # Generate code, create-api, framework detection
│   ├── auto-fix.js        # Smart dead code removal with AI confirmation
│   ├── scanner.js
│   └── gitignore.js
├── reports/
├── utils/
└── cli.js                 # Commands: analyze, index, find, create-api, auto-fix
```

---

## 5. CLI commands summary

| Command | Engine | Description |
|---------|--------|-------------|
| `legacylens [project]` | Flash | Analyze project (audit, dead code, refactoring plan). |
| `legacylens index [project]` | Embedding | Build semantic index (`.legacylens-index.json`). |
| `legacylens find "<query>" [project]` | Embedding | Semantic search in indexed code. |
| `legacylens create-api --route <path> [project]` | Flash | Generate API route (auto-detects framework). |
| `legacylens auto-fix [project]` | Flash | Remove dead code with AI confirmation. |

Optional global options: `-k, --api-key`, `-v, --verbose`, `-q, --quiet`, `--log-file`.
