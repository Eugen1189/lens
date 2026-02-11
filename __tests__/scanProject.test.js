/**
 * Tests for scanProject function
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const fsPromises = require('fs').promises;

// Import real functions from src
const { scanProject } = require('../src/core/scanner');
const { parseGitignore } = require('../src/core/gitignore');
const { DEFAULT_CONFIG } = require('../src/utils/config');

describe('scanProject', () => {
    let testDir;

    beforeEach(async () => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacylens-scan-test-'));
        
        // Create test structure
        fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
        fs.mkdirSync(path.join(testDir, 'node_modules'), { recursive: true });
        fs.mkdirSync(path.join(testDir, 'dist'), { recursive: true });
        
        // Create test files
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

    test('scans files with supported extensions', async () => {
        const config = { ...DEFAULT_CONFIG, ignore: ['.git', 'node_modules', 'dist'], include: ['.js', '.json', '.md'] };
        const gitignoreInstance = parseGitignore(testDir, config.ignore);

        const files = await scanProject(testDir, config, gitignoreInstance);

        expect(files.length).toBeGreaterThan(0);
        expect(files.some(f => f.path.includes('app.js'))).toBe(true);
        expect(files.some(f => f.path.includes('package.json'))).toBe(true);
    });

    test('ignores files according to config.ignore', async () => {
        const config = { ...DEFAULT_CONFIG, ignore: ['node_modules', 'dist'], include: ['.js', '.json'] };
        const gitignoreInstance = parseGitignore(testDir, config.ignore);

        const files = await scanProject(testDir, config, gitignoreInstance);

        expect(files.some(f => f.path.includes('node_modules'))).toBe(false);
        expect(files.some(f => f.path.includes('dist'))).toBe(false);
    });

    test('ignores files according to .gitignore', async () => {
        fs.writeFileSync(path.join(testDir, '.gitignore'), 'node_modules/\ndist/\n', 'utf-8');
        const config = { ...DEFAULT_CONFIG, include: ['.js'] };
        const gitignoreInstance = parseGitignore(testDir, config.ignore);

        const files = await scanProject(testDir, config, gitignoreInstance);

        expect(files.some(f => f.path.includes('node_modules'))).toBe(false);
        expect(files.some(f => f.path.includes('dist'))).toBe(false);
    });

    test('truncates large files', async () => {
        const largeContent = 'x'.repeat(5000);
        fs.writeFileSync(path.join(testDir, 'src', 'large.js'), largeContent, 'utf-8');

        const config = { ...DEFAULT_CONFIG, include: ['.js'], maxFileSize: 1000 };
        const gitignoreInstance = parseGitignore(testDir, config.ignore);

        const files = await scanProject(testDir, config, gitignoreInstance);
        const largeFile = files.find(f => f.path.includes('large.js'));

        expect(largeFile).toBeDefined();
        expect(largeFile.content.length).toBeLessThanOrEqual(1000 + 20); // +20 for "[TRUNCATED]..."
        expect(largeFile.content).toContain('[TRUNCATED]');
    });

    test('returns correct file paths', async () => {
        const config = { ...DEFAULT_CONFIG, include: ['.js'] };
        const gitignoreInstance = parseGitignore(testDir, config.ignore);

        const files = await scanProject(testDir, config, gitignoreInstance);
        const appFile = files.find(f => f.path.includes('app.js'));

        expect(appFile).toBeDefined();
        expect(appFile.path).toBeDefined();
        expect(appFile.content).toBeDefined();
    });

    test('handles empty directory', async () => {
        const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacylens-empty-'));
        
        const config = { ...DEFAULT_CONFIG, include: ['.js'] };
        const gitignoreInstance = parseGitignore(emptyDir, config.ignore);

        const files = await scanProject(emptyDir, config, gitignoreInstance);

        expect(files).toEqual([]);
        
        fs.rmSync(emptyDir, { recursive: true, force: true });
    });

    test('handles non-existent directory', async () => {
        const config = { ...DEFAULT_CONFIG, include: ['.js'] };
        const gitignoreInstance = parseGitignore('/nonexistent/path', config.ignore);

        const files = await scanProject('/nonexistent/path', config, gitignoreInstance);

        expect(files).toEqual([]);
    });

    test('filters files by extension', async () => {
        fs.writeFileSync(path.join(testDir, 'src', 'style.css'), 'body { color: red; }', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'src', 'data.txt'), 'plain text', 'utf-8');

        const config = { ...DEFAULT_CONFIG, include: ['.js'] }; // Only .js files
        const gitignoreInstance = parseGitignore(testDir, config.ignore);

        const files = await scanProject(testDir, config, gitignoreInstance);

        expect(files.some(f => f.path.includes('.css'))).toBe(false);
        expect(files.some(f => f.path.includes('.txt'))).toBe(false);
        expect(files.some(f => f.path.includes('.js'))).toBe(true);
    });
});
