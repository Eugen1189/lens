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
const { buildPrompt, generateMockResponse, callGeminiAPI, identifySuspiciousFiles } = require('./core/ai-client');
const { getModelForTask, getEmbeddingModel, DEFAULT_ENGINES } = require('./core/engines');
const { getContextForPrompt } = require('./core/context-engine');
const { buildProjectMap, getPinnedContext, getAffectedFiles, verifyProjectMap } = require('./core/context-builder');
const { buildIndex, saveIndex, loadIndex, search } = require('./core/semantic-indexer');
const { createApiRoute } = require('./core/code-generator');
const { autoFix } = require('./core/auto-fix');
const { formatAsMarkdown, formatAsJSON, formatAsXML, formatAsPlainText, formatAsPDF, formatAsSkillContext } = require('./reports/formatters');
const { formatAsHTML } = require('./reports/html-template');

const { VERSION } = require('./utils/constants');

// Get API key from environment (used as fallback, can be overridden by options/config)
const getDefaultApiKey = () => process.env.GEMINI_API_KEY || process.env.LEGACYLENS_API_KEY;
// Use engines system: default to Flash for audit (can override via --model or env)
const getDefaultModel = () => process.env.GEMINI_MODEL || getModelForTask('audit');

async function analyzeProject(options) {
    const startTime = Date.now();

    const projectPath = options.project || process.cwd();
    let outputFile = options.output || null;
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
    let finalModel;

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
        if (config.engines && typeof config.engines === 'object') {
            finalConfig.engines = { ...finalConfig.engines, ...config.engines };
        }
        if (config.apiKey && !finalApiKey) finalApiKey = config.apiKey;
        if (config.model && finalModel === getDefaultModel()) finalModel = config.model;
    }

    // Hybrid engine: audit uses Flash by default (--model overrides)
    const engineOverrides = finalConfig.engines ? { flash: finalConfig.engines.flash, pro: finalConfig.engines.pro } : {};
    const selectedModel = options.model || getModelForTask('audit', engineOverrides);
    finalModel = (config && config.model) ? config.model : selectedModel;

    // Add options from command line
    if (config) {
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
    
    // 🔥 INTEGRATION: Project Map and Semantic Index (used in analysis and diagrams)
    let projectMap = null;
    let projectMapSummary = '';
    let semanticContext = '';

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
            
            // 🔥 INTEGRATION: Still build Project Map for diagrams even when using cache
            // (Project Map is needed for Mermaid diagrams in reports)
            try {
                projectMap = await buildProjectMap(absolutePath, {
                    ignore: gitignoreInstance,
                    extraIgnore: finalConfig.ignore || [],
                    include: finalConfig.include,
                    maxFileSize: finalConfig.maxFileSize,
                    forceRebuild: false // Use cache if available
                });
                projectMapSummary = await getContextForPrompt(absolutePath, {
                    ignore: gitignoreInstance,
                    extraIgnore: finalConfig.ignore || [],
                    include: finalConfig.include,
                    maxFileSize: finalConfig.maxFileSize
                });
                logDebug(`Project Map loaded for cached result: ${projectMap.files.length} files`);
            } catch (e) {
                logDebug(`Failed to build Project Map for cached result: ${e.message}`);
            }
        }
    }

    // If cache not found or force refresh - perform new analysis
    if (!jsonAnalysis) {
        if (forceRefresh) {
            logWarn('🔄 Force refresh (--force)\n');
        }

        // Prepare context safely (without breaking JSON)
        logInfo('📝 Preparing context for AI...', 'yellow');
        
        // 🔥 INTEGRATION: Build Project Map BEFORE analysis for better context
        try {
            logDebug('Building Project Map for enhanced context...');
            projectMap = await buildProjectMap(absolutePath, {
                ignore: gitignoreInstance,
                extraIgnore: finalConfig.ignore || [],
                include: finalConfig.include,
                maxFileSize: finalConfig.maxFileSize,
                forceRebuild: forceRefresh
            });
            projectMapSummary = await getContextForPrompt(absolutePath, {
                ignore: gitignoreInstance,
                extraIgnore: finalConfig.ignore || [],
                include: finalConfig.include,
                maxFileSize: finalConfig.maxFileSize
            });
            logDebug(`Project Map built: ${projectMap.files.length} files, ${projectMapSummary.length} chars summary`);
        } catch (e) {
            logDebug(`Failed to build Project Map: ${e.message}`);
        }
        
        // 🔥 INTEGRATION: Use Semantic Index if available to enhance context
        try {
            const indexData = loadIndex(absolutePath);
            if (indexData && indexData.chunks && indexData.chunks.length > 0) {
                logDebug(`Semantic Index found: ${indexData.chunks.length} chunks available`);
                // Use index metadata to identify key files (we'll use it in prompt)
                semanticContext = `\nSEMANTIC INDEX AVAILABLE: ${indexData.chunks.length} code chunks indexed. Use this to find related code by meaning.`;
            }
        } catch (e) {
            logDebug(`Semantic Index not available: ${e.message}`);
        }
        
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

        // 🔥 LEVEL 3: Targeted Deep Dive - Identify suspicious/complex files for full analysis
        let targetedFiles = [];
        if (projectMap && projectMap.files) {
            const suspicious = identifySuspiciousFiles(projectMap);
            if (suspicious.length > 0) {
                logDebug(`Found ${suspicious.length} suspicious/complex files for deep dive`);
                // Load full content of suspicious files
                for (const sus of suspicious.slice(0, 5)) { // Limit to top 5 most complex
                    try {
                        const fullPath = path.join(absolutePath, sus.path);
                        if (fs.existsSync(fullPath)) {
                            const content = fs.readFileSync(fullPath, 'utf-8');
                            targetedFiles.push({
                                path: sus.path,
                                reason: sus.reason,
                                complexity: sus.complexity,
                                content: content.slice(0, 5000) // Limit to 5KB per file for deep dive
                            });
                            logDebug(`Deep dive: ${sus.path} (${sus.reason})`);
                        }
                    } catch (e) {
                        logDebug(`Failed to load ${sus.path} for deep dive: ${e.message}`);
                    }
                }
            }
        }

        // 🔥 INTEGRATION: Pass Project Map, Semantic Index, and Targeted Deep Dive to prompt
        const prompt = buildPrompt(projectContext, projectStats, {
            projectMapSummary,
            semanticContext,
            projectMap,
            targetedFiles
        });

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

    // Build Project Map for Mermaid diagrams (if markdown/html output)
    // Note: projectMap is already built above for context, reuse it
    if (!projectMap && (outputFormat.toLowerCase() === 'markdown' || outputFormat.toLowerCase() === 'html')) {
        try {
            projectMap = await buildProjectMap(absolutePath, {
                ignore: gitignoreInstance,
                extraIgnore: finalConfig.ignore || [],
                include: finalConfig.include,
                maxFileSize: finalConfig.maxFileSize,
                forceRebuild: forceRefresh
            });
            logDebug(`Project Map built for diagrams: ${projectMap.files.length} files`);
        } catch (e) {
            logDebug(`Failed to build Project Map for diagrams: ${e.message}`);
        }
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
        reportSize: JSON.stringify(jsonAnalysis || {}).length,
        projectMap // For Mermaid diagrams
    };

    let formattedOutput;
    switch (outputFormat.toLowerCase()) {
        case 'html':
            formattedOutput = formatAsHTML(jsonAnalysis, metadata);
            break;
        case 'json':
            formattedOutput = formatAsJSON(jsonAnalysis, metadata);
            break;
        case 'skill-context':
        case 'skillcontext':
            formattedOutput = formatAsSkillContext(jsonAnalysis, metadata);
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
                   outputFormat === 'json' || outputFormat === 'skill-context' || outputFormat === 'skillcontext' ? '.json' :
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
        .description('AI Code Archeologist - Hybrid Flash/Pro/Embedding. Analyze, index, generate code.')
        .version(VERSION)
        .option('-k, --api-key <key>', 'Google Gemini API key')
        .option('-v, --verbose', 'Detailed logs (debug mode)')
        .option('-q, --quiet', 'Minimal output')
        .option('--log-file <file>', 'Save logs to file');

    // --- analyze (default when no subcommand; registered first) ---
    program.command('analyze').description('Analyze project (default command)')
        .argument('[project]', 'Path to project for analysis', process.cwd())
        .option('-m, --model <name>', 'AI model (default: Flash for audit)', getDefaultModel())
        .option('-o, --output <file>', 'File to save report', 'legacylens-report.md')
        .option('-f, --format <format>', 'Output format (markdown, html, json, xml, txt, pdf, skill-context)', 'markdown')
        .option('--mock-ai', 'Test mode: do not call Gemini API, generate fake report locally')
        .option('--force', 'Always perform new analysis (ignore cache)')
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
            if (options.verbose) setLogLevel('debug');
            else if (options.quiet) setLogLevel('warn');
            if (options.logFile) setLogFile(options.logFile);
            try {
                await analyzeProject({ ...options, project });
            } catch (error) {
                logError(`\n❌ Critical error: ${error.message}`);
                if (options.verbose || process.env.DEBUG) console.error('\nDetails:', error.stack);
                process.exit(1);
            }
        });

    // --- index: build semantic index (Gemini Embedding) ---
    program.command('index').description('Build semantic index for code search (Gemini Embedding)')
        .argument('[project]', 'Project path', process.cwd())
        .option('--rebuild', 'Rebuild index even if it exists')
        .action(async (project, opts) => {
            if (opts.verbose) setLogLevel('debug');
            if (opts.logFile) setLogFile(opts.logFile);
            const apiKey = opts.apiKey || getDefaultApiKey();
            if (!apiKey) {
                logError('API key required. Use -k or GEMINI_API_KEY.');
                process.exit(1);
            }
            const absolutePath = path.resolve(project);
            if (!fs.existsSync(absolutePath)) {
                logError(`Directory not found: ${absolutePath}`);
                process.exit(1);
            }
            const config = loadConfig(absolutePath);
            const finalConfig = { ...DEFAULT_CONFIG, ...(config && config.engines ? { engines: { ...DEFAULT_CONFIG.engines, ...config.engines } } : {}) };
            if (config && config.ignore) finalConfig.ignore = [...DEFAULT_CONFIG.ignore, ...config.ignore];
            const gitignoreInstance = parseGitignore(absolutePath, finalConfig.ignore);
            const files = await scanProject(absolutePath, finalConfig, gitignoreInstance, null, { scanned: 0, total: 0 }, null);
            if (files.length === 0) {
                logError('No files to index.');
                process.exit(1);
            }
            const indexData = await buildIndex(absolutePath, files, apiKey, { engines: finalConfig.engines });
            const { VERSION: ver } = require('./utils/constants');
            saveIndex(absolutePath, { ...indexData, version: ver });
            logInfo('Semantic index ready. Use: legacylens find "<query>"');
        });

    // --- find: semantic search ---
    program.command('find <query>').description('Semantic search in indexed code')
        .argument('[project]', 'Project path', process.cwd())
        .option('--top <n>', 'Number of results', '10')
        .action(async (query, project, opts) => {
            if (opts.verbose) setLogLevel('debug');
            const apiKey = opts.apiKey || getDefaultApiKey();
            if (!apiKey) {
                logError('API key required for embedding the query.');
                process.exit(1);
            }
            const absolutePath = path.resolve(project);
            const indexData = loadIndex(absolutePath);
            if (!indexData) {
                logError('No index found. Run: legacylens index [project]');
                process.exit(1);
            }
            const config = loadConfig(absolutePath);
            const engines = config && config.engines ? { ...DEFAULT_CONFIG.engines, ...config.engines } : DEFAULT_CONFIG.engines;
            const embeddingModel = engines.embedding || getEmbeddingModel();
            const topK = parseInt(opts.top, 10) || 10;
            const results = await search(query, indexData, apiKey, embeddingModel, topK);
            console.log(colorize(`\n🔍 "${query}" — top ${results.length}\n`, 'cyan'));
            results.forEach((r, i) => {
                console.log(colorize(`${i + 1}. ${r.path} (line ~${r.startLine || '?'}) score=${r.score.toFixed(3)}`, 'yellow'));
                console.log((r.text || '').slice(0, 200).replace(/\n/g, ' ') + (r.text && r.text.length > 200 ? '...' : ''));
                console.log('');
            });
        });

    // --- create-api: generate API route (Gemini Flash) ---
    program.command('create-api').description('Generate API route code (Gemini Flash)')
        .argument('[project]', 'Project path', process.cwd())
        .option('--route <path>', 'Route path (required), e.g. /users')
        .option('--out <file>', 'Output file (default: routes/<route>.js)')
        .action(async (project, opts) => {
            if (opts.verbose) setLogLevel('debug');
            if (!opts.route) {
                logError('create-api requires --route <path> (e.g. --route /users).');
                process.exit(1);
            }
            const apiKey = opts.apiKey || getDefaultApiKey();
            if (!apiKey) {
                logError('API key required. Use -k or GEMINI_API_KEY.');
                process.exit(1);
            }
            const absolutePath = path.resolve(project);
            if (!fs.existsSync(absolutePath)) {
                logError(`Directory not found: ${absolutePath}`);
                process.exit(1);
            }
            const config = loadConfig(absolutePath);
            const finalConfig = { ...DEFAULT_CONFIG, ...(config ? { engines: config.engines ? { ...DEFAULT_CONFIG.engines, ...config.engines } : {} } : {}) };
            if (config && config.ignore) finalConfig.ignore = [...DEFAULT_CONFIG.ignore, ...config.ignore];
            const gitignoreInstance = parseGitignore(absolutePath, finalConfig.ignore);
            const result = await createApiRoute(absolutePath, opts.route, {
                apiKey,
                engines: finalConfig.engines,
                ignore: gitignoreInstance,
                outputPath: opts.out
            });
            logInfo(`Done. Model: ${result.model}. File: ${result.path}`);
        });

    // --- auto-fix: Smart dead code removal ---
    program.command('auto-fix').description('Automatically remove dead code (exports never imported) with AI confirmation')
        .argument('[project]', 'Project path', process.cwd())
        .option('--dry-run', 'Show what would be removed without actually removing')
        .option('--no-confirm', 'Skip AI confirmation (faster but less safe)')
        .action(async (project, opts) => {
            if (opts.verbose) setLogLevel('debug');
            if (opts.logFile) setLogFile(opts.logFile);
            const apiKey = opts.apiKey || getDefaultApiKey();
            if (!apiKey) {
                logError('API key required. Use -k or GEMINI_API_KEY.');
                process.exit(1);
            }
            const absolutePath = path.resolve(project);
            if (!fs.existsSync(absolutePath)) {
                logError(`Directory not found: ${absolutePath}`);
                process.exit(1);
            }
            const config = loadConfig(absolutePath);
            const finalConfig = { ...DEFAULT_CONFIG, ...(config && config.engines ? { engines: { ...DEFAULT_CONFIG.engines, ...config.engines } } : {}) };
            if (config && config.ignore) finalConfig.ignore = [...DEFAULT_CONFIG.ignore, ...config.ignore];
            const gitignoreInstance = parseGitignore(absolutePath, finalConfig.ignore);
            
            if (opts.dryRun) {
                logInfo('🔍 DRY RUN MODE - No files will be modified\n');
            }
            
            const result = await autoFix(absolutePath, {
                apiKey,
                dryRun: opts.dryRun || false,
                confirm: opts.confirm !== false,
                ignore: gitignoreInstance
            });
            
            logInfo(`\n📊 Summary: ${result.removed} removed, ${result.skipped} skipped, ${result.errors} errors`);
            if (opts.dryRun && result.removed > 0) {
                logInfo('Run without --dry-run to apply changes');
            }
        });

    // --- get-map: Export Project Map (for AI agents) ---
    program.command('get-map').description('Export Project Map as JSON (for AI agents and skills)')
        .argument('[project]', 'Project path', process.cwd())
        .option('-o, --output <file>', 'Output file (default: stdout)')
        .option('--compact', 'Compact JSON output (no pretty printing)')
        .action(async (project, opts) => {
            if (opts.verbose) setLogLevel('debug');
            if (opts.logFile) setLogFile(opts.logFile);
            const absolutePath = path.resolve(project);
            if (!fs.existsSync(absolutePath)) {
                logError(`Directory not found: ${absolutePath}`);
                process.exit(1);
            }
            const config = loadConfig(absolutePath);
            const finalConfig = { ...DEFAULT_CONFIG, ...(config && config.engines ? { engines: { ...DEFAULT_CONFIG.engines, ...config.engines } } : {}) };
            if (config && config.ignore) finalConfig.ignore = [...DEFAULT_CONFIG.ignore, ...config.ignore];
            const gitignoreInstance = parseGitignore(absolutePath, finalConfig.ignore);
            
            try {
                const projectMap = await buildProjectMap(absolutePath, {
                    ignore: gitignoreInstance,
                    extraIgnore: finalConfig.ignore || [],
                    include: finalConfig.include,
                    maxFileSize: finalConfig.maxFileSize,
                    forceRebuild: false
                });
                
                // Format output
                const output = opts.compact 
                    ? JSON.stringify(projectMap, null, 0)
                    : JSON.stringify(projectMap, null, 2);
                
                if (opts.output) {
                    const outputPath = path.isAbsolute(opts.output) ? opts.output : path.join(absolutePath, opts.output);
                    fs.writeFileSync(outputPath, output, 'utf-8');
                    logInfo(`✅ Project Map exported to: ${outputPath}`);
                } else {
                    // Output to stdout (for piping to other tools)
                    console.log(output);
                }
            } catch (error) {
                logError(`Failed to build Project Map: ${error.message}`);
                if (opts.verbose) console.error(error.stack);
                process.exit(1);
            }
        });

    // --- pin-context: Relevant Context Pinning (only files related to focus file) ---
    program.command('pin-context <file>').description('Get only Project Map slice for a file (dependencies + dependents). Reduces context for agents.')
        .argument('[project]', 'Project path', process.cwd())
        .option('-o, --output <file>', 'Output file (default: stdout)')
        .option('--compact', 'Compact JSON output')
        .option('--transitive', 'Include one more level of dependencies/dependents', false)
        .action(async (file, project, opts) => {
            if (opts.verbose) setLogLevel('debug');
            const absolutePath = path.resolve(project);
            if (!fs.existsSync(absolutePath)) {
                logError(`Directory not found: ${absolutePath}`);
                process.exit(1);
            }
            const config = loadConfig(absolutePath);
            const finalConfig = { ...DEFAULT_CONFIG, ...(config && config.ignore ? { ignore: [...DEFAULT_CONFIG.ignore, ...config.ignore] } : {}) };
            const gitignoreInstance = parseGitignore(absolutePath, finalConfig.ignore || []);
            const relativeFile = path.relative(absolutePath, path.isAbsolute(file) ? file : path.join(absolutePath, file)).replace(/\\/g, '/');
            try {
                const pinned = await getPinnedContext(absolutePath, relativeFile, {
                    ignore: gitignoreInstance,
                    extraIgnore: finalConfig.ignore || [],
                    include: finalConfig.include,
                    maxFileSize: finalConfig.maxFileSize,
                    transitive: opts.transitive ? 1 : 0
                });
                const output = opts.compact ? JSON.stringify(pinned, null, 0) : JSON.stringify(pinned, null, 2);
                if (opts.output) {
                    const outputPath = path.isAbsolute(opts.output) ? opts.output : path.join(absolutePath, opts.output);
                    fs.writeFileSync(outputPath, output, 'utf-8');
                    logInfo(`✅ Pinned context exported to: ${outputPath}`);
                } else {
                    console.log(output);
                }
            } catch (error) {
                logError(`Failed to get pinned context: ${error.message}`);
                if (opts.verbose) console.error(error.stack);
                process.exit(1);
            }
        });

    // --- affected / side-effects: Which files are affected if we change this file ---
    program.command('affected <file>').description('List files affected by changing the given file (dependencies + dependents). For detect-side-effects skill.')
        .argument('[project]', 'Project path', process.cwd())
        .option('--json', 'Output as JSON')
        .action(async (file, project, opts) => {
            if (opts.verbose) setLogLevel('debug');
            const absolutePath = path.resolve(project);
            if (!fs.existsSync(absolutePath)) {
                logError(`Directory not found: ${absolutePath}`);
                process.exit(1);
            }
            const config = loadConfig(absolutePath);
            const finalConfig = { ...DEFAULT_CONFIG, ...(config && config.ignore ? { ignore: [...DEFAULT_CONFIG.ignore, ...config.ignore] } : {}) };
            const gitignoreInstance = parseGitignore(absolutePath, finalConfig.ignore || []);
            const relativeFile = path.relative(absolutePath, path.isAbsolute(file) ? file : path.join(absolutePath, file)).replace(/\\/g, '/');
            try {
                const map = await buildProjectMap(absolutePath, {
                    ignore: gitignoreInstance,
                    extraIgnore: finalConfig.ignore || [],
                    include: finalConfig.include,
                    maxFileSize: finalConfig.maxFileSize
                });
                const affected = getAffectedFiles(map, relativeFile);
                if (opts.json) {
                    console.log(JSON.stringify(affected, null, 2));
                } else {
                    logInfo(`Focus: ${relativeFile}\n`);
                    console.log(colorize('Dependencies (this file imports):', 'cyan'));
                    (affected.dependencies || []).forEach(p => console.log('  ' + p));
                    console.log(colorize('\nDependents (import this file):', 'cyan'));
                    (affected.dependents || []).forEach(p => console.log('  ' + p));
                    console.log(colorize('\nTotal files affected:', 'yellow') + ' ' + (affected.all?.length || 0));
                }
            } catch (error) {
                logError(`Failed: ${error.message}`);
                process.exit(1);
            }
        });

    // --- verify: Loop-based verification after refactors ---
    program.command('verify').description('Verify Project Map: check all imports resolve. Use after refactors to confirm no broken imports.')
        .argument('[project]', 'Project path', process.cwd())
        .option('--json', 'Output as JSON')
        .action(async (project, opts) => {
            if (opts.verbose) setLogLevel('debug');
            const absolutePath = path.resolve(project);
            if (!fs.existsSync(absolutePath)) {
                logError(`Directory not found: ${absolutePath}`);
                process.exit(1);
            }
            const config = loadConfig(absolutePath);
            const finalConfig = { ...DEFAULT_CONFIG, ...(config && config.ignore ? { ignore: [...DEFAULT_CONFIG.ignore, ...config.ignore] } : {}) };
            const gitignoreInstance = parseGitignore(absolutePath, finalConfig.ignore || []);
            try {
                const result = await verifyProjectMap(absolutePath, {
                    ignore: gitignoreInstance,
                    extraIgnore: finalConfig.ignore || [],
                    include: finalConfig.include,
                    maxFileSize: finalConfig.maxFileSize
                });
                if (opts.json) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    if (result.ok) {
                        logInfo(`✅ OK: ${result.totalChecked} imports checked, 0 broken. System stable.`);
                    } else {
                        logError(`❌ ${result.brokenImports.length} broken import(s) found (${result.totalChecked} checked):`);
                        result.brokenImports.forEach(b => {
                            console.log(`   ${b.from} → ${b.import}: ${b.reason}`);
                        });
                        process.exit(1);
                    }
                }
            } catch (error) {
                logError(`Verify failed: ${error.message}`);
                if (opts.verbose) console.error(error.stack);
                process.exit(1);
            }
        });

    // --- setup-skills: Install LegacyLens skills into detected IDEs (Cursor, Claude Code, Antigravity) ---
    program.command('setup-skills').description('Install LegacyLens agent skills into detected IDEs and check GEMINI_API_KEY')
        .action((opts) => {
            if (opts.verbose) setLogLevel('debug');
            const installScriptPath = path.join(__dirname, '..', 'scripts', 'install-skills.js');
            let installSkills;
            try {
                installSkills = require(installScriptPath).installSkills;
            } catch (e) {
                logError('Could not load install-skills script: ' + e.message);
                process.exit(1);
            }
            logInfo('LegacyLens Setup Skills\n');
            const result = installSkills({
                log: (msg) => logInfo(msg, 'gray'),
                logWarn: (msg) => logWarn(msg)
            });
            if (result.installed && result.installed.length > 0) {
                logInfo('\nInstalled ' + result.skillsCount + ' skills into ' + result.idesDetected + ' IDE(s).', 'green');
            }
            if (!result.geminiKeySet) {
                logWarn('\nGEMINI_API_KEY is not set. Set it to use analyze/index/auto-fix.');
                process.exitCode = 1;
            }
        });

    return program;
}

module.exports = {
    analyzeProject,
    setupCLI,
    VERSION
};
