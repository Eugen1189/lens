/**
 * Тести для функцій кешування та хешування
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { calculateProjectHash, loadCache, saveCache } = require('../legacylens-cli.js');

describe('Кешування та хешування', () => {
    let testDir;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacylens-cache-test-'));
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('calculateProjectHash', () => {
        test('створює хеш для файлів', async () => {
            const files = [
                { path: 'file1.js', content: 'const a = 1;' },
                { path: 'file2.js', content: 'const b = 2;' }
            ];

            const hash = await calculateProjectHash(files);
            
            expect(hash).toBeDefined();
            expect(hash.length).toBe(64); // SHA256 завжди 64 символи
            expect(typeof hash).toBe('string');
        });

        test('створює однаковий хеш для однакових файлів', async () => {
            const files1 = [
                { path: 'file1.js', content: 'const a = 1;' },
                { path: 'file2.js', content: 'const b = 2;' }
            ];
            const files2 = [
                { path: 'file1.js', content: 'const a = 1;' },
                { path: 'file2.js', content: 'const b = 2;' }
            ];

            const hash1 = await calculateProjectHash(files1);
            const hash2 = await calculateProjectHash(files2);

            expect(hash1).toBe(hash2);
        });

        test('створює різний хеш для різних файлів', async () => {
            const files1 = [
                { path: 'file1.js', content: 'const a = 1;' }
            ];
            const files2 = [
                { path: 'file1.js', content: 'const a = 123;' } // Різна довжина контенту
            ];

            const hash1 = await calculateProjectHash(files1);
            const hash2 = await calculateProjectHash(files2);

            expect(hash1).not.toBe(hash2);
        });

        test('обробляє порожній масив', async () => {
            const hash = await calculateProjectHash([]);
            
            expect(hash).toBeDefined();
            expect(hash.length).toBe(64);
        });
    });

    describe('saveCache', () => {
        test('зберігає кеш у файл', () => {
            const projectHash = 'test-hash-123';
            const report = 'Test report content';
            const model = 'gemini-2.5-flash';

            const result = saveCache(testDir, projectHash, report, model);

            expect(result).toBe(true);
            
            const cachePath = path.join(testDir, '.legacylens-cache.json');
            expect(fs.existsSync(cachePath)).toBe(true);
            
            const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
            expect(cache.hash).toBe(projectHash);
            expect(cache.report).toBe(report);
            expect(cache.model).toBe(model);
            expect(cache.version).toBe(VERSION);
            expect(cache.timestamp).toBeDefined();
        });

        test('перезаписує існуючий кеш', () => {
            const hash1 = 'hash1';
            const hash2 = 'hash2';

            saveCache(testDir, hash1, 'Report 1', 'model1');
            saveCache(testDir, hash2, 'Report 2', 'model2');

            const cache = loadCache(testDir);
            expect(cache.hash).toBe(hash2);
            expect(cache.report).toBe('Report 2');
        });
    });

    describe('loadCache', () => {
        test('завантажує кеш з файлу', () => {
            const cacheData = {
                hash: 'test-hash',
                timestamp: Date.now(),
                report: 'Test report',
                model: 'gemini-2.5-flash',
                version: VERSION
            };

            const cachePath = path.join(testDir, '.legacylens-cache.json');
            fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf-8');

            const cache = loadCache(testDir);

            expect(cache).not.toBeNull();
            expect(cache.hash).toBe('test-hash');
            expect(cache.report).toBe('Test report');
            expect(cache.model).toBe('gemini-2.5-flash');
        });

        test('повертає null якщо кеш не існує', () => {
            const cache = loadCache(testDir);
            expect(cache).toBeNull();
        });

        test('повертає null для невалідного JSON', () => {
            const cachePath = path.join(testDir, '.legacylens-cache.json');
            fs.writeFileSync(cachePath, 'invalid json', 'utf-8');

            const cache = loadCache(testDir);
            expect(cache).toBeNull();
        });
    });

    describe('Інтеграція кешування', () => {
        test('повний цикл: збереження та завантаження', async () => {
            const files = [
                { path: 'file1.js', content: 'const a = 1;' }
            ];
            const projectHash = await calculateProjectHash(files);
            const report = 'Test analysis report';
            const model = 'gemini-2.5-flash';

            // Зберігаємо
            saveCache(testDir, projectHash, report, model);

            // Завантажуємо
            const loadedCache = loadCache(testDir);
            expect(loadedCache).not.toBeNull();
            expect(loadedCache.hash).toBe(projectHash);
            expect(loadedCache.report).toBe(report);
            expect(loadedCache.model).toBe(model);
            expect(loadedCache.version).toBe(VERSION);
        });

        test('хеш змінюється при зміні файлів', async () => {
            const files1 = [{ path: 'file.js', content: 'content1' }];
            const files2 = [{ path: 'file.js', content: 'content12' }]; // Різна довжина

            const hash1 = await calculateProjectHash(files1);
            const hash2 = await calculateProjectHash(files2);

            expect(hash1).not.toBe(hash2);
        });
    });
});
