<div align="center">

# 🕵️‍♂️ LegacyLens
### The AI-Powered Code Janitor

**Stop hoarding dead code. Let AI clean up your technical debt.**

[![npm version](https://img.shields.io/npm/v/legacylens-cli?color=blue)](https://www.npmjs.com/package/legacylens-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Powered by Gemini](https://img.shields.io/badge/AI-Gemini%20Flash-magenta)](https://deepmind.google/technologies/gemini/)

[Quick Start](#-quick-start) • [Features](#-features) • [Configuration](#-configuration) • [Privacy](#-privacy--security)

</div>

---

## 🧐 What is LegacyLens?

**LegacyLens** is a CLI tool that helps developers audit, refactor, and clean up legacy codebases.

Unlike traditional linters that check *syntax*, LegacyLens uses **Google Gemini AI** to understand *context*. It identifies files that are technically valid but logically useless, abandoned, or redundant.

> "It's like having a Senior Architect review your project in 30 seconds."

## ✨ Features

- **🧠 Context-Aware Audit:** Uses Gemini 2.0 Flash to understand project structure, not just Regex.
- **🧹 Dead Code Detection:** Identifies unused files, abandoned modules, and "zombie" functions.
- **🛡️ Secure & Private:** **BYOK** (Bring Your Own Key). Your code goes directly to Google's API. No intermediate servers.
- **⚡ Blazing Fast:** Optimized "Flash" models + intelligent caching + parallel file reading.
- **🤖 Structured Output:** Uses **JSON Schema Response** mode to guarantee valid data for CI/CD pipelines.
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

## 📊 Example Output

LegacyLens generates a clean, professional report (HTML or Markdown) highlighting:

- **Risk Score:** 0-100 score of your technical debt.
- **Critical Files:** List of files recommended for deletion (status: "delete").
- **Refactoring Candidates:** Files that are too complex or outdated.

## ⚙️ Configuration

You can customize the behavior by creating a `.legacylens.json` file in your project root:

```json
{
  "include": [".js", ".ts", ".jsx", ".py", ".go"],
  "ignore": ["coverage", "dist", "legacy-backup"],
  "model": "gemini-2.0-flash",
  "maxFileSize": 50000,
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

- **Gemini 1.5/2.0 Flash:** Free tier is usually sufficient for most projects.
- **You pay $0 to us.** You only use your own Google API quota.

## 🛡️ Privacy & Security

- **No Data Collection:** We do not collect your code, keys, or data.
- **Direct Connection:** The CLI connects directly from your machine to `generativelanguage.googleapis.com`.
- **Local Processing:** File filtering and `.gitignore` parsing happen locally before sending context to AI.

## 🗺️ Roadmap

- [x] Remove Python dependency (Pure Node.js)
- [x] Implement JSON Schema Response
- [x] Add HTML/Markdown reports
- [ ] Auto-Fix Mode: Automatically delete "dead" files identified by AI.
- [ ] IDE Extension: VS Code plugin.

## 📄 License

MIT © LegacyLens Team

<div align="center"> <sub>Built with ❤️ in Ukraine 🇺🇦</sub> </div>
