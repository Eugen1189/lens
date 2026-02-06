/**
 * Тести для функції estimateFileCount
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { estimateFileCount, shouldIgnore } = require('../legacylens-cli.js');

describe('estimateFileCount', () => {
    let testDir;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacylens-estimate-test-'));
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('підраховує файли з підтримуваними розширеннями', async () => {
        // Створюємо тестову структуру
        fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
        fs.writeFileSync(path.join(testDir, 'src', 'app.js'), 'console.log("test");', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'src', 'utils.js'), 'function test() {}', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'package.json'), '{"name": "test"}', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'README.md'), '# Test', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'style.css'), 'body { color: red; }', 'utf-8');

        const config = {
            ignore: [],
            include: ['.js', '.json', '.md']
        };

        const count = await estimateFileCount(testDir, config, []);

        expect(count).toBe(4); // app.js, utils.js, package.json, README.md
    });

    test('ігнорує файли згідно з config.ignore', async () => {
        fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
        fs.mkdirSync(path.join(testDir, 'node_modules'), { recursive: true });
        fs.writeFileSync(path.join(testDir, 'src', 'app.js'), 'test', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'node_modules', 'lib.js'), 'test', 'utf-8');

        const config = {
            ignore: ['node_modules/'], // Додаємо слеш для папки
            include: ['.js']
        };

        const count = await estimateFileCount(testDir, config, []);

        expect(count).toBe(1); // Тільки app.js, node_modules ігнорується
    });

    test('ігнорує файли згідно з .gitignore', async () => {
        fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
        fs.mkdirSync(path.join(testDir, 'dist'), { recursive: true });
        fs.writeFileSync(path.join(testDir, 'src', 'app.js'), 'test', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'dist', 'bundle.js'), 'test', 'utf-8');

        const gitignoreRules = ['dist/'];
        const config = {
            ignore: [],
            include: ['.js']
        };

        const count = await estimateFileCount(testDir, config, gitignoreRules);

        expect(count).toBe(1); // Тільки app.js
    });

    test('фільтрує файли за розширенням', async () => {
        fs.writeFileSync(path.join(testDir, 'app.js'), 'test', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'style.css'), 'body {}', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'data.txt'), 'text', 'utf-8');

        const config = {
            ignore: [],
            include: ['.js'] // Тільки .js файли
        };

        const count = await estimateFileCount(testDir, config, []);

        expect(count).toBe(1); // Тільки app.js
    });

    test('обробляє порожню директорію', async () => {
        const config = {
            ignore: [],
            include: ['.js']
        };

        const count = await estimateFileCount(testDir, config, []);

        expect(count).toBe(0);
    });

    test('обробляє неіснуючу директорію', async () => {
        const config = {
            ignore: [],
            include: ['.js']
        };

        const count = await estimateFileCount('/nonexistent/path', config, []);

        expect(count).toBe(0);
    });

    test('рекурсивно сканує підпапки', async () => {
        fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
        fs.mkdirSync(path.join(testDir, 'src', 'utils'), { recursive: true });
        fs.writeFileSync(path.join(testDir, 'app.js'), 'test', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'src', 'main.js'), 'test', 'utf-8');
        fs.writeFileSync(path.join(testDir, 'src', 'utils', 'helper.js'), 'test', 'utf-8');

        const config = {
            ignore: [],
            include: ['.js']
        };

        const count = await estimateFileCount(testDir, config, []);

        expect(count).toBe(3); // app.js, main.js, helper.js
    });

    test('уникає циклічних посилань (symlinks)', async () => {
        fs.mkdirSync(path.join(testDir, 'dir1'), { recursive: true });
        fs.writeFileSync(path.join(testDir, 'dir1', 'file.js'), 'test', 'utf-8');

        const config = {
            ignore: [],
            include: ['.js']
        };

        const count = await estimateFileCount(testDir, config, []);

        expect(count).toBe(1);
    });
});
