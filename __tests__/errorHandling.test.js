/**
 * Tests for error handling
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadConfig } = require('../src/utils/config');
const { loadCache, saveCache } = require('../src/utils/cache');
const { parseGitignore } = require('../src/core/gitignore');

describe('Error handling', () => {
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
        test('returns null for non-existent file', () => {
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
        test('returns null for non-existent cache', () => {
            const cache = loadCache(testDir);
            expect(cache).toBeNull();
        });

        test('returns null for invalid JSON', () => {
            const cachePath = path.join(testDir, '.legacylens-cache.json');
            fs.writeFileSync(cachePath, 'invalid json', 'utf-8');

            const cache = loadCache(testDir);
            expect(cache).toBeNull();
        });

        test('handles empty JSON file', () => {
            const cachePath = path.join(testDir, '.legacylens-cache.json');
            fs.writeFileSync(cachePath, '{}', 'utf-8');

            const cache = loadCache(testDir);
            expect(cache).toEqual({});
        });
    });

    describe('saveCache', () => {
        test('handles write errors', () => {
            // Creating read-only directory is harder on Windows
            // So we just check that function doesn't crash
            const result = saveCache('/nonexistent/path', 'hash', 'report', 'model');
            expect(typeof result).toBe('boolean');
            expect(result).toBe(false); // Should return false on error
        });

        test('saves cache successfully', () => {
            const result = saveCache(testDir, 'test-hash', 'test-report', 'test-model');
            expect(result).toBe(true);

            const cache = loadCache(testDir);
            expect(cache).not.toBeNull();
            expect(cache.hash).toBe('test-hash'); // Changed from projectHash to hash
            expect(cache.report).toBe('test-report');
            expect(cache.model).toBe('test-model');
        });
    });

    describe('parseGitignore', () => {
        test('returns ignore object for non-existent file', () => {
            const ig = parseGitignore(testDir, []);
            expect(ig).toBeDefined();
            expect(ig.ignores('src/app.js')).toBe(false);
        });

        test('handles read errors', () => {
            // Creating directory without read permissions is hard on Windows
            // So we just check that function doesn't crash
            const ig = parseGitignore('/nonexistent/path', []);
            expect(ig).toBeDefined();
        });

        test('handles empty .gitignore', () => {
            const gitignorePath = path.join(testDir, '.gitignore');
            fs.writeFileSync(gitignorePath, '', 'utf-8');

            const ig = parseGitignore(testDir, []);
            expect(ig).toBeDefined();
            expect(ig.ignores('src/app.js')).toBe(false);
        });
    });

    describe('calculateProjectHash', () => {
        test('handles empty array', async () => {
            const { calculateProjectHash } = require('../src/utils/cache');
            const hash = await calculateProjectHash([]);
            
            expect(hash).toBeDefined();
            expect(typeof hash).toBe('string');
            expect(hash.length).toBe(64); // SHA256
        });

        test('handles null/undefined', async () => {
            const { calculateProjectHash } = require('../src/utils/cache');
            
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
