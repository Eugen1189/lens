/**
 * Tests for .gitignore functions
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseGitignore, shouldIgnore } = require('../src/core/gitignore');

describe('Gitignore handling', () => {
    let testDir;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacylens-test-'));
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('parseGitignore', () => {
        test('reads .gitignore file', () => {
            const gitignoreContent = 'node_modules\n*.log\n.env';
            fs.writeFileSync(path.join(testDir, '.gitignore'), gitignoreContent);

            const ig = parseGitignore(testDir, []);

            // parseGitignore returns an ignore object, not an array
            expect(ig).toBeDefined();
            expect(ig.ignores('node_modules/file.js')).toBe(true);
            expect(ig.ignores('app.log')).toBe(true);
            expect(ig.ignores('.env')).toBe(true);
            expect(ig.ignores('src/app.js')).toBe(false);
        });

        test('ignores comments and empty lines', () => {
            const gitignoreContent = '# Comment\nnode_modules\n\n# Another comment\n*.log';
            fs.writeFileSync(path.join(testDir, '.gitignore'), gitignoreContent);

            const ig = parseGitignore(testDir, []);

            // Comments and empty lines are filtered by ignore library
            expect(ig).toBeDefined();
            expect(ig.ignores('node_modules/file.js')).toBe(true);
            expect(ig.ignores('app.log')).toBe(true);
            expect(ig.ignores('src/app.js')).toBe(false);
        });

        test('returns ignore object even if .gitignore does not exist', () => {
            const ig = parseGitignore(testDir, []);
            expect(ig).toBeDefined();
            // Should not ignore anything if no .gitignore
            expect(ig.ignores('src/app.js')).toBe(false);
        });
    });

    describe('shouldIgnore', () => {
        test('ignores files from config ignore', () => {
            const configIgnore = ['node_modules', '.env'];
            const filePath = path.join(testDir, 'node_modules', 'file.js');
            const relativePath = 'node_modules/file.js';
            const ig = parseGitignore(testDir, configIgnore);

            expect(shouldIgnore(filePath, relativePath, ig)).toBe(true);
        });

        test('ignores files from .gitignore', () => {
            fs.writeFileSync(path.join(testDir, '.gitignore'), '*.log\ndist/\n', 'utf-8');
            const ig = parseGitignore(testDir, []);
            const filePath = path.join(testDir, 'app.log');
            const relativePath = 'app.log';

            expect(shouldIgnore(filePath, relativePath, ig)).toBe(true);
        });

        test('does not ignore files not in the list', () => {
            const configIgnore = ['node_modules', 'dist'];
            const ig = parseGitignore(testDir, configIgnore);
            const filePath = path.join(testDir, 'src', 'app.js');
            const relativePath = 'src/app.js';

            expect(shouldIgnore(filePath, relativePath, ig)).toBe(false);
        });

        test('handles glob patterns', () => {
            fs.writeFileSync(path.join(testDir, '.gitignore'), '*.log\n', 'utf-8');
            const ig = parseGitignore(testDir, []);
            const file1 = path.join(testDir, 'app.log');
            const relativePath1 = path.relative(testDir, file1).replace(/\\/g, '/');

            expect(shouldIgnore(file1, relativePath1, ig)).toBe(true);
            
            // Test for directory
            fs.writeFileSync(path.join(testDir, '.gitignore'), 'temp/\n', 'utf-8');
            const ig2 = parseGitignore(testDir, []);
            const file2 = path.join(testDir, 'temp', 'file.js');
            const relativePath2 = path.relative(testDir, file2).replace(/\\/g, '/');
            
            expect(shouldIgnore(file2, relativePath2, ig2)).toBe(true);
        });

        test('combines rules from .gitignore and config', () => {
            fs.writeFileSync(path.join(testDir, '.gitignore'), '*.log\n', 'utf-8');
            const configIgnore = ['node_modules'];
            const ig = parseGitignore(testDir, configIgnore);
            const file1 = path.join(testDir, 'app.log');
            const file2 = path.join(testDir, 'node_modules', 'file.js');

            expect(shouldIgnore(file1, 'app.log', ig)).toBe(true);
            expect(shouldIgnore(file2, 'node_modules/file.js', ig)).toBe(true);
        });
    });
});
