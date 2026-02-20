// AI Client module for Gemini API interaction
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const path = require('path');
const { logInfo, logWarn, logDebug, colorize } = require('../utils/logger');
const { DEFAULT_ENGINES } = require('./engines');

// Schema definition for structured JSON response (Deep Audit Edition v3.1.0)
const ANALYSIS_SCHEMA = {
    type: SchemaType.OBJECT,
    properties: {
        projectName: {
            type: SchemaType.STRING,
            description: "Name of the analyzed project"
        },
        complexityScore: {
            type: SchemaType.NUMBER,
            description: "0-100 score, where 100 is chaos"
        },
        executiveSummary: {
            type: SchemaType.STRING,
            description: "Brief executive summary of the codebase health"
        },
        deadCode: {
            type: SchemaType.ARRAY,
            description: "List of dead code items (unused functions, variables, files)",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    file: {
                        type: SchemaType.STRING,
                        description: "File path containing dead code"
                    },
                    lineOrFunction: {
                        type: SchemaType.STRING,
                        description: "Specific line number or function name (e.g., 'line 42' or 'function oldHelper()')"
                    },
                    confidence: {
                        type: SchemaType.STRING,
                        enum: ["High", "Medium"],
                        description: "Confidence level that this is truly dead code"
                    },
                    reason: {
                        type: SchemaType.STRING,
                        description: "Why this code is considered dead (e.g., 'Never called', 'Commented out', 'Unused import')"
                    }
                },
                required: ["file", "lineOrFunction", "confidence", "reason"]
            }
        },
        criticalIssues: {
            type: SchemaType.ARRAY,
            description: "Critical issues requiring immediate attention",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    file: {
                        type: SchemaType.STRING,
                        description: "File path with the issue"
                    },
                    issue: {
                        type: SchemaType.STRING,
                        description: "Description of the issue (e.g., 'Hardcoded API key', 'SQL injection risk', 'Infinite loop')"
                    },
                    severity: {
                        type: SchemaType.STRING,
                        enum: ["Critical", "High", "Medium"],
                        description: "Severity level of the issue"
                    },
                    recommendation: {
                        type: SchemaType.STRING,
                        description: "Specific recommendation to fix the issue"
                    }
                },
                required: ["file", "issue", "severity", "recommendation"]
            }
        },
        refactoringPlan: {
            type: SchemaType.ARRAY,
            description: "Step-by-step refactoring plan with concrete code examples",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    step: {
                        type: SchemaType.NUMBER,
                        description: "Step number in the refactoring plan"
                    },
                    action: {
                        type: SchemaType.STRING,
                        description: "Action to take (e.g., 'Extract function', 'Replace callback with async/await', 'Remove duplicate code')"
                    },
                    codeSnippetBefore: {
                        type: SchemaType.STRING,
                        description: "Code before refactoring (actual code snippet)"
                    },
                    codeSnippetAfter: {
                        type: SchemaType.STRING,
                        description: "Code after refactoring (improved version)"
                    },
                    benefit: {
                        type: SchemaType.STRING,
                        description: "Benefit of this refactoring (e.g., 'Reduces complexity', 'Improves readability', 'Fixes memory leak')"
                    },
                    target: {
                        type: SchemaType.STRING,
                        description: "Exact file or scope to change (e.g. 'src/utils/old.js', 'src/auth/')"
                    },
                    verification: {
                        type: SchemaType.STRING,
                        description: "How to verify this step (e.g. 'Run npm test', 'Run linter', 'Check build')"
                    }
                },
                required: ["step", "action", "codeSnippetBefore", "codeSnippetAfter", "benefit"]
            }
        }
    },
    required: ["projectName", "complexityScore", "executiveSummary", "deadCode", "criticalIssues", "refactoringPlan"]
};

// Use models from engines system (Flash/Pro) + fallbacks for compatibility
// Use Gemini 3 models from engines system + fallbacks for compatibility
const DEFAULT_MODELS = [
    DEFAULT_ENGINES.flash,              // Primary: Gemini 3 Flash (workhorse, 1M context)
    DEFAULT_ENGINES.pro,                // Secondary: Gemini 3 Pro (architect, complex reasoning)
    "gemini-flash-latest",              // Fallback: latest Flash alias
    "gemini-pro-latest",                // Fallback: latest Pro alias
    "gemini-2.5-flash",                 // Fallback: older Flash
    "gemini-2.5-pro",                   // Fallback: older Pro
    "gemini-1.5-flash",                 // Fallback: legacy Flash
    "gemini-1.5-pro"                    // Fallback: legacy Pro
];

async function generateMockResponse(projectPath, files, projectStats) {
    const mockComplexityScore = files.length > 50 ? 75 : files.length > 20 ? 60 : 45;
    return {
        projectName: path.basename(projectPath || 'Unknown'),
        complexityScore: mockComplexityScore,
        executiveSummary: "Mock analysis: CLI tool with modular architecture. Code quality appears moderate with room for improvement in test coverage and error handling.",
        deadCode: files.slice(0, 2).map(f => ({
            file: f.path,
            lineOrFunction: "function unusedHelper()",
            confidence: "Medium",
            reason: "Function defined but never called in the codebase"
        })),
        criticalIssues: [
            {
                file: "src/cli.js",
                issue: "Missing comprehensive error handling",
                severity: "Medium",
                recommendation: "Add try-catch blocks around critical operations and provide user-friendly error messages"
            }
        ],
        refactoringPlan: [
            {
                step: 1,
                action: "Extract configuration loading logic",
                codeSnippetBefore: "const config = JSON.parse(fs.readFileSync('config.json'));",
                codeSnippetAfter: "const config = loadConfig('config.json');\n// With proper error handling and validation",
                benefit: "Improves error handling and makes code more testable"
            },
            {
                step: 2,
                action: "Replace callback with async/await",
                codeSnippetBefore: "fs.readFile('file.txt', (err, data) => { ... });",
                codeSnippetAfter: "const data = await fs.promises.readFile('file.txt');",
                benefit: "Reduces callback hell and improves readability"
            }
        ]
    };
}

/**
 * Identifies suspicious/complex files from Project Map for targeted deep dive.
 * @param {object} projectMap - Project Map with files
 * @param {number} threshold - Complexity threshold (default: 10 exports or 20 imports)
 * @returns {Array<{ path: string, reason: string, complexity: number }>}
 */
function identifySuspiciousFiles(projectMap, threshold = { exports: 10, imports: 20, signatures: 30 }) {
    if (!projectMap || !projectMap.files) return [];
    
    const suspicious = [];
    projectMap.files.forEach(file => {
        let complexity = 0;
        const reasons = [];
        
        const exportCount = file.exports 
            ? (file.exports.named?.length || 0) + (file.exports.default ? 1 : 0)
            : 0;
        const importCount = file.imports?.length || 0;
        const signatureCount = file.signatures?.length || 0;
        
        if (exportCount > threshold.exports) {
            complexity += exportCount;
            reasons.push(`high exports (${exportCount})`);
        }
        if (importCount > threshold.imports) {
            complexity += importCount;
            reasons.push(`high imports (${importCount})`);
        }
        if (signatureCount > threshold.signatures) {
            complexity += signatureCount;
            reasons.push(`many functions/classes (${signatureCount})`);
        }
        
        if (complexity > 0) {
            suspicious.push({
                path: file.path,
                reason: reasons.join(', '),
                complexity,
                exportCount,
                importCount,
                signatureCount
            });
        }
    });
    
    // Sort by complexity (most complex first)
    return suspicious.sort((a, b) => b.complexity - a.complexity).slice(0, 10); // Top 10 most complex
}

function buildPrompt(projectContext, projectStats, options = {}) {
    const { projectMapSummary = '', semanticContext = '', projectMap = null, targetedFiles = [] } = options;
    
    // Build dead code hints from Project Map imports/exports if available
    let deadCodeHints = '';
    if (projectMap && projectMap.files && Array.isArray(projectMap.files)) {
        const exportedButNeverImported = [];
        const importedButNotExported = [];
        
        // Simple analysis: find exports that are never imported
        const allExports = new Set();
        const allImports = new Set();
        
        projectMap.files.forEach(file => {
            // Handle exports structure: { named: [...], default: [...] } or array
            if (file.exports) {
                try {
                    if (Array.isArray(file.exports)) {
                        // Old format: array
                        file.exports.forEach(exp => {
                            allExports.add(`${file.path}:${exp}`);
                        });
                    } else if (typeof file.exports === 'object' && file.exports !== null) {
                        // New format: { named: [...], default: [...] }
                        if (file.exports.named) {
                            const namedExports = Array.isArray(file.exports.named) 
                                ? file.exports.named 
                                : (file.exports.named instanceof Set ? Array.from(file.exports.named) : []);
                            namedExports.forEach(exp => {
                                if (exp) allExports.add(`${file.path}:${exp}`);
                            });
                        }
                        if (file.exports.default) {
                            allExports.add(`${file.path}:${file.exports.default} (default)`);
                        }
                    }
                } catch (e) {
                    // Skip invalid exports structure
                    console.error(`Error processing exports for ${file.path}:`, e.message);
                }
            }
            // Handle imports: can be string or array
            if (file.imports) {
                try {
                    if (Array.isArray(file.imports)) {
                        file.imports.forEach(imp => {
                            if (imp) allImports.add(imp);
                        });
                    } else if (typeof file.imports === 'string') {
                        allImports.add(file.imports);
                    }
                } catch (e) {
                    // Skip invalid imports structure
                    console.error(`Error processing imports for ${file.path}:`, e.message);
                }
            }
        });
        
        // Find potentially dead exports (exported but never imported)
        projectMap.files.forEach(file => {
            if (file.exports) {
                try {
                    let exportsToCheck = [];
                    if (Array.isArray(file.exports)) {
                        exportsToCheck = file.exports;
                    } else if (typeof file.exports === 'object' && file.exports !== null) {
                        if (file.exports.named) {
                            const namedExports = Array.isArray(file.exports.named) 
                                ? file.exports.named 
                                : (file.exports.named instanceof Set ? Array.from(file.exports.named) : []);
                            exportsToCheck = [...namedExports];
                        }
                        if (file.exports.default) {
                            exportsToCheck.push(file.exports.default);
                        }
                    }
                    
                    exportsToCheck.forEach(exp => {
                        if (exp && !allImports.has(exp) && !allImports.has(file.path)) {
                            exportedButNeverImported.push(`${file.path} exports "${exp}"`);
                        }
                    });
                } catch (e) {
                    // Skip invalid exports structure
                    console.error(`Error checking dead exports for ${file.path}:`, e.message);
                }
            }
        });
        
        if (exportedButNeverImported.length > 0) {
            deadCodeHints = `\n\nPOTENTIAL DEAD CODE (from Project Map analysis):\n${exportedButNeverImported.slice(0, 10).join('\n')}\n(These exports may be unused - verify before marking as dead)`;
        }
    }
    
    // 🔥 LEVEL 3: Targeted Deep Dive - Add full content of suspicious files
    let deepDiveSection = '';
    if (targetedFiles && targetedFiles.length > 0) {
        deepDiveSection = `\n\n🔍 TARGETED DEEP DIVE (Complex/Suspicious Files - Full Content):\n`;
        deepDiveSection += `These files were identified as highly complex or suspicious based on Project Map analysis.\n`;
        deepDiveSection += `Please analyze them in detail:\n\n`;
        targetedFiles.forEach(file => {
            deepDiveSection += `--- ${file.path} (${file.reason}) ---\n`;
            deepDiveSection += `${file.content}\n\n`;
        });
    }
    
    return `You are a ruthless Senior Software Architect performing a Legacy Code Audit.
Your goal is to reduce technical debt, identify dead code, and modernize the codebase.

${projectMapSummary ? `📊 PROJECT STRUCTURE MAP (Architectural Skeleton - Level 1):\n${projectMapSummary}\n\n` : ''}${semanticContext ? `${semanticContext}\n\n` : ''}📁 PROJECT CONTEXT (Compressed Source Files - Level 2):
${projectContext}${deepDiveSection}

PROJECT STATISTICS:
- Files: ${projectStats.filesCount}
- Context size: ${projectContext.length >= 1024 * 1024 ? (projectContext.length / 1024 / 1024).toFixed(2) + ' MB' : (projectContext.length / 1024).toFixed(2) + ' KB'}
- Languages: ${projectStats.languages.join(', ') || 'unknown'}
${projectMapSummary ? `- Project Map: ${projectMapSummary.length} chars (structure, imports/exports, signatures)` : ''}

ANALYSIS RULES:
1. DEAD CODE: Identify variables, functions, or files that look unused or commented out. Be specific:
   - Use the Project Map above to check if exports are actually imported elsewhere
   - Provide exact file path and line number or function name
   - Explain why it's dead (e.g., "Never called", "Commented out", "Unused import", "Exported but never imported")
   - Use "High" confidence only if you're certain, "Medium" if likely
   ${deadCodeHints}

2. SECURITY: Look for hardcoded secrets, weak comparisons, or injection vulnerabilities:
   - Hardcoded API keys, passwords, tokens
   - SQL injection risks
   - XSS vulnerabilities
   - Weak cryptographic practices

3. REFACTORING: Provide concrete "Before" vs "After" code examples:
   - Don't just say "refactor this", show HOW with actual code
   - Include complete code snippets (not just descriptions)
   - Explain the benefit of each refactoring

4. ACTIONABLE: Your steps must be clear enough for a Junior Developer to execute:
   - Use specific file paths
   - Provide exact line numbers when possible
   - Give concrete git commands if applicable (e.g., "git rm unused-file.js")

OUTPUT REQUIREMENTS:
- complexityScore: 0 = perfect, 100 = chaos (be harsh but fair)
- executiveSummary: One paragraph summarizing the codebase health
- deadCode: At least 3-5 items if any exist, be thorough
- criticalIssues: Focus on security and maintainability issues
- refactoringPlan: Minimum 3 concrete steps. For EACH step include:
  - step, action, codeSnippetBefore, codeSnippetAfter, benefit (required)
  - target: exact file path to change (e.g. "src/utils/old.js")
  - verification: how to verify after this step (e.g. "Run npm test", "Run lint", "Build project")

REFACTORING ROADMAP (for agents): Each step must be executable in order: Step 1 → do X → verify; Step 2 → do Y → verify.
Example: "Step 1: Delete src/legacy.js. Target: src/legacy.js. Verify: npm test. Step 2: Update imports in src/app.js. Verify: npm run build."

Be ruthless but accurate. Don't make up issues that don't exist, but don't sugarcoat problems either.`;
}

async function callGeminiAPI(apiKey, modelName, prompt, options = {}) {
    const {
        requestTimeout = 120000,
        maxRetries = 3,
        retryDelay = 2000
    } = options;

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelsToTry = modelName ? [modelName, ...DEFAULT_MODELS] : DEFAULT_MODELS;
    const uniqueModels = [...new Set(modelsToTry)];

    if (uniqueModels.length > 1) {
        logInfo(`   Trying models: ${uniqueModels.slice(0, 3).join(', ')}${uniqueModels.length > 3 ? '...' : ''}`, 'gray');
        logDebug(`All models to try: ${uniqueModels.join(', ')}`);
    }

    let result;
    let usedModel = null;
    let lastError = null;

    const executeWithRetry = async (modelName, attempt = 1) => {
        const cleanModelName = modelName.replace('models/', '');

        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('API request timeout')), requestTimeout);
            });

            // Use Schema Response for structured JSON output
            // Note: Some models may not support responseSchema, so we'll handle errors gracefully
            let model;
            try {
                model = genAI.getGenerativeModel({
                    model: cleanModelName,
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: ANALYSIS_SCHEMA,
                        temperature: 0.2, // Low temperature for accuracy
                    }
                });
            } catch (schemaError) {
                // Fallback: if schema is not supported, use regular model
                logDebug(`Schema Response not supported for ${cleanModelName}, using regular mode`);
                model = genAI.getGenerativeModel({ model: cleanModelName });
            }
            const contentPromise = model.generateContent(prompt);

            const response = await Promise.race([contentPromise, timeoutPromise]);
            return { response, modelName: cleanModelName };
        } catch (error) {
            // Check if error is related to Schema Response not being supported
            const isSchemaError = error.message && (
                error.message.includes('responseSchema') ||
                error.message.includes('responseMimeType') ||
                error.message.includes('schema') ||
                error.message.includes('400') // Bad request often means unsupported feature
            );
            
            // If Schema Response failed, retry with regular model (only once)
            if (isSchemaError && attempt === 1) {
                logDebug(`Schema Response not supported, retrying with regular model...`);
                try {
                    const fallbackModel = genAI.getGenerativeModel({ model: cleanModelName });
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('API request timeout')), requestTimeout);
                    });
                    const contentPromise = fallbackModel.generateContent(prompt);
                    const response = await Promise.race([contentPromise, timeoutPromise]);
                    return { response, modelName: cleanModelName };
                } catch (fallbackError) {
                    // If fallback also fails, continue with normal error handling
                    logDebug(`Fallback model also failed: ${fallbackError.message}`);
                }
            }
            
            const isNetworkError = error.message && (
                error.message.includes('fetch') ||
                error.message.includes('network') ||
                error.message.includes('ECONNREFUSED') ||
                error.message.includes('ETIMEDOUT') ||
                error.message.includes('ENOTFOUND') ||
                error.message.includes('timeout') ||
                error.message.includes('Timeout')
            );

            const isRateLimit = error.message && (
                error.message.includes('429') ||
                error.message.includes('rate limit') ||
                error.message.includes('quota')
            );

            const isServerError = error.message && (
                error.message.includes('500') ||
                error.message.includes('502') ||
                error.message.includes('503') ||
                error.message.includes('504')
            );

            if ((isNetworkError || isRateLimit || isServerError) && attempt < maxRetries) {
                const delay = retryDelay * attempt;
                logWarn(`   ⚠️  Error (attempt ${attempt}/${maxRetries}): ${error.message}`);
                logInfo(`   🔄 Retrying in ${delay / 1000} seconds...`, 'yellow');
                logDebug(`Error details: ${error.stack || error.message}`);

                await new Promise(resolve => setTimeout(resolve, delay));
                return executeWithRetry(modelName, attempt + 1);
            }

            if (error.message && (error.message.includes('404') || error.message.includes('not found'))) {
                throw error;
            }

            throw error;
        }
    };

    for (const modelName of uniqueModels) {
        try {
            if (uniqueModels.length > 1) {
                process.stdout.write(colorize(`   Trying model: ${modelName.replace('models/', '')}... `, 'gray'));
            }

            const response = await executeWithRetry(modelName);
            result = response.response;
            usedModel = response.modelName;

            if (uniqueModels.length > 1) {
                console.log(colorize('✅', 'green'));
            } else {
                console.log(colorize(`✅ Using model: ${usedModel}\n`, 'green'));
            }
            break;
        } catch (modelError) {
            lastError = modelError;
            if (modelError.message && (modelError.message.includes('404') || modelError.message.includes('not found'))) {
                if (uniqueModels.length > 1) {
                    console.log(colorize('❌', 'red'));
                }
                logDebug(`Model ${modelName} not found, trying next...`);
                continue;
            }
            throw modelError;
        }
    }

    if (!result || !usedModel) {
        const errorMsg = lastError ? `\nLast error: ${lastError.message}` : '';
        console.error(colorize('\n❌ Failed to find an available model.', 'red'));
        console.error('Please check:');
        console.error('  1. Is your API key correct?');
        console.error('  2. Do you have access to Gemini API?');
        console.error('  3. Is your internet connection working?');
        console.error('  4. Try a different model: --model=gemini-3-pro-preview');
        if (errorMsg) {
            logDebug(errorMsg);
        }
        throw new Error('Failed to find an available model');
    }

    // With Schema Response, we get clean JSON directly
    const responseText = result.response.text();
    
    // Direct parsing - Schema Response guarantees valid JSON
    let jsonData;
    try {
        jsonData = JSON.parse(responseText);
    } catch (e) {
        throw new Error(`AI returned invalid JSON: ${responseText.substring(0, 200)}...`);
    }
    
    // Return only JSON (formatters will handle display)
    return {
        json: jsonData,
        model: usedModel
    };
}

module.exports = {
    generateMockResponse,
    buildPrompt,
    callGeminiAPI,
    identifySuspiciousFiles,
    DEFAULT_MODELS
};
