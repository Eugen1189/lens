/**
 * Auto-Fix: Safe dead code removal using Project Map and AI confirmation.
 * Uses Project Map to identify unused exports/imports and AI to confirm they're safe to remove.
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getModelForTask } = require('./engines');
const { buildProjectMap } = require('./context-builder');
const { logInfo, logError, logWarn, logDebug } = require('../utils/logger');

/**
 * Finds potentially dead code using Project Map (exports never imported).
 * @param {object} projectMap - From buildProjectMap()
 * @returns {Array<{ file: string, export: string, reason: string }>}
 */
function findDeadExports(projectMap) {
    if (!projectMap || !projectMap.files) return [];
    
    const allExports = new Map(); // file -> Set of exports
    const allImports = new Set();
    
    // Collect all exports and imports
    projectMap.files.forEach(file => {
        if (file.exports) {
            const exports = [];
            if (file.exports.named && Array.isArray(file.exports.named)) {
                exports.push(...file.exports.named);
            }
            if (file.exports.default) {
                exports.push(`${file.exports.default} (default)`);
            }
            
            if (exports.length > 0) {
                allExports.set(file.path, new Set(exports));
            }
        }
        
        if (file.imports && Array.isArray(file.imports)) {
            file.imports.forEach(imp => {
                // Extract module name from import path
                const moduleName = imp.split('/').pop().replace(/\.(js|ts|jsx|tsx)$/, '');
                allImports.add(moduleName);
                allImports.add(imp); // Also add full path
            });
        }
    });
    
    // Find exports that are never imported
    const deadExports = [];
    allExports.forEach((exports, filePath) => {
        exports.forEach(exp => {
            const exportName = exp.replace(' (default)', '').trim();
            // Check if this export is imported anywhere
            const isImported = Array.from(allImports).some(imp => 
                imp.includes(exportName) || 
                imp === exportName ||
                imp === filePath
            );
            
            if (!isImported) {
                deadExports.push({
                    file: filePath,
                    export: exportName,
                    reason: `Export "${exportName}" is never imported anywhere in the project`
                });
            }
        });
    });
    
    return deadExports;
}

/**
 * Uses AI to confirm if dead code is safe to remove (not public API, not used dynamically, etc.).
 * @param {string} apiKey
 * @param {string} filePath
 * @param {string} exportName
 * @param {string} fileContent
 * @param {object} projectMap
 * @returns {Promise<{ safe: boolean, reason: string }>}
 */
async function confirmSafeToRemove(apiKey, filePath, exportName, fileContent, projectMap) {
    const modelName = getModelForTask('audit'); // Use Flash for quick confirmation
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelName.replace('models/', ''),
        generationConfig: { temperature: 0.1 } // Low temperature for accuracy
    });
    
    const prompt = `You are analyzing code for safe removal. Check if this export can be safely deleted.

FILE: ${filePath}
EXPORT: ${exportName}

FILE CONTENT (first 2000 chars):
${fileContent.slice(0, 2000)}

PROJECT CONTEXT:
- This export is not imported anywhere in the project (verified via Project Map)
- Check if it's:
  1. A public API (exported for external use)
  2. Used dynamically (eval, require(dynamic), etc.)
  3. Part of a plugin system
  4. Used in tests (check test files)
  5. Documented as public API

Respond with JSON only:
{
  "safe": true/false,
  "reason": "brief explanation",
  "confidence": "High" or "Medium"
}`;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response.text();
        
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const decision = JSON.parse(jsonMatch[0]);
            return decision;
        }
        
        // Fallback: if response contains "safe: false" or "not safe", be conservative
        if (response.toLowerCase().includes('not safe') || response.toLowerCase().includes('public api')) {
            return { safe: false, reason: 'AI detected potential public API or dynamic usage', confidence: 'Medium' };
        }
        
        return { safe: true, reason: 'No public API indicators found', confidence: 'Medium' };
    } catch (e) {
        logDebug(`AI confirmation failed: ${e.message}`);
        // Conservative: if AI fails, don't remove
        return { safe: false, reason: 'AI confirmation failed - being conservative', confidence: 'Low' };
    }
}

/**
 * Removes dead export from file.
 * @param {string} filePath - Full path to file
 * @param {string} exportName - Name of export to remove
 * @param {string} fileContent - Current file content
 * @returns {string} - Modified content
 */
function removeExportFromFile(filePath, fileContent, exportName) {
    // Simple removal: comment out or remove export line
    // This is a basic implementation - could be improved with AST parsing
    
    const lines = fileContent.split('\n');
    const modified = [];
    let inExportBlock = false;
    let exportBlockStart = -1;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if this line exports the target
        if (line.includes(`export`) && line.includes(exportName)) {
            // Comment out instead of removing (safer)
            modified.push(`// REMOVED: ${line.trim()}`);
            logDebug(`Commented out export: ${line.trim()}`);
            continue;
        }
        
        modified.push(line);
    }
    
    return modified.join('\n');
}

/**
 * Main auto-fix function: finds and removes dead code with AI confirmation.
 * @param {string} projectPath
 * @param {object} options - { apiKey, dryRun?, confirm?, ignore }
 * @returns {Promise<{ removed: number, skipped: number, errors: number }>}
 */
async function autoFix(projectPath, options = {}) {
    const { apiKey, dryRun = false, confirm = true, ignore } = options;
    
    if (!apiKey) throw new Error('API key required for auto-fix');
    
    logInfo('🔍 Building Project Map to find dead code...');
    const projectMap = await buildProjectMap(projectPath, { ignore });
    
    logInfo('🔎 Analyzing exports for dead code...');
    const deadExports = findDeadExports(projectMap);
    
    if (deadExports.length === 0) {
        logInfo('✅ No dead exports found!');
        return { removed: 0, skipped: 0, errors: 0 };
    }
    
    logInfo(`Found ${deadExports.length} potentially dead exports`);
    
    let removed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const item of deadExports) {
        const fullPath = path.join(projectPath, item.file);
        
        if (!fs.existsSync(fullPath)) {
            logWarn(`File not found: ${item.file}`);
            skipped++;
            continue;
        }
        
        try {
            const fileContent = fs.readFileSync(fullPath, 'utf-8');
            
            // AI confirmation
            logDebug(`Confirming safety: ${item.file} -> ${item.export}`);
            const confirmation = await confirmSafeToRemove(apiKey, item.file, item.export, fileContent, projectMap);
            
            if (!confirmation.safe) {
                logWarn(`⚠️  Skipping ${item.file}:${item.export} - ${confirmation.reason}`);
                skipped++;
                continue;
            }
            
            if (dryRun) {
                logInfo(`[DRY RUN] Would remove: ${item.file}:${item.export} (${confirmation.reason})`);
                removed++;
                continue;
            }
            
            if (confirm) {
                // In interactive mode, would prompt user here
                // For now, log and proceed
                logInfo(`✓ Safe to remove: ${item.file}:${item.export} (${confirmation.reason}, confidence: ${confirmation.confidence})`);
            }
            
            // Remove the export
            const modifiedContent = removeExportFromFile(fullPath, fileContent, item.export);
            fs.writeFileSync(fullPath, modifiedContent, 'utf-8');
            logInfo(`✅ Removed: ${item.file}:${item.export}`);
            removed++;
            
        } catch (e) {
            logError(`Error processing ${item.file}: ${e.message}`);
            errors++;
        }
    }
    
    return { removed, skipped, errors };
}

module.exports = {
    findDeadExports,
    confirmSafeToRemove,
    removeExportFromFile,
    autoFix
};
