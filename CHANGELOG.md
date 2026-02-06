# Change Log

All notable changes to the LegacyLens CLI will be documented in this file.

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
