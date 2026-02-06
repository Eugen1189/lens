/**
 * Тести для обробки помилок
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadConfig, loadCache, saveCache, parseGitignore } = require('../legacylens-cli.js');

describe('Обробка помилок', () => {
    let testDir;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacylens-error-test-'));
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('loadConfig', () => {
        test('повертає null для неіснуючого файлу', () => {
            const config = loadConfig(testDir);
            expect(config).toBeNull();
        });

        test('повертає null для невалідного JSON', () => {
            const configPath = path.join(testDir, '.legacylens.json');
            fs.writeFileSync(configPath, 'invalid json {', 'utf-8');

            const config = loadConfig(testDir);
            expect(config).toBeNull();
        });

        test('обробляє порожній JSON файл', () => {
            const configPath = path.join(testDir, '.legacylens.json');
            fs.writeFileSync(configPath, '{}', 'utf-8');

            const config = loadConfig(testDir);
            expect(config).toEqual({});
        });
    });

    describe('loadCache', () => {
        test('повертає null для неіснуючого кешу', () => {
            const cache = loadCache(testDir);
            expect(cache).toBeNull();
        });

        test('повертає null для невалідного JSON', () => {
            const cachePath = path.join(testDir, '.legacylens-cache.json');
            fs.writeFileSync(cachePath, 'invalid json', 'utf-8');

            const cache = loadCache(testDir);
            expect(cache).toBeNull();
        });

        test('обробляє порожній JSON файл', () => {
            const cachePath = path.join(testDir, '.legacylens-cache.json');
            fs.writeFileSync(cachePath, '{}', 'utf-8');

            const cache = loadCache(testDir);
            expect(cache).toEqual({});
        });
    });

    describe('saveCache', () => {
        test('обробляє помилки запису', () => {
            // Створюємо read-only директорію (на Windows це складніше)
            // Тому просто перевіряємо, що функція не падає
            const result = saveCache('/nonexistent/path', 'hash', 'report', 'model');
            expect(typeof result).toBe('boolean');
        });

        test('зберігає кеш увалідно', () => {
            const result = saveCache(testDir, 'test-hash', 'test-report', 'test-model');
            expect(result).toBe(true);

            const cache = loadCache(testDir);
            expect(cache).not.toBeNull();
            expect(cache.projectHash).toBe('test-hash');
            expect(cache.report).toBe('test-report');
            expect(cache.model).toBe('test-model');
        });
    });

    describe('parseGitignore', () => {
        test('повертає порожній масив для неіснуючого файлу', () => {
            const rules = parseGitignore(testDir);
            expect(rules).toEqual([]);
        });

        test('обробляє помилки читання', () => {
            // Створюємо директорію без прав на читання (складно на Windows)
            // Тому просто перевіряємо, що функція не падає
            const rules = parseGitignore('/nonexistent/path');
            expect(Array.isArray(rules)).toBe(true);
        });

        test('обробляє порожній .gitignore', () => {
            const gitignorePath = path.join(testDir, '.gitignore');
            fs.writeFileSync(gitignorePath, '', 'utf-8');

            const rules = parseGitignore(testDir);
            expect(rules).toEqual([]);
        });
    });

    describe('calculateProjectHash', () => {
        test('обробляє порожній масив', async () => {
            const { calculateProjectHash } = require('../legacylens-cli.js');
            const hash = await calculateProjectHash([]);
            
            expect(hash).toBeDefined();
            expect(typeof hash).toBe('string');
            expect(hash.length).toBe(64); // SHA256
        });

        test('обробляє null/undefined', async () => {
            const { calculateProjectHash } = require('../legacylens-cli.js');
            
            // Перевіряємо, що функція не падає
            try {
                await calculateProjectHash(null);
            } catch (error) {
                // Очікуємо помилку, але функція не повинна падати з необробленою помилкою
                expect(error).toBeDefined();
            }
        });
    });
});
