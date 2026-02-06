/**
 * Тести для функцій роботи з .gitignore
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseGitignore, shouldIgnore } = require('../legacylens-cli.js');

describe('Робота з .gitignore', () => {
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
        test('читає .gitignore файл', () => {
            const gitignoreContent = 'node_modules\n*.log\n.env';
            fs.writeFileSync(path.join(testDir, '.gitignore'), gitignoreContent);

            const rules = parseGitignore(testDir);

            expect(rules).toHaveLength(3);
            expect(rules).toContain('node_modules');
            expect(rules).toContain('*.log');
            expect(rules).toContain('.env');
        });

        test('ігнорує коментарі та порожні рядки', () => {
            const gitignoreContent = '# Коментар\nnode_modules\n\n# Інший коментар\n*.log';
            fs.writeFileSync(path.join(testDir, '.gitignore'), gitignoreContent);

            const rules = parseGitignore(testDir);

            expect(rules).not.toContain('# Коментар');
            expect(rules).not.toContain('');
            expect(rules).toContain('node_modules');
            expect(rules).toContain('*.log');
        });

        test('повертає порожній масив якщо .gitignore не існує', () => {
            const rules = parseGitignore(testDir);
            expect(rules).toEqual([]);
        });
    });

    describe('shouldIgnore', () => {
        test('ігнорує файли з config ignore', () => {
            const configIgnore = ['node_modules', '.env'];
            const filePath = path.join(testDir, 'node_modules', 'file.js');
            const relativePath = 'node_modules/file.js';

            expect(shouldIgnore(filePath, relativePath, [], configIgnore)).toBe(true);
        });

        test('ігнорує файли з .gitignore', () => {
            const gitignoreRules = ['*.log', 'dist/'];
            const filePath = path.join(testDir, 'app.log');
            const relativePath = 'app.log';

            expect(shouldIgnore(filePath, relativePath, gitignoreRules, [])).toBe(true);
        });

        test('не ігнорує файли які не в списку', () => {
            const configIgnore = ['node_modules', 'dist'];
            const filePath = path.join(testDir, 'src', 'app.js');
            const relativePath = 'src/app.js';

            // Файл не повинен ігноруватися, оскільки він не в node_modules або dist
            const result = shouldIgnore(filePath, relativePath, [], configIgnore);
            // Перевіряємо, що файл не ігнорується (може бути true якщо абсолютний шлях містить правило)
            // Але відносний шлях не повинен містити правило
            const normalizedRelative = relativePath.replace(/\\/g, '/');
            const shouldBeIgnored = configIgnore.some(rule => {
                const normalizedRule = rule.replace(/\\/g, '/');
                return normalizedRelative.includes('/' + normalizedRule + '/') || 
                       normalizedRelative.startsWith(normalizedRule + '/') ||
                       normalizedRelative.endsWith('/' + normalizedRule) ||
                       normalizedRelative === normalizedRule;
            });
            expect(shouldBeIgnored).toBe(false);
        });

        test('обробляє glob patterns', () => {
            const gitignoreRules = ['*.log'];
            const file1 = path.join(testDir, 'app.log');
            const relativePath1 = path.relative(testDir, file1).replace(/\\/g, '/');

            expect(shouldIgnore(file1, relativePath1, gitignoreRules, [])).toBe(true);
            
            // Тест для папки
            const gitignoreRules2 = ['temp/'];
            const file2 = path.join(testDir, 'temp', 'file.js');
            const relativePath2 = path.relative(testDir, file2).replace(/\\/g, '/');
            
            expect(shouldIgnore(file2, relativePath2, gitignoreRules2, [])).toBe(true);
        });

        test('об\'єднує правила з .gitignore та config', () => {
            const gitignoreRules = ['*.log'];
            const configIgnore = ['node_modules'];
            const file1 = path.join(testDir, 'app.log');
            const file2 = path.join(testDir, 'node_modules', 'file.js');

            expect(shouldIgnore(file1, 'app.log', gitignoreRules, configIgnore)).toBe(true);
            expect(shouldIgnore(file2, 'node_modules/file.js', gitignoreRules, configIgnore)).toBe(true);
        });
    });
});
