<div align="center">

# 🕵️‍♂️ LegacyLens
### The AI-Powered Code Janitor

**Stop hoarding dead code. Let AI clean up your technical debt.**

[![npm version](https://img.shields.io/npm/v/legacylens-cli?color=blue)](https://www.npmjs.com/package/legacylens-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Powered by Gemini](https://img.shields.io/badge/AI-Gemini%203-magenta)](https://deepmind.google/technologies/gemini/)

[Quick Start](#-quick-start) • [Features](#-features) • [Configuration](#-configuration) • [Privacy](#-privacy--security)

</div>

---

## 🧐 What is LegacyLens?

**LegacyLens** is a CLI tool that helps developers audit, refactor, and clean up legacy codebases.

Unlike traditional linters that check *syntax*, LegacyLens uses **Google Gemini AI** with a **three-level analysis architecture**:

1. **Level 1 (Architectural Skeleton):** Extracts signatures, imports/exports locally in seconds
2. **Level 2 (Semantic Compression):** Sends compressed Project Map instead of raw code
3. **Level 3 (Targeted Deep Dive):** Full content analysis for complex/suspicious files

This makes LegacyLens **faster and deeper** than traditional AI code analysis - it sees the entire repository structure and connections, not just what you copy-paste.

> "It's like having a Senior Architect review your project in 30 seconds."

## ✨ Features

- **🧠 Three-Level Analysis Architecture:**
  - **Level 1:** Local extraction of signatures, imports/exports (lightning fast)
  - **Level 2:** Compressed Project Map sent to AI (sees entire repo structure)
  - **Level 3:** Targeted Deep Dive for complex/suspicious files (full content analysis)
- **🗺️ Project Map Integration:** Automatically builds a structured map of your codebase (imports/exports, signatures) for better analysis.
- **🔍 Semantic Indexing:** Optional semantic search using Gemini Embedding to find code by meaning.
- **🧹 Enhanced Dead Code Detection:** Uses Project Map to identify unused exports and imports automatically.
- **🔧 Smart Auto-Fix:** Automatically removes dead code with AI confirmation (safe, conservative approach).
- **🎯 Context-Aware Code Generation:** Auto-detects framework (Express, FastAPI, Flask, Django) and generates matching code.
- **🛡️ Secure & Private:** **BYOK** (Bring Your Own Key). Your code goes directly to Google's API. No intermediate servers.
- **⚡ Blazing Fast:** Optimized Gemini 3 Flash models + intelligent caching + parallel file reading.
- **🤖 Structured Output:** Uses **JSON Schema Response** mode to guarantee valid data for CI/CD pipelines.
- **📊 Visual Reports:** Includes Mermaid diagrams showing project structure and dependencies.
- **📦 Zero Config:** Respects your `.gitignore` automatically. No Python required. Pure Node.js.

## 🚀 Quick Start

### 1. Get a Free API Key
LegacyLens uses Google Gemini API. The free tier is generous (15 RPM, 1M TPM).
[👉 Get your API Key here](https://aistudio.google.com/app/apikey)

### 2. Run without installing (Recommended)
Just run it in your project folder. It will prompt for the key or read it from env.

```bash
# Linux/macOS
export GEMINI_API_KEY="your_key_here"
npx legacylens-cli .

# Windows (PowerShell)
$env:GEMINI_API_KEY="your_key_here"
npx legacylens-cli .
```

### 3. Or Install Globally
```bash
npm install -g legacylens-cli
legacylens ./my-project --output audit.html
```

## 📋 CLI Commands

### Analyze (Default)
```bash
# Basic analysis
legacylens [project]

# With options
legacylens . --format html --output report.html --verbose
```

### Semantic Indexing
```bash
# Build semantic index for code search
legacylens index [project]

# Search code by meaning
legacylens find "authentication logic" [project] --top 10
```

### Code Generation
```bash
# Generate API route (auto-detects framework: Express, FastAPI, Flask, etc.)
legacylens create-api --route /users [project] --out routes/users.js
```

### Setup Agent Skills (Cursor, Claude Code, Antigravity)

```bash
# One-time: install LegacyLens skills into detected IDEs and check API key
npx legacylens-cli setup-skills
# or, if installed globally:
legacylens setup-skills
```

### Smart Auto-Fix
```bash
# Find and remove dead code (with AI confirmation)
legacylens auto-fix [project]

# Dry run (see what would be removed)
legacylens auto-fix [project] --dry-run
```

## 📊 Example Output

LegacyLens generates a clean, professional report (HTML or Markdown) highlighting:

- **Complexity Score:** 0-100 score of your technical debt.
- **Dead Code Detection:** Specific unused functions, variables, and files with confidence levels.
- **Critical Issues:** Security vulnerabilities, hardcoded paths, and architectural problems.
- **Actionable Refactoring Plan:** Concrete "Before/After" code examples for improvements.
- **Visual Diagrams:** Mermaid flowcharts showing project structure and import/export relationships.

## 🎯 Advanced Features

### Three-Level Analysis Architecture

**Level 1 - Architectural Skeleton (Local):**
- Extracts signatures, imports/exports from all files in seconds
- Pure Node.js code - runs at light speed
- Builds complete dependency graph - sees every connection

**Level 2 - Semantic Compression:**
- Sends compressed Project Map instead of raw code
- AI sees entire repository structure at once (1M context)
- Finds bugs across frontend/backend/database in different folders

**Level 3 - Targeted Deep Dive:**
- Identifies suspicious/complex files (high exports/imports)
- Adds full content of these files for detailed audit
- Like medical consultation: X-ray first, then MRI specific area

### Project Map (Automatic)
Every analysis automatically builds a Project Map that includes:
- Project folder structure
- Function/class signatures
- Import/export relationships
- Used to enhance dead code detection and enable three-level analysis

### Semantic Indexing (Optional)
Build a semantic index for instant code search. The index is automatically detected and used during analysis if available.

## ⚙️ Configuration

You can customize the behavior by creating a `.legacylens.json` file in your project root:

```json
{
  "include": [".js", ".ts", ".jsx", ".py", ".go"],
  "ignore": ["coverage", "dist", "legacy-backup"],
  "engines": {
    "flash": "gemini-3-flash-preview",
    "pro": "gemini-3-pro-preview",
    "embedding": "gemini-embedding-001"
  },
  "maxFileSize": 50000,
  "maxContextSize": 1000000,
  "outputFormat": "html"
}
```

## 🤖 CI/CD Integration

LegacyLens is designed for pipelines. It returns a JSON report and proper exit codes.

```yaml
# GitHub Actions Example
- name: Run LegacyLens Audit
  run: npx legacylens-cli . --format json --output report.json
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

## 💸 Cost (It's Free)

LegacyLens is Open Source. The cost depends on the AI model you use.

- **Gemini 3 Flash:** Free tier is usually sufficient for most projects (15 RPM, 1M TPM).
- **Gemini 3 Pro:** For complex architecture tasks (higher cost, better reasoning).
- **Gemini Embedding:** Very affordable for semantic indexing ($0.15 per 1M tokens).
- **You pay $0 to us.** You only use your own Google API quota.

## 🛡️ Privacy & Security

- **No Data Collection:** We do not collect your code, keys, or data.
- **Direct Connection:** The CLI connects directly from your machine to `generativelanguage.googleapis.com`.
- **Local Processing:** File filtering and `.gitignore` parsing happen locally before sending context to AI.

## 🗺️ Roadmap

- [x] Remove Python dependency (Pure Node.js)
- [x] Implement JSON Schema Response
- [x] Add HTML/Markdown reports
- [x] Project Map integration for better context
- [x] Semantic indexing with Gemini Embedding
- [x] Code generation (create-api command)
- [x] Mermaid diagrams in reports
- [x] Gemini 3 models integration
- [x] Auto-Fix Mode: Automatically remove dead code with AI confirmation
- [x] Context-Aware Code Generation: Framework detection and style matching
- [x] VS Code Extension: Architecture designed (see `vscode-extension/`)
- [ ] Code Execution: Run tests and auto-fix until they pass.
- [ ] VS Code Extension: Implementation (in progress)

## 📄 License

MIT © LegacyLens Team

<div align="center"> <sub>Built with ❤️ in Ukraine 🇺🇦</sub> </div>
