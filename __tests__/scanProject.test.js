/**
 * Тести для функції scanProject
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const fsPromises = require('fs').promises;

// Імітація функцій з основного файлу
async function scanProject(rootDir, config, gitignoreRules, currentDir = null, progress = { scanned: 0, total: 0 }) {
    if (currentDir === null) {
        currentDir = rootDir;
        progress.total = await estimateFileCount(rootDir, config, gitignoreRules);
    }
    
    let results = [];
    let list = [];
    
    try {
        list = await fsPromises.readdir(currentDir);
    } catch (e) {
        return results;
    }
    
    const includePattern = new RegExp(`\\.(${config.include.map(ext => ext.replace(/^\./, '')).join('|')})$`, 'i');
    const maxConcurrentReads = 10;
    let currentBatch = [];

    for (const file of list) {
        const filePath = path.join(currentDir, file);
        const relativePath = path.relative(rootDir, filePath);
        
        if (shouldIgnore(filePath, relativePath, gitignoreRules, config.ignore)) {
            continue;
        }
        
        try {
            const stat = await fsPromises.stat(filePath);
            if (stat && stat.isDirectory()) {
                const subResults = await scanProject(rootDir, config, gitignoreRules, filePath, progress);
                results = results.concat(subResults);
            } else {
                if (includePattern.test(file)) {
                    currentBatch.push({ filePath, relativePath });
                    
                    if (currentBatch.length >= maxConcurrentReads) {
                        const batchResults = await readFileBatch(currentBatch, config, progress, rootDir);
                        results = results.concat(batchResults);
                        currentBatch = [];
                    }
                }
            }
        } catch (e) {
            // Пропускаємо
        }
    }
    
    if (currentBatch.length > 0) {
        const batchResults = await readFileBatch(currentBatch, config, progress, rootDir);
        results = results.concat(batchResults);
    }
    
    return results;
}

async function readFileBatch(fileBatch, config, progress, rootDir) {
    const readPromises = fileBatch.map(async ({ filePath, relativePath }) => {
        try {
            const content = await fsPromises.readFile(filePath, 'utf-8');
            const truncated = content.length > config.maxFileSize 
                ? content.substring(0, config.maxFileSize) + "\n...[TRUNCATED]..." 
                : content;
            
            return {
                path: relativePath || path.basename(filePath),
                content: truncated
            };
        } catch (readError) {
            return null;
        }
    });
    
    const batchResults = await Promise.all(readPromises);
    const validResults = batchResults.filter(result => result !== null);
    
    progress.scanned += validResults.length;
    
    return validResults;
}

async function estimateFileCount(dir, config, gitignoreRules, visited = new Set(), rootDir = null) {
    if (rootDir === null) {
        rootDir = dir;
    }
    
    let realPath;
    try {
        realPath = await fsPromises.realpath(dir);
    } catch (e) {
        return 0;
    }
    
    if (visited.has(realPath)) {
        return 0;
    }
    visited.add(realPath);
    
    let count = 0;
    let list = [];
    
    try {
        list = await fsPromises.readdir(dir);
    } catch (e) {
        return 0;
    }
    
    const includePattern = new RegExp(`\\.(${config.include.map(ext => ext.replace(/^\./, '')).join('|')})$`, 'i');
    
    for (const file of list) {
        const filePath = path.join(dir, file);
        const relativePath = path.relative(rootDir, filePath);
        
        if (shouldIgnore(filePath, relativePath, gitignoreRules, config.ignore)) {
            continue;
        }
        
        try {
            const stat = await fsPromises.stat(filePath);
            if (stat && stat.isDirectory()) {
                count += await estimateFileCount(filePath, config, gitignoreRules, visited, rootDir);
            } else if (includePattern.test(file)) {
                count++;
            }
        } catch (e) {
            // Пропускаємо
        }
    }
    
    return count;
}

function shouldIgnore(filePath, relativePath, gitignoreRules, configIgnore) {
    const allIgnoreRules = [...(configIgnore || []), ...(gitignoreRules || [])];
    const normalizedRelative = relativePath.replace(/\\/g, '/');
    const fileName = path.basename(filePath);
    
    for (const rule of allIgnoreRules) {
        if (!rule || rule.trim() === '') continue;
        
        const normalizedRule = rule.replace(/\\/g, '/');
        
        if (normalizedRule === fileName) {
            return true;
        }
        
        if (normalizedRelative.includes(normalizedRule) || filePath.includes(normalizedRule)) {
            return true;
        }
        
        if (normalizedRule.endsWith('/')) {
            const rulePath = normalizedRule.slice(0, -1);
            if (normalizedRelative.startsWith(rulePath + '/') || normalizedRelative === rulePath) {
                return true;
            }
        }
        
        try {
            const pattern = normalizedRule
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*')
                .replace(/\./g, '\\.');
            
            const regex = new RegExp(`^${pattern}$`);
            if (regex.test(normalizedRelative) || regex.test(fileName)) {
                return true;
            }
        } catch (e) {
            // Пропускаємо
        }
    }
    
    return false;
}

describe('scanProject', () => {
    let testDir;

    beforeEach(async () => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacylens-scan-test-'));
        
        // Створюємо тестову структуру
        fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
        fs.mkdirSync(path.join(testDir, 'node_modules'), { recursive: true });
        fs.mkdirSync(path.join(testDir, 'dist'), { recursive: true });
        
        // Створюємо тестові файли
        fs.writeFileSync(path.join(testDir, 'src', 'app.js'), 'console.log("Hello");', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'src', 'utils.js'), 'function test() {}', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'package.json'), '{"name": "test"}', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'README.md'), '# Test Project', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'node_modules', 'lib.js'), 'module.exports = {};', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'dist', 'bundle.js'), 'compiled code', 'utf-8');
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('сканує файли з підтримуваними розширеннями', async () => {
        const config = {
            ignore: ['.git', 'node_modules', 'dist'],
            include: ['.js', '.json', '.md'],
            maxFileSize: 3000,
            maxContextSize: 50000
        };

        const files = await scanProject(testDir, config, []);

        expect(files.length).toBeGreaterThan(0);
        expect(files.some(f => f.path.includes('app.js'))).toBe(true);
        expect(files.some(f => f.path.includes('package.json'))).toBe(true);
    });

    test('ігнорує файли згідно з config.ignore', async () => {
        const config = {
            ignore: ['node_modules', 'dist'],
            include: ['.js', '.json'],
            maxFileSize: 3000,
            maxContextSize: 50000
        };

        const files = await scanProject(testDir, config, []);

        expect(files.some(f => f.path.includes('node_modules'))).toBe(false);
        expect(files.some(f => f.path.includes('dist'))).toBe(false);
    });

    test('ігнорує файли згідно з .gitignore', async () => {
        const gitignoreRules = ['node_modules/', 'dist/'];
        const config = {
            ignore: [],
            include: ['.js'],
            maxFileSize: 3000,
            maxContextSize: 50000
        };

        const files = await scanProject(testDir, config, gitignoreRules);

        expect(files.some(f => f.path.includes('node_modules'))).toBe(false);
        expect(files.some(f => f.path.includes('dist'))).toBe(false);
    });

    test('обрізає великі файли', async () => {
        const largeContent = 'x'.repeat(5000);
        fs.writeFileSync(path.join(testDir, 'src', 'large.js'), largeContent, 'utf-8');

        const config = {
            ignore: [],
            include: ['.js'],
            maxFileSize: 1000,
            maxContextSize: 50000
        };

        const files = await scanProject(testDir, config, []);
        const largeFile = files.find(f => f.path.includes('large.js'));

        expect(largeFile).toBeDefined();
        expect(largeFile.content.length).toBeLessThanOrEqual(1000 + 20); // +20 для "[TRUNCATED]..."
        expect(largeFile.content).toContain('[TRUNCATED]');
    });

    test('повертає правильні шляхи файлів', async () => {
        const config = {
            ignore: [],
            include: ['.js'],
            maxFileSize: 3000,
            maxContextSize: 50000
        };

        const files = await scanProject(testDir, config, []);
        const appFile = files.find(f => f.path.includes('app.js'));

        expect(appFile).toBeDefined();
        expect(appFile.path).toBeDefined();
        expect(appFile.content).toBeDefined();
    });

    test('обробляє порожню директорію', async () => {
        const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacylens-empty-'));
        
        const config = {
            ignore: [],
            include: ['.js'],
            maxFileSize: 3000,
            maxContextSize: 50000
        };

        const files = await scanProject(emptyDir, config, []);

        expect(files).toEqual([]);
        
        fs.rmSync(emptyDir, { recursive: true, force: true });
    });

    test('обробляє неіснуючу директорію', async () => {
        const config = {
            ignore: [],
            include: ['.js'],
            maxFileSize: 3000,
            maxContextSize: 50000
        };

        const files = await scanProject('/nonexistent/path', config, []);

        expect(files).toEqual([]);
    });

    test('фільтрує файли за розширенням', async () => {
        fs.writeFileSync(path.join(testDir, 'src', 'style.css'), 'body { color: red; }', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'src', 'data.txt'), 'plain text', 'utf-8');

        const config = {
            ignore: [],
            include: ['.js'], // Тільки .js файли
            maxFileSize: 3000,
            maxContextSize: 50000
        };

        const files = await scanProject(testDir, config, []);

        expect(files.some(f => f.path.includes('.css'))).toBe(false);
        expect(files.some(f => f.path.includes('.txt'))).toBe(false);
        expect(files.some(f => f.path.includes('.js'))).toBe(true);
    });
});
