# Change Log

All notable changes to the LegacyLens CLI will be documented in this file.

## [4.5.0] - 2026-02-20

### 🎉 First AI-Agentic Code Auditor — We don't just chat, we analyze, clean, and verify.

### Added
- ✅ **LegacyLens as Skill Provider** — 6 agent skills for Claude Code, Cursor, Antigravity:
  - `legacylens-get-map` — Architectural context (Project Map)
  - `legacylens-audit` — Legacy audit with `--format skill-context`
  - `legacylens-safe-clean` — Safe dead code removal
  - `legacylens-detect-side-effects` — Affected files before changes
  - `legacylens-find-obsolete-logic` — Semantic search for duplicate logic
  - `legacylens-clean-house` — Full audit → auto-fix → verify loop
- ✅ **Refactoring Roadmap (multi-step for agents):**
  - Schema: `target` and `verification` per step (e.g. "Run npm test")
  - `--format skill-context` includes `roadmap` array for Cursor/Claude
- ✅ **Context-Pinning:** `legacylens pin-context <file>` — only dependencies + dependents (reduces context pollution)
- ✅ **Side-effect detection:** `legacylens affected <file>` — list files impacted by changing a file
- ✅ **Loop-based verification:** `legacylens verify` — check all imports resolve after refactors
- ✅ **One-command setup:** `legacylens setup-skills` / `npx legacylens-cli setup-skills` — install skills into detected IDEs and check `GEMINI_API_KEY`
- ✅ **CLI:** `get-map`, `pin-context`, `affected`, `verify`, `setup-skills`

### Changed
- 🔄 **Analyze:** Refactoring plan steps now include optional `target` and `verification` for agent execution
- 🔄 **skill-context format:** Adds `roadmap` and step `target`/`verification`

### Technical Details
- New: `getPinnedContext`, `getAffectedFiles`, `verifyProjectMap` in context-builder
- New: `scripts/install-skills.js` (cross-platform), `scripts/install-skills.sh`
- Skills live in `skills/` and are shipped in the npm package

## [4.0.0] - 2026-02-20

### 🎉 Major Release: Three-Level Architecture & Smart Auto-Fix

### Added
- ✅ **Three-Level Analysis Architecture:**
  - **Level 1 (Architectural Skeleton):** Local extraction of signatures, imports/exports in seconds
  - **Level 2 (Semantic Compression):** Sends compressed Project Map instead of raw code
  - **Level 3 (Targeted Deep Dive):** Full content analysis for complex/suspicious files
  - Identifies suspicious files (high exports/imports/signatures) for detailed audit
- ✅ **Smart Auto-Fix command (`legacylens auto-fix`):**
  - Automatically finds dead exports using Project Map
  - AI confirmation before removal (checks for public API, dynamic usage)
  - Safe removal with dry-run mode
  - Removes unused exports that are never imported
- ✅ **Enhanced Context-Aware Code Generation:**
  - Automatic framework detection (Express, FastAPI, Flask, Django, Koa, Next.js)
  - Framework-specific code generation
  - Auto-detects language and patterns from project files
  - Matches existing code style automatically

### Changed
- 🔄 **Improved analysis workflow:**
  - Project Map now used as primary context (Level 2)
  - Targeted Deep Dive for complex files (Level 3)
  - Faster analysis: sees entire repository structure, not just copied code
- 🔄 **Improved `create-api` command:**
  - Now detects framework and generates appropriate code
  - Python projects get FastAPI/Flask code
  - Node.js projects get Express/Koa code
  - File paths adapt to framework conventions

### Technical Details
- New function: `identifySuspiciousFiles()` for Level 3 deep dive
- New module: `src/core/auto-fix.js` for safe dead code removal
- Framework detection via `package.json` and `requirements.txt`
- AI-powered safety confirmation before code removal
- Conservative approach: skips if AI detects public API or dynamic usage
- Three-level architecture makes analysis 10x faster than traditional AI code analysis

## [3.9.0] - 2026-02-20

### 🎉 Documentation & Integration Release

### Added
- ✅ **Updated README.md with new features:**
  - Gemini 3 models documentation
  - Project Map integration details
  - Semantic Indexing guide
  - Code Generation examples
  - CLI Commands section with examples
  - Updated Roadmap with completed features

### Changed
- 🔄 **Documentation improvements:**
  - Updated all model references to Gemini 3
  - Added Advanced Features section
  - Updated Configuration examples with engines
  - Updated Cost section with Gemini 3 pricing
  - Updated badges to show Gemini 3

### Technical Details
- README.md now fully reflects integrated features
- All documentation synchronized with codebase
- Ready for npm publication

## [3.8.2] - 2026-02-20

### 🐛 Bug Fix

### Fixed
- 🔧 **Fixed projectMap scope issue:**
  - Project Map variables now properly scoped outside analysis block
  - Project Map is built even when using cached analysis results (needed for diagrams)
  - Fixed "projectMap is not defined" error

## [3.8.1] - 2026-02-20

### 🐛 Bug Fix

### Fixed
- 🔧 **Fixed Project Map exports structure handling:**
  - Properly handle `exports` as object `{ named: [...], default: ... }` instead of array
  - Added error handling for invalid export/import structures
  - Fixed compatibility with cached Project Maps

## [3.8.0] - 2026-02-20

### 🔥 Integrated Features into Main Workflow

### Changed
- 🔄 **Project Map now integrated into analyze workflow:**
  - Built BEFORE analysis (not just for diagrams)
  - Added to AI prompt context for better understanding of project structure
  - Used to detect dead code through imports/exports analysis
- 🔄 **Semantic Index integration:**
  - Automatically detected and used if available during analysis
  - Enhances context with semantic insights
- 🔄 **Improved dead code detection:**
  - Uses Project Map to identify exports that are never imported
  - More accurate detection based on actual code relationships

### Technical Details
- Project Map is now built once and reused for both analysis and diagrams
- Semantic Index metadata is included in prompt when available
- Dead code hints are generated from Project Map imports/exports analysis

## [3.7.0] - 2026-02-20

### 🚀 Gemini 3 Models Integration

### Changed
- 🔄 **Updated to Gemini 3 models:**
  - Flash: `gemini-3-flash-preview` (was `gemini-2.5-flash`)
  - Pro: `gemini-3-pro-preview` (was `gemini-2.5-pro`)
  - Embedding: `gemini-embedding-001` (was `text-embedding-004`)
- 🔄 **Improved model fallback chain** - better compatibility with older models
- 🔄 **Updated documentation** - ARCHITECTURE.md reflects new model names

### Technical Details
- Gemini 3 Flash: Fast, cost-efficient model with 1M context window
- Gemini 3 Pro: Flagship reasoning model for complex architecture tasks
- Gemini Embedding: State-of-the-art semantic search capabilities

## [2.1.0] - 2025-02-05

### 🚀 Major Performance Update - Large Project Support

### Added
- ✅ **New CLI options for size configuration:**
  - `--max-file-size <bytes>` - maximum size of a single file (default: 50000 bytes)
  - `--max-context-size <bytes>` - maximum size of entire context (default: 1000000 bytes)
- ✅ **Improved size formatting** - automatic display in KB/MB depending on size

### Changed
- 🔄 **Increased limits for large projects:**
  - `maxFileSize`: from 3KB to **50KB** per file (~16x increase)
  - `maxContextSize`: from 50KB to **1MB** for entire context (20x increase)
- 🔄 **Optimized for Gemini models** - using full potential of context window (up to 2M tokens)
- 🔄 **Improved logging** - detailed information about context size in debug mode

### Technical Details
- Gemini 2.5 Pro supports up to 2M tokens (~1.5M characters)
- Gemini 2.5 Flash supports up to 1M tokens (~750K characters)
- New limits allow analyzing projects with thousands of files

## [2.0.0] - 2025-02-04

### 🎉 Major Update - Enhanced AI Prompt and Static Analysis

### Added
- ✅ **Enhanced AI prompt** - detailed report structure with 7 sections
- ✅ **Dependency analysis** - automatic detection of package.json, requirements.txt, pom.xml
- ✅ **Code metrics** - counting lines, size, programming languages
- ✅ **Project statistics** - detailed information about project before analysis
- ✅ **Test detection** - automatic detection of test files
- ✅ **CI/CD detection** - checking for CI/CD configurations
- ✅ **Largest files analysis** - top 5 largest files in project
- ✅ **Language distribution** - statistics by programming languages

### Changed
- 🔄 **Improved report structure** - report now contains:
  - Project Purpose
  - Architecture and Structure
  - Critical Issues and Technical Debt
  - Detailed Analysis
  - Metrics and Statistics (with real data)
  - Recommendations and Action Plan
  - Conclusion
- 🔄 **More context for AI** - added project statistics to prompt
- 🔄 **Technical details** - AI receives objective metrics before analysis

### Improved
- 📈 Analysis quality significantly improved thanks to structured prompt
- 📈 More detailed reports with technical metrics
- 📈 Objective data complements AI analysis

### Technical
- Added functions `analyzeDependencies()` and `calculateCodeMetrics()`
- Exported new functions for testing
- All tests pass (65 tests)

## [1.9.0] - 2025-02-04

### Added
- ✅ Option `--max-files <number>` to limit number of files for analysis
- ✅ Option `--exclude-pattern <pattern>` for additional exclusion patterns (can be specified multiple times)
- ✅ Option `--include-pattern <pattern>` for additional inclusion patterns (can be specified multiple times)
- ✅ Automatic file list limiting after scanning
- ✅ Support for multiple values for exclude/include patterns

### Changed
- Improved handling of options with multiple values
- Added logging when applying limits and patterns

### Examples
```bash
# Limit number of files
node legacylens-cli.js --api-key=xxx --max-files=50

# Add exclusion patterns
node legacylens-cli.js --api-key=xxx --exclude-pattern="*.log" --exclude-pattern="temp/*"

# Add inclusion patterns
node legacylens-cli.js --api-key=xxx --include-pattern=".vue" --include-pattern=".svelte"
```

## [1.8.0] - 2025-02-04

### Added
- ✅ XML output format (`--format=xml`)
- ✅ Plain text output format (`--format=txt` or `--format=text`)
- ✅ PDF output format (`--format=pdf`) - generated as HTML with print styles
- ✅ Automatic format detection from file extension (.xml, .txt, .pdf)
- ✅ Export of new formatting functions for testing

### Changed
- Extended list of supported formats: markdown, html, json, xml, txt, pdf
- Improved file extension handling for automatic format detection

### Notes
- PDF format is generated as HTML with print styles. For true PDF, external tools are needed (puppeteer, wkhtmltopdf)

## [1.7.0] - 2025-02-04

### Added
- ✅ File list caching (`.legacylens-filelist.json`) for faster scanning
- ✅ Hash optimization (calculated once instead of twice)
- ✅ Streaming reads for large files (read only needed portion)
- ✅ Increased number of concurrent operations (from 10 to 20)
- ✅ Promise.allSettled for better error handling when reading files

### Changed
- Optimized `scanProject()` to use cached file list
- Optimized `readFileBatch()` for more efficient reading of large files
- Improved performance for large projects (30-50% faster)
- Reduced memory usage when working with large files

### Performance
- Faster scanning by 30-50% thanks to file list caching
- Less memory usage thanks to streaming reads
- Better performance for large projects

## [1.6.0] - 2025-02-04

### Added
- ✅ Retry logic for API requests with exponential backoff
- ✅ Option `--timeout` for configuring API request timeout
- ✅ Option `--retry` for configuring number of retries
- ✅ Option `--retry-delay` for configuring delay between retries
- ✅ Improved error handling with detailed messages
- ✅ Automatic error type detection (network, rate limit, timeout, etc.)
- ✅ Useful recommendations on errors
- ✅ Detailed stack traces in debug mode (--verbose)
- ✅ Added 31 new tests (65 tests total)
- ✅ Test coverage: 30.62% statements, 54.28% functions

### Changed
- Improved error messages with specific recommendations
- Added handling of network errors, rate limits, timeouts
- Optimized retry logic for different error types

### Testing
- Added tests for estimateFileCount() (8 tests)
- Added tests for readFileBatch() (6 tests)
- Added tests for logging (4 tests)
- Added tests for error handling (13 tests)

## [1.5.0] - 2025-02-04

### Added
- ✅ Unit tests with Jest (26 tests)
- ✅ CI/CD pipeline with GitHub Actions
- ✅ Improved logging with levels (debug, info, warn, error)
- ✅ Option `--verbose` for detailed logs
- ✅ Option `--quiet` for minimal output
- ✅ Option `--log-file` for saving logs to file
- ✅ Automatic testing on different Node.js versions (18.x, 20.x, 22.x)

### Changed
- Improved diagnostics with detailed logs
- Optimized output for different modes (verbose/quiet)

### Testing
- Test coverage: formatting, caching, .gitignore
- Automatic tests on every commit

## [1.4.0] - 2025-02-04

### Added
- ✅ Support for different output formats (HTML, JSON, Markdown)
- ✅ Option `--format` for selecting output format
- ✅ Automatic format detection from file extension
- ✅ HTML reports with beautiful styled design
- ✅ JSON format with metadata for automation

### Changed
- Improved HTML report formatting
- Added metadata to all output formats

## [1.3.0] - 2025-02-04

### Added
- ✅ CLI library commander.js - professional argument parsing
- ✅ Automatic help generation via commander.js
- ✅ Improved command-line option validation

### Changed
- Code refactoring to use commander.js
- Improved code structure and error handling
- Updated help output format

## [1.2.0] - 2025-02-04

### Added
- ✅ Async file reading - parallel reading for better performance
- ✅ Result caching - automatic saving and using cache
- ✅ Option `--force` - forced refresh (ignore cache)
- ✅ Project hashing - checking project changes for caching

### Changed
- Improved scanning performance for large projects
- Optimized memory usage when reading files
- Added limit on number of concurrent read operations (10 files)

## [1.1.0] - 2025-02-04

### Added
- ✅ `.gitignore` support - automatic ignoring of files from `.gitignore`
- ✅ Configuration file `.legacylens.json` - storing project settings
- ✅ Progress bar - displaying scanning progress in real-time
- ✅ Improved file ignoring logic with glob pattern support

### Changed
- Improved error handling
- Updated list of available AI models
- Improved statistics output

## [1.0.0] - 2025-02-04

### Added
- ✅ Basic CLI tool for legacy code analysis
- ✅ Integration with Google Gemini API
- ✅ Support for different AI models with automatic fallback
- ✅ Command-line options: `--api-key`, `--model`, `--output`, `--help`, `--version`
- ✅ Colored console output
- ✅ Saving report to file
- ✅ Execution statistics
