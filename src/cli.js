// Main CLI module
const { Command } = require('commander');
const path = require('path');
const fs = require('fs');

// Import modules
const { colorize, logInfo, logError, logWarn, logDebug, setLogLevel, setLogFile } = require('./utils/logger');
const { DEFAULT_CONFIG, loadConfig } = require('./utils/config');
const { calculateProjectHash, loadCache, saveCache } = require('./utils/cache');
const { analyzeDependencies, calculateCodeMetrics } = require('./utils/analyzer');
const { parseGitignore } = require('./core/gitignore');
const { scanProject } = require('./core/scanner');
const { buildPrompt, generateMockResponse, callGeminiAPI, DEFAULT_MODELS } = require('./core/ai-client');
const { formatAsMarkdown, formatAsJSON, formatAsXML, formatAsPlainText, formatAsPDF } = require('./reports/formatters');
const { formatAsHTML } = require('./reports/html-template');

const { VERSION } = require('./utils/constants');

// Get API key from environment (used as fallback, can be overridden by options/config)
const getDefaultApiKey = () => process.env.GEMINI_API_KEY || process.env.LEGACYLENS_API_KEY;
const getDefaultModel = () => process.env.GEMINI_MODEL || DEFAULT_MODELS[0];

async function analyzeProject(options) {
    const startTime = Date.now();

    const projectPath = options.project || process.cwd();
    let outputFile = options.output || null;
    const selectedModel = options.model || getDefaultModel();
    const forceRefresh = options.force || false;
    let outputFormat = options.format || 'markdown';

    // Parse reliability numeric options
    const requestTimeout = parseInt(options.timeout || '120', 10) * 1000; // ms
    const maxRetries = parseInt(options.retry || '3', 10);
    const retryDelay = parseInt(options.retryDelay || '2000', 10); // ms

    // Automatically determine format from file extension if not specified
    if (outputFile && !options.format) {
        const ext = path.extname(outputFile).toLowerCase();
        if (ext === '.html') outputFormat = 'html';
        else if (ext === '.json') outputFormat = 'json';
        else if (ext === '.md' || ext === '.markdown') outputFormat = 'markdown';
    }

    // Get API key from options or environment variable
    const apiKey = options.apiKey || getDefaultApiKey();

    logInfo('🔍 LegacyLens CLI - Legacy Code Analysis\n');
    logDebug(`Starting project analysis: ${projectPath}`);

    // Get project path
    const absolutePath = path.resolve(projectPath);

    if (!fs.existsSync(absolutePath)) {
        logError(`❌ Error: Directory does not exist: ${absolutePath}`);
        process.exit(1);
    }

    // Load configuration
    const config = loadConfig(absolutePath);
    let finalConfig = { ...DEFAULT_CONFIG };
    let finalApiKey = apiKey;
    let finalModel = selectedModel;

    if (config) {
        logInfo('📋 Found configuration file .legacylens.json', 'green');
        logDebug(`Configuration: ${JSON.stringify(config, null, 2)}`);
        // Merge config with default values
        if (config.ignore) finalConfig.ignore = [...DEFAULT_CONFIG.ignore, ...config.ignore];
        if (config.include) finalConfig.include = config.include;
        if (config.maxFileSize) finalConfig.maxFileSize = config.maxFileSize;
        if (config.maxContextSize) finalConfig.maxContextSize = config.maxContextSize;
        if (config.outputFile) finalConfig.outputFile = config.outputFile;
        if (config.maxConcurrentReads) finalConfig.maxConcurrentReads = config.maxConcurrentReads;

        // Add options from command line
        if (options.excludePattern && options.excludePattern.length > 0) {
            finalConfig.ignore = [...finalConfig.ignore, ...options.excludePattern];
            logDebug(`Added ${options.excludePattern.length} exclusion patterns from CLI`);
        }
        if (options.includePattern && options.includePattern.length > 0) {
            const newExtensions = options.includePattern
                .filter(pattern => pattern.startsWith('.'))
                .map(pattern => pattern);
            if (newExtensions.length > 0) {
                finalConfig.include = [...finalConfig.include, ...newExtensions];
                logDebug(`Added ${newExtensions.length} inclusion extensions from CLI`);
            }
        }
        if (options.maxFiles) {
            finalConfig.maxFiles = parseInt(options.maxFiles, 10);
            logDebug(`File count limit: ${finalConfig.maxFiles}`);
        }
        if (options.maxFileSize) {
            finalConfig.maxFileSize = parseInt(options.maxFileSize, 10);
            logDebug(`Maximum file size: ${finalConfig.maxFileSize} bytes`);
        }
        if (options.maxContextSize) {
            finalConfig.maxContextSize = parseInt(options.maxContextSize, 10);
            logDebug(`Maximum context size: ${finalConfig.maxContextSize} bytes`);
        }
        if (config.apiKey && !finalApiKey) finalApiKey = config.apiKey;
        if (config.model && finalModel === getDefaultModel()) finalModel = config.model;
    }

    // Check API key (can be skipped in mock mode)
    if (!finalApiKey && !options.mockAi) {
        logError('❌ Error: API key not found!\n');
        console.error('Setup options:');
        console.error('  1. Via argument: --api-key=your_key');
        console.error('  2. Via environment variable: set GEMINI_API_KEY=your_key');
        console.error('  3. Via .legacylens.json: { "apiKey": "your_key" }');
        console.error('\nUse --help for detailed information.');
        process.exit(1);
    }

    if (options.mockAi) {
        logWarn('🧪 Mock mode enabled (--mock-ai): Gemini API will NOT be called');
    } else {
        logInfo(`🔑 API key: ${finalApiKey.substring(0, 10)}...${finalApiKey.substring(finalApiKey.length - 4)}`, 'gray');
        if (finalModel !== getDefaultModel()) {
            logInfo(`🤖 Model: ${finalModel}`, 'gray');
        }
    }

    console.log(colorize(`📁 Scanning project: ${absolutePath}\n`, 'blue'));

    // Parse .gitignore using professional 'ignore' package
    const gitignoreInstance = parseGitignore(absolutePath, finalConfig.ignore);
    logInfo(`📝 Using .gitignore rules (with config overrides)`, 'gray');

    // File scanning
    logDebug('Starting project scan...');

    // Cache file list for reuse
    const fileListCachePath = path.join(absolutePath, '.legacylens-filelist.json');
    let fileListCache = null;

    if (!forceRefresh && fs.existsSync(fileListCachePath)) {
        try {
            const cacheContent = fs.readFileSync(fileListCachePath, 'utf-8');
            fileListCache = JSON.parse(cacheContent);
            const cacheAge = Date.now() - (fileListCache.timestamp || 0);
            if (cacheAge > 3600000) { // 1 hour
                fileListCache = null;
                logDebug('Cached file list is stale, updating...');
            } else {
                logDebug('Using cached file list');
            }
        } catch (e) {
            logDebug('Failed to load cached file list, scanning again...');
        }
    }

    let files = await scanProject(absolutePath, finalConfig, gitignoreInstance, null, { scanned: 0, total: 0 }, fileListCache);

    // Apply file count limit if specified
    if (finalConfig.maxFiles && files.length > finalConfig.maxFiles) {
        logWarn(`⚠️  Found ${files.length} files, limiting to ${finalConfig.maxFiles} (--max-files)`);
        files = files.slice(0, finalConfig.maxFiles);
    }

    logInfo(`\n✅ Found ${files.length} files\n`, 'green');
    logDebug(`File list: ${files.map(f => f.path).join(', ')}`);

    // Save file list to cache
    try {
        const fileListCacheData = {
            total: files.length,
            timestamp: Date.now(),
            files: files.map(f => ({ path: f.path, size: f.content.length }))
        };
        fs.writeFileSync(fileListCachePath, JSON.stringify(fileListCacheData, null, 2), 'utf-8');
        logDebug('File list saved to cache');
    } catch (e) {
        logDebug(`Failed to save cached file list: ${e.message}`);
    }

    if (files.length === 0) {
        logError('❌ No files found for analysis!');
        console.error('Make sure the project contains files with supported extensions.');
        logDebug(`Searched for extensions: ${finalConfig.include.join(', ')}`);
        process.exit(1);
    }

    // Cache check
    let jsonAnalysis = null; // Store JSON analysis (from Schema Response)
    let usedModel = selectedModel;
    let projectHash = null;
    let projectContext = null; // Store project context for statistics

    if (!forceRefresh) {
        logDebug('Calculating project hash for cache check...');
        projectHash = await calculateProjectHash(files);
        logDebug(`Project hash: ${projectHash}`);

        const cache = loadCache(absolutePath);

        if (cache && cache.hash === projectHash && cache.version === VERSION) {
            logInfo('💾 Found cached result', 'green');
            logInfo(`   Last analysis: ${new Date(cache.timestamp).toLocaleString('en-US')}`, 'gray');
            logInfo(`   Model: ${cache.model}\n`, 'gray');

            // Use cached result (should be JSON)
            jsonAnalysis = cache.report;
            usedModel = cache.model;
            logInfo('✅ Using cached result\n', 'green');
            logDebug('Skipped AI request due to cache');
        }
    }

    // If cache not found or force refresh - perform new analysis
    if (!jsonAnalysis) {
        if (forceRefresh) {
            logWarn('🔄 Force refresh (--force)\n');
        }

        // Prepare context safely (without breaking JSON)
        logInfo('📝 Preparing context for AI...', 'yellow');
        
        // 1. Sort files: important files first (package.json, README, src/)
        files.sort((a, b) => {
            const score = (f) => {
                if (f.path.includes('package.json')) return 2;
                if (f.path.includes('README')) return 1;
                return 0;
            };
            return score(b) - score(a);
        });

        // 2. Safe context formation
        const MAX_CONTEXT = finalConfig.maxContextSize || 1000000;
        const contextFiles = [];
        let currentSize = 0;
        let skippedFiles = 0;

        for (const file of files) {
            // Simplified structure to save tokens
            const fileEntry = { path: file.path, content: file.content };
            const entryJson = JSON.stringify(fileEntry);
            
            if (currentSize + entryJson.length < MAX_CONTEXT) {
                contextFiles.push(fileEntry);
                currentSize += entryJson.length;
            } else {
                skippedFiles++;
                logDebug(`⚠️ Skipping ${file.path} (context limit reached)`);
            }
        }

        projectContext = JSON.stringify(contextFiles, null, 2);
        logInfo(' ✅ Ready\n', 'green');
        const contextSizeKB = projectContext.length / 1024;
        const contextSizeMB = contextSizeKB / 1024;
        const contextSizeStr = contextSizeMB >= 1
            ? `${contextSizeMB.toFixed(2)} MB`
            : `${contextSizeKB.toFixed(2)} KB`;
        logDebug(`Context size: ${projectContext.length} characters (${contextSizeStr})`);
        if (skippedFiles > 0) {
            logWarn(`⚠️  ${skippedFiles} file(s) skipped due to context size limit`);
        }

        // Analyze dependencies and metrics
        logDebug('Analyzing project dependencies and metrics...');
        const dependencies = analyzeDependencies(absolutePath);
        const codeMetrics = calculateCodeMetrics(files);

        // Project statistics (using real metrics from analyzer)
        const projectStats = {
            filesCount: files.length,
            totalSize: codeMetrics.totalSize, // Real size in bytes
            totalLines: codeMetrics.totalLines,
            totalComments: codeMetrics.totalComments,
            languages: Object.keys(codeMetrics.languages),
            languageDistribution: codeMetrics.languages,
            averageFileSize: Math.round(codeMetrics.averageFileSize || 0),
            largestFiles: codeMetrics.largestFile ? [{ path: codeMetrics.largestFile.path, size: codeMetrics.largestFile.size }] : [],
            hasTests: dependencies.hasTests,
            testsCount: dependencies.hasTests ? 1 : 0,
            hasComments: codeMetrics.hasComments,
            commentRatio: codeMetrics.commentRatio,
            dependencies
        };

        logDebug(`Metrics: ${JSON.stringify(projectStats, null, 2)}`);

        const prompt = buildPrompt(projectContext, projectStats);

        // AI request with retry logic (or mock mode)
        logInfo('🤖 Sending request to AI...\n', 'cyan');
        logDebug(`Using model: ${finalModel}`);
        logDebug(`Settings: timeout=${requestTimeout / 1000}s, retries=${maxRetries}, retryDelay=${retryDelay}ms`);

        try {
            if (options.mockAi) {
                usedModel = 'mock';
                jsonAnalysis = await generateMockResponse(absolutePath, files, projectStats);
            } else {
                const result = await callGeminiAPI(finalApiKey, finalModel, prompt, {
                    requestTimeout,
                    maxRetries,
                    retryDelay
                });
                jsonAnalysis = result.json;
                usedModel = result.model;
                logDebug('✅ Using structured JSON from Schema Response');
            }

            // Save to cache
            logDebug('Saving result to cache...');
            if (!projectHash) {
                projectHash = await calculateProjectHash(files);
            }
            saveCache(absolutePath, projectHash, jsonAnalysis, usedModel);
            logInfo('💾 Result saved to cache\n', 'gray');

        } catch (error) {
            logError(`❌ Error during AI analysis: ${error.message}`);
            if (options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    const endTime = Date.now();
    const executionTime = ((endTime - startTime) / 1000).toFixed(2);

    // Prepare context for statistics (use actual context size, not truncated)
    const projectContextForStats = projectContext || JSON.stringify(files, null, 2);

    // Output result (generate markdown summary for console display)
    if (!options.quiet && jsonAnalysis) {
        console.log(colorize('\n================================================================================', 'cyan'));
        console.log(colorize('📊 ANALYSIS RESULT', 'cyan'));
        console.log(colorize('================================================================================\n', 'cyan'));
        const summary = formatAsMarkdown(jsonAnalysis, {});
        console.log(summary);
    }

    // Format and save report
    const metadata = {
        model: usedModel,
        filesCount: files.length,
        executionTime: `${executionTime}s`,
        date: new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }),
        contextSize: projectContextForStats.length,
        reportSize: JSON.stringify(jsonAnalysis || {}).length
    };

    let formattedOutput;
    switch (outputFormat.toLowerCase()) {
        case 'html':
            formattedOutput = formatAsHTML(jsonAnalysis, metadata);
            break;
        case 'json':
            formattedOutput = formatAsJSON(jsonAnalysis, metadata);
            break;
        case 'xml':
            formattedOutput = formatAsXML(jsonAnalysis, metadata);
            break;
        case 'txt':
        case 'text':
        case 'plain':
            formattedOutput = formatAsPlainText(jsonAnalysis, metadata);
            break;
        case 'pdf':
            formattedOutput = formatAsPDF(jsonAnalysis, metadata);
            break;
        case 'markdown':
        default:
            formattedOutput = formatAsMarkdown(jsonAnalysis, metadata);
            break;
    }

    // Determine output file
    if (!outputFile) {
        const ext = outputFormat === 'html' ? '.html' : 
                   outputFormat === 'json' ? '.json' :
                   outputFormat === 'xml' ? '.xml' :
                   outputFormat === 'txt' || outputFormat === 'text' ? '.txt' :
                   outputFormat === 'pdf' ? '.html' : '.md';
        outputFile = path.join(absolutePath, `legacylens-report${ext}`);
    } else {
        outputFile = path.isAbsolute(outputFile) ? outputFile : path.join(absolutePath, outputFile);
    }

    // Save report
    try {
        fs.writeFileSync(outputFile, formattedOutput, 'utf-8');
        logInfo(`\n💾 Report saved: ${outputFile}`, 'green');
        logInfo(`   Format: ${outputFormat.toUpperCase()}\n`, 'green');
    } catch (error) {
        logError(`❌ Failed to save report: ${error.message}`);
        process.exit(1);
    }

    // Statistics
    if (!options.quiet) {
        console.log(colorize('📊 Statistics:', 'cyan'));
        console.log(`   ${colorize('Files analyzed:', 'gray')} ${colorize(files.length.toString(), 'bright')}`);
        console.log(`   ${colorize('Model:', 'gray')} ${colorize(usedModel, 'yellow')}`);
        console.log(`   ${colorize('Execution time:', 'gray')} ${colorize(`${executionTime}s`, 'bright')}`);
        console.log(`   ${colorize('Context size:', 'gray')} ${colorize((projectContextForStats.length / 1024).toFixed(2) + ' KB', 'bright')}`);
        console.log(`   ${colorize('Report size:', 'gray')} ${colorize((formattedOutput.length / 1024).toFixed(2) + ' KB', 'bright')}`);
        if (jsonAnalysis) {
            console.log(`   ${colorize('JSON data:', 'gray')} ${colorize('✓ Valid', 'green')}`);
        }
        console.log('');
    }
}

function setupCLI() {
    const program = new Command();

    program
        .name('legacylens')
        .description('AI Code Archeologist - CLI tool for analyzing legacy code with Google Gemini AI')
        .version(VERSION)
        .argument('[project]', 'Path to project for analysis', process.cwd())
        .option('-k, --api-key <key>', 'Google Gemini API key (required)')
        .option('-m, --model <name>', 'AI model (default: gemini-2.5-flash)', getDefaultModel())
        .option('-o, --output <file>', 'File to save report', 'legacylens-report.md')
        .option('-f, --format <format>', 'Output format (markdown, html, json, xml, txt, pdf)', 'markdown')
        .option('--mock-ai', 'Test mode: do not call Gemini API, generate fake report locally')
        .option('--force', 'Always perform new analysis (ignore cache)')
        .option('-v, --verbose', 'Detailed logs (debug mode)')
        .option('-q, --quiet', 'Minimal output')
        .option('--log-file <file>', 'Save logs to file')
        .option('--timeout <seconds>', 'Timeout for API requests (seconds)', '120')
        .option('--retry <number>', 'Number of retries on error', '3')
        .option('--retry-delay <ms>', 'Delay between retries (milliseconds)', '2000')
        .option('--max-files <number>', 'Limit number of files for analysis')
        .option('--max-file-size <bytes>', 'Maximum size of a single file in bytes (default: 50000)', '50000')
        .option('--max-context-size <bytes>', 'Maximum size of entire context in bytes (default: 1000000)', '1000000')
        .option('--exclude-pattern <pattern>', 'Additional exclusion patterns (can be specified multiple times)', (val, prev) => {
            prev = prev || [];
            prev.push(val);
            return prev;
        })
        .option('--include-pattern <pattern>', 'Additional inclusion patterns (can be specified multiple times)', (val, prev) => {
            prev = prev || [];
            prev.push(val);
            return prev;
        })
        .action(async (project, options) => {
            // Configure logging
            if (options.verbose) {
                setLogLevel('debug');
            } else if (options.quiet) {
                setLogLevel('warn');
            }

            if (options.logFile) {
                setLogFile(options.logFile);
            }

            try {
                await analyzeProject({ ...options, project });
            } catch (error) {
                logError(`\n❌ Critical error: ${error.message}`);
                if (options.verbose || process.env.DEBUG) {
                    console.error('\nDetails:', error.stack);
                }
                process.exit(1);
            }
        });

    return program;
}

module.exports = {
    analyzeProject,
    setupCLI,
    VERSION
};
