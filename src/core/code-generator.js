/**
 * CodeGenerator: uses Gemini 3 Flash to generate code and write it to files.
 * Enables commands like: legacylens create-api --route /users
 * ContextEngine provides project map so the model doesn't hallucinate paths.
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getModelForTask } = require('./engines');
const { getContextForPrompt, buildProjectMap } = require('./context-engine');
const { logInfo, logError, logDebug } = require('../utils/logger');

/**
 * Generates raw text (e.g. code) from Gemini Flash – no JSON schema.
 * @param {string} apiKey
 * @param {string} modelName - e.g. gemini-3-flash-preview
 * @param {string} prompt
 * @returns {Promise<{ text: string, model: string }>}
 */
async function generateText(apiKey, modelName, prompt) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelName.replace('models/', ''),
        generationConfig: { temperature: 0.2 }
    });
    const result = await model.generateContent(prompt);
    const response = result.response;
    if (!response || !response.text) throw new Error('Empty response from model');
    return { text: response.text(), model: modelName };
}

/**
 * Extracts code block from model output (```lang ... ```).
 * @param {string} raw
 * @param {string} [language] - e.g. 'javascript', 'python'
 * @returns {string}
 */
function extractCodeBlock(raw, language = '') {
    const lang = (language || 'javascript').toLowerCase();
    const regex = new RegExp(`\`\`\`(?:${lang})?\\s*([\\s\\S]*?)\`\`\``, 'm');
    const m = raw.match(regex);
    return m ? m[1].trim() : raw.trim();
}

/**
 * Detects framework/stack from project files (package.json, requirements.txt, etc.)
 * @param {string} projectPath
 * @returns {Promise<{ framework: string, language: string, patterns: string[] }>}
 */
async function detectFramework(projectPath) {
    const packageJson = path.join(projectPath, 'package.json');
    const requirementsTxt = path.join(projectPath, 'requirements.txt');
    const pyprojectToml = path.join(projectPath, 'pyproject.toml');
    
    let framework = 'unknown';
    let language = 'javascript';
    const patterns = [];
    
    // Check Node.js frameworks
    if (fs.existsSync(packageJson)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            
            if (deps.express) {
                framework = 'express';
                patterns.push('Express.js', 'module.exports', 'app.get', 'router');
            } else if (deps['@fastify/fastify']) {
                framework = 'fastify';
                patterns.push('Fastify', 'fastify.get');
            } else if (deps.koa) {
                framework = 'koa';
                patterns.push('Koa.js', 'router.get');
            } else if (deps.next) {
                framework = 'nextjs';
                patterns.push('Next.js', 'API routes', 'pages/api');
            }
        } catch (e) {
            logDebug(`Failed to parse package.json: ${e.message}`);
        }
    }
    
    // Check Python frameworks
    if (fs.existsSync(requirementsTxt) || fs.existsSync(pyprojectToml)) {
        language = 'python';
        try {
            const reqContent = fs.existsSync(requirementsTxt) 
                ? fs.readFileSync(requirementsTxt, 'utf-8') 
                : '';
            
            if (reqContent.includes('fastapi') || reqContent.includes('FastAPI')) {
                framework = 'fastapi';
                patterns.push('FastAPI', '@app.get', 'from fastapi import');
            } else if (reqContent.includes('flask') || reqContent.includes('Flask')) {
                framework = 'flask';
                patterns.push('Flask', '@app.route', 'from flask import');
            } else if (reqContent.includes('django') || reqContent.includes('Django')) {
                framework = 'django';
                patterns.push('Django', 'views.py', 'urls.py');
            }
        } catch (e) {
            logDebug(`Failed to read requirements: ${e.message}`);
        }
    }
    
    return { framework, language, patterns };
}

/**
 * Generates code for a task (e.g. "create GET /users API route") with project context.
 * @param {string} projectPath - Project root
 * @param {string} userPrompt - e.g. "Create a GET /users API route that returns a list of users"
 * @param {object} options - { apiKey, model?, ignore (for ContextEngine), engines }
 * @returns {Promise<{ text: string, code: string, model: string, framework: string }>}
 */
async function generateCode(projectPath, userPrompt, options = {}) {
    const apiKey = options.apiKey;
    if (!apiKey) throw new Error('API key required for CodeGenerator');

    const modelName = options.model || getModelForTask('generate', options.engines);
    const context = await getContextForPrompt(projectPath, { ignore: options.ignore });
    
    // 🔥 IMPROVEMENT: Detect framework for context-aware generation
    const { framework, language, patterns } = await detectFramework(projectPath);
    logDebug(`Detected framework: ${framework} (${language}), patterns: ${patterns.join(', ')}`);
    
    // Build enhanced prompt with framework context
    const frameworkHint = framework !== 'unknown' 
        ? `\nFRAMEWORK CONTEXT: This project uses ${framework.toUpperCase()}. Use ${patterns.join(', ')} patterns. Match the existing code style.`
        : '';
    
    const fullPrompt = [
        context,
        frameworkHint,
        '',
        'TASK:',
        userPrompt,
        '',
        `Respond with a single code block (markdown \`\`\`${language} or appropriate language). Match the project's framework and coding style. Do not include explanations outside the code block unless asked.`
    ].join('\n');

    const { text, model } = await generateText(apiKey, modelName, fullPrompt);
    const code = extractCodeBlock(text, options.language || language);
    return { text, code, model, framework };
}

/**
 * Writes generated code to a file (creates dirs if needed).
 * @param {string} projectPath - Project root
 * @param {string} relativePath - e.g. routes/users.js
 * @param {string} content
 */
function writeToFile(projectPath, relativePath, content) {
    const fullPath = path.join(projectPath, relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logDebug(`Created directory: ${dir}`);
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
    logInfo(`Wrote: ${relativePath}`);
}

/**
 * High-level: generate code for "create-api --route /users" and write to file.
 * @param {string} projectPath
 * @param {string} route - e.g. /users
 * @param {object} options - apiKey, model?, outputPath? (default routes/users.js or similar), ignore, engines
 * @returns {Promise<{ path: string, code: string, model: string }>}
 */
async function createApiRoute(projectPath, route, options = {}) {
    // 🔥 IMPROVEMENT: Detect framework first to determine file structure
    const { framework, language } = await detectFramework(projectPath);
    
    // Determine file path based on framework
    let defaultFile;
    if (framework === 'fastapi' || framework === 'flask') {
        defaultFile = `routes/${route.replace(/^\//, '').replace(/\//g, '_')}.py`;
    } else if (framework === 'django') {
        defaultFile = `api/views.py`; // Django uses views.py
    } else {
        // Default to Express/Node.js
        const normalizedRoute = route.replace(/^\//, '').replace(/\//g, '-');
        defaultFile = `routes/${normalizedRoute}.js`;
    }
    
    const outputPath = options.outputPath || defaultFile;
    
    // Build context-aware prompt
    const frameworkSpecific = framework === 'fastapi' 
        ? 'Use FastAPI decorators (@app.get, @app.post). Include proper type hints and Pydantic models if needed.'
        : framework === 'flask'
        ? 'Use Flask decorators (@app.route). Include proper error handling.'
        : framework === 'django'
        ? 'Use Django class-based views or function-based views. Follow Django conventions.'
        : 'Use Express-style (module.exports = router or app.get). Include proper error handling.';
    
    const userPrompt = `Create a REST API route for "${route}". Include: handler for GET (and optionally POST if it makes sense). ${frameworkSpecific} File path where this will be saved: ${outputPath}.`;
    
    const { code, model, framework: detectedFramework } = await generateCode(projectPath, userPrompt, options);

    writeToFile(projectPath, outputPath, code);
    return { path: outputPath, code, model, framework: detectedFramework };
}

module.exports = {
    generateText,
    extractCodeBlock,
    detectFramework,
    generateCode,
    writeToFile,
    createApiRoute
};
