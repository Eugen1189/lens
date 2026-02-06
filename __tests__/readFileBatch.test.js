/**
 * Тести для функції readFileBatch
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { readFileBatch } = require('../legacylens-cli.js');

describe('readFileBatch', () => {
    let testDir;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacylens-batch-test-'));
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('читає батч файлів паралельно', async () => {
        const file1 = path.join(testDir, 'file1.js');
        const file2 = path.join(testDir, 'file2.js');
        const file3 = path.join(testDir, 'file3.js');

        fs.writeFileSync(file1, 'const a = 1;', 'utf-8');
        fs.writeFileSync(file2, 'const b = 2;', 'utf-8');
        fs.writeFileSync(file3, 'const c = 3;', 'utf-8');

        const fileBatch = [
            { filePath: file1, relativePath: 'file1.js' },
            { filePath: file2, relativePath: 'file2.js' },
            { filePath: file3, relativePath: 'file3.js' }
        ];

        const config = {
            maxFileSize: 3000
        };

        const progress = { scanned: 0, total: 10 };

        const results = await readFileBatch(fileBatch, config, progress, testDir);

        expect(results).toHaveLength(3);
        expect(results[0].path).toBe('file1.js');
        expect(results[0].content).toBe('const a = 1;');
        expect(results[1].path).toBe('file2.js');
        expect(results[1].content).toBe('const b = 2;');
        expect(results[2].path).toBe('file3.js');
        expect(results[2].content).toBe('const c = 3;');
        expect(progress.scanned).toBe(3);
    });

    test('обрізає великі файли', async () => {
        const largeContent = 'x'.repeat(5000);
        const file = path.join(testDir, 'large.js');
        fs.writeFileSync(file, largeContent, 'utf-8');

        const fileBatch = [
            { filePath: file, relativePath: 'large.js' }
        ];

        const config = {
            maxFileSize: 1000
        };

        const progress = { scanned: 0, total: 1 };

        const results = await readFileBatch(fileBatch, config, progress, testDir);

        expect(results).toHaveLength(1);
        expect(results[0].content.length).toBeLessThanOrEqual(1000 + 20); // +20 для "[TRUNCATED]..."
        expect(results[0].content).toContain('[TRUNCATED]');
    });

    test('пропускає файли, які не вдалося прочитати', async () => {
        const validFile = path.join(testDir, 'valid.js');
        const invalidFile = path.join(testDir, 'nonexistent.js');

        fs.writeFileSync(validFile, 'const a = 1;', 'utf-8');

        const fileBatch = [
            { filePath: validFile, relativePath: 'valid.js' },
            { filePath: invalidFile, relativePath: 'nonexistent.js' }
        ];

        const config = {
            maxFileSize: 3000
        };

        const progress = { scanned: 0, total: 2 };

        const results = await readFileBatch(fileBatch, config, progress, testDir);

        expect(results).toHaveLength(1);
        expect(results[0].path).toBe('valid.js');
        expect(progress.scanned).toBe(1);
    });

    test('обробляє порожній батч', async () => {
        const config = {
            maxFileSize: 3000
        };

        const progress = { scanned: 0, total: 0 };

        const results = await readFileBatch([], config, progress, testDir);

        expect(results).toHaveLength(0);
        expect(progress.scanned).toBe(0);
    });

    test('використовує basename якщо relativePath відсутній', async () => {
        const file = path.join(testDir, 'test.js');
        fs.writeFileSync(file, 'const a = 1;', 'utf-8');

        const fileBatch = [
            { filePath: file, relativePath: '' }
        ];

        const config = {
            maxFileSize: 3000
        };

        const progress = { scanned: 0, total: 1 };

        const results = await readFileBatch(fileBatch, config, progress, testDir);

        expect(results).toHaveLength(1);
        expect(results[0].path).toBe('test.js');
    });

    test('оновлює прогрес правильно', async () => {
        const file1 = path.join(testDir, 'file1.js');
        const file2 = path.join(testDir, 'file2.js');

        fs.writeFileSync(file1, 'test1', 'utf-8');
        fs.writeFileSync(file2, 'test2', 'utf-8');

        const fileBatch = [
            { filePath: file1, relativePath: 'file1.js' },
            { filePath: file2, relativePath: 'file2.js' }
        ];

        const config = {
            maxFileSize: 3000
        };

        const progress = { scanned: 5, total: 10 };

        await readFileBatch(fileBatch, config, progress, testDir);

        expect(progress.scanned).toBe(7); // 5 + 2
    });
});
