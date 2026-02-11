// Cache utility module
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { VERSION } = require('./constants');

async function calculateProjectHash(files) {
    // Create hash based on file paths and content (not just size)
    // Sort files to ensure consistent hash regardless of scan order
    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
    
    const hash = crypto.createHash('sha256');
    for (const file of sortedFiles) {
        // Hash both path and content to detect any changes
        hash.update(`${file.path}:${file.content}`);
    }
    return hash.digest('hex');
}

function loadCache(projectPath) {
    const cachePath = path.join(projectPath, '.legacylens-cache.json');
    
    if (!fs.existsSync(cachePath)) {
        return null;
    }

    try {
        const content = fs.readFileSync(cachePath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        return null;
    }
}

function saveCache(projectPath, projectHash, report, model) {
    const { logWarn } = require('./logger');
    const cachePath = path.join(projectPath, '.legacylens-cache.json');
    
    try {
        const cacheData = {
            hash: projectHash,
            report: report,
            model: model,
            timestamp: Date.now(),
            version: VERSION
        };
        fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf-8');
        return true; // Return true on success
    } catch (error) {
        logWarn(`Failed to save cache to ${cachePath}: ${error.message}`);
        return false; // Return false on error
    }
}

module.exports = {
    calculateProjectHash,
    loadCache,
    saveCache
};
