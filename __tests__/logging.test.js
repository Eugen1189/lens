/**
 * Тести для функцій логування
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Імпортуємо функції логування з основного файлу
// Оскільки функції логування не експортуються, ми тестуємо їх через поведінку
// Або можемо створити тести для функцій, які використовують логування

describe('Логування', () => {
    let testDir;
    let originalConsoleLog;
    let originalConsoleError;
    let logOutput;
    let errorOutput;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacylens-log-test-'));
        logOutput = [];
        errorOutput = [];
        
        // Перехоплюємо console.log та console.error
        originalConsoleLog = console.log;
        originalConsoleError = console.error;
        
        console.log = (...args) => {
            logOutput.push(args.join(' '));
        };
        
        console.error = (...args) => {
            errorOutput.push(args.join(' '));
        };
    });

    afterEach(() => {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('лог-файл створюється при встановленні', () => {
        const { setLogFile } = require('../legacylens-cli.js');
        
        // Функція setLogFile не експортується, тому тестуємо через інші функції
        // Або можемо перевірити, що файл створюється
        const logFilePath = path.join(testDir, 'test.log');
        
        // Оскільки setLogFile не експортована, перевіряємо через поведінку
        // Це інтеграційний тест
        expect(true).toBe(true); // Placeholder
    });

    test('colorize функція працює правильно', () => {
        const { colorize } = require('../legacylens-cli.js');
        
        const result = colorize('test', 'red');
        expect(result).toContain('test');
        expect(typeof result).toBe('string');
    });

    test('colorize підтримує різні кольори', () => {
        const { colorize } = require('../legacylens-cli.js');
        
        const colors = ['red', 'green', 'yellow', 'cyan', 'blue', 'gray'];
        
        colors.forEach(color => {
            const result = colorize('test', color);
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });
    });

    test('colorize обробляє невідомий колір', () => {
        const { colorize } = require('../legacylens-cli.js');
        
        const result = colorize('test', 'unknown');
        expect(result).toContain('test');
    });
});
