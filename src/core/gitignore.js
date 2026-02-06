// .gitignore parser module using professional 'ignore' package
const fs = require('fs');
const path = require('path');
const ignore = require('ignore');

/**
 * Creates an ignore instance with rules from .gitignore and config
 * @param {string} projectPath - path to project root
 * @param {Array} configIgnore - additional rules from .legacylens.json
 * @returns {Object} ignore instance
 */
function parseGitignore(projectPath, configIgnore = []) {
    const ig = ignore();
    
    // Always ignore system folders (unless specified in config)
    const defaultIgnores = ['.git', 'node_modules', 'coverage', '.DS_Store', 'Thumbs.db'];
    defaultIgnores.forEach(pattern => {
        if (!configIgnore.includes(pattern)) {
            ig.add(pattern);
        }
    });

    // Add rules from config
    if (configIgnore && configIgnore.length > 0) {
        ig.add(configIgnore);
    }

    // Read .gitignore
    const gitignorePath = path.join(projectPath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
        try {
            const content = fs.readFileSync(gitignorePath, 'utf8');
            ig.add(content);
        } catch (error) {
            // Silently fail - not a critical error
        }
    }

    // Add support for .legacylensignore (if exists)
    const legacylensIgnorePath = path.join(projectPath, '.legacylensignore');
    if (fs.existsSync(legacylensIgnorePath)) {
        try {
            const content = fs.readFileSync(legacylensIgnorePath, 'utf8');
            ig.add(content);
        } catch (e) {
            // Silently fail
        }
    }

    return ig;
}

/**
 * Checks if a file should be ignored
 * @param {string} filePath - absolute file path
 * @param {string} relativePath - relative path from project root
 * @param {Object} ig - ignore instance
 * @returns {boolean} true if file should be ignored
 */
function shouldIgnore(filePath, relativePath, ig) {
    if (!ig) {
        return false;
    }
    
    // ignore package expects relative paths without leading slash
    // Normalize path: replace backslash with forward slash and remove leading slash
    let normalizedPath = relativePath.replace(/\\/g, '/');
    if (normalizedPath.startsWith('/') || normalizedPath.startsWith('\\')) {
        normalizedPath = normalizedPath.slice(1);
    }
    
    return ig.ignores(normalizedPath);
}

module.exports = {
    parseGitignore,
    shouldIgnore
};
