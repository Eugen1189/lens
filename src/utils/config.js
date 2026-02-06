// Configuration module
const fs = require('fs');
const path = require('path');

// Default settings
const DEFAULT_CONFIG = {
    ignore: ['.git', 'node_modules', 'dist', 'build', '.env', '__pycache__', 'venv', '.vscode', '.idea', 'out'],
    include: ['.py', '.js', '.ts', '.json', '.md', '.html', '.css', '.php', '.java', '.cpp'],
    maxFileSize: 50000,        // 50KB per file
    maxContextSize: 1000000,   // 1MB for large projects
    outputFile: 'legacylens-report.md',
    maxConcurrentReads: 20
};

function loadConfig(projectPath) {
    const configPath = path.join(projectPath, '.legacylens.json');
    
    if (!fs.existsSync(configPath)) {
        return null;
    }

    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        return null;
    }
}

module.exports = {
    DEFAULT_CONFIG,
    loadConfig
};
