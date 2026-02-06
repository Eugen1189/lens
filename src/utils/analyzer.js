// Code analysis utilities
const fs = require('fs');
const path = require('path');
const { logDebug } = require('./logger');

function analyzeDependencies(projectPath) {
    const dependencies = {
        node: null,
        python: null,
        java: null,
        hasTests: false,
        hasCI: false
    };

    try {
        // Check package.json (Node.js)
        const packageJsonPath = path.join(projectPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            dependencies.node = {
                name: packageJson.name || 'unknown',
                version: packageJson.version || 'unknown',
                dependencies: Object.keys(packageJson.dependencies || {}).length,
                devDependencies: Object.keys(packageJson.devDependencies || {}).length,
                scripts: Object.keys(packageJson.scripts || {}),
                hasTestScript: Object.keys(packageJson.scripts || {}).some(s => s.includes('test'))
            };
            dependencies.hasTests = dependencies.node.hasTestScript || fs.existsSync(path.join(projectPath, '__tests__')) || fs.existsSync(path.join(projectPath, 'tests'));
        }

        // Check requirements.txt (Python)
        const requirementsPath = path.join(projectPath, 'requirements.txt');
        if (fs.existsSync(requirementsPath)) {
            const requirements = fs.readFileSync(requirementsPath, 'utf-8');
            const deps = requirements.split('\n').filter(line => line.trim() && !line.startsWith('#'));
            dependencies.python = {
                dependenciesCount: deps.length,
                dependencies: deps.slice(0, 10) // First 10 as example
            };
        }

        // Check pom.xml (Java/Maven)
        const pomXmlPath = path.join(projectPath, 'pom.xml');
        if (fs.existsSync(pomXmlPath)) {
            dependencies.java = {
                type: 'Maven',
                exists: true
            };
        }

        // Check CI/CD
        const ciPaths = [
            path.join(projectPath, '.github', 'workflows'),
            path.join(projectPath, '.gitlab-ci.yml'),
            path.join(projectPath, '.travis.yml'),
            path.join(projectPath, 'Jenkinsfile')
        ];
        dependencies.hasCI = ciPaths.some(p => fs.existsSync(p));

    } catch (e) {
        logDebug(`Error analyzing dependencies: ${e.message}`);
    }

    return dependencies;
}

function calculateCodeMetrics(files) {
    const metrics = {
        totalLines: 0,
        totalFiles: files.length,
        languages: {},
        averageFileSize: 0,
        largestFile: null,
        smallestFile: null
    };

    let totalSize = 0;
    let maxSize = 0;
    let minSize = Infinity;

    files.forEach(file => {
        const content = file.content || '';
        const lines = content.split('\n').length;
        const size = content.length;
        const ext = path.extname(file.path).toLowerCase() || '.unknown';

        metrics.totalLines += lines;
        totalSize += size;

        if (size > maxSize) {
            maxSize = size;
            metrics.largestFile = { path: file.path, size: size, lines: lines };
        }
        if (size < minSize && size > 0) {
            minSize = size;
            metrics.smallestFile = { path: file.path, size: size, lines: lines };
        }

        if (!metrics.languages[ext]) {
            metrics.languages[ext] = { count: 0, lines: 0, size: 0 };
        }
        metrics.languages[ext].count++;
        metrics.languages[ext].lines += lines;
        metrics.languages[ext].size += size;
    });

    metrics.averageFileSize = files.length > 0 ? Math.round(totalSize / files.length) : 0;

    return metrics;
}

module.exports = {
    analyzeDependencies,
    calculateCodeMetrics
};
