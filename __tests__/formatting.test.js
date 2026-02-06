/**
 * Тести для функцій форматування виводу
 */

const { formatAsMarkdown, formatAsHTML, formatAsJSON } = require('../legacylens-cli.js');

describe('Функції форматування', () => {
    const sampleMarkdown = `# Заголовок

## Підзаголовок

Це **жирний** текст та *курсив*.

\`\`\`javascript
const code = "example";
\`\`\`

- Пункт 1
- Пункт 2`;

    describe('formatAsMarkdown', () => {
        test('повертає markdown без змін', () => {
            const result = formatAsMarkdown(sampleMarkdown);
            expect(result).toBe(sampleMarkdown);
        });

        test('обробляє порожній рядок', () => {
            const result = formatAsMarkdown('');
            expect(result).toBe('');
        });
    });

    describe('formatAsHTML', () => {
        test('конвертує markdown в HTML Dashboard', () => {
            const result = formatAsHTML(sampleMarkdown, {
                model: 'gemini-2.5-flash',
                filesCount: 10,
                date: '2025-02-04'
            });

            expect(result).toContain('<!DOCTYPE html>');
            expect(result).toContain('LegacyLens - Code Analysis Dashboard');
            expect(result).toContain('🔍 LegacyLens');
            expect(result).toContain('chart.js'); // CDN link
            expect(result).toContain('radarChart');
            expect(result).toContain('barChart');
            // Check that markdown content is converted
            expect(result).toContain('<strong>жирний</strong>');
        });

        test('включає метадані в HTML Dashboard', () => {
            const metadata = {
                model: 'test-model',
                filesCount: 5,
                date: '2025-02-04'
            };
            const result = formatAsHTML('Test content', metadata);

            expect(result).toContain('2025-02-04');
            expect(result).toContain('Project Health Score');
            expect(result).toContain('System Metrics');
        });

        test('обробляє порожній контент з fallback даними', () => {
            const result = formatAsHTML('', {});
            expect(result).toContain('<!DOCTYPE html>');
            expect(result).toContain('50%'); // Default risk_score
            expect(result).toContain('Chart data unavailable'); // Default summary
        });
    });

    describe('formatAsJSON', () => {
        test('створює валідний JSON', () => {
            const metadata = {
                model: 'gemini-2.5-flash',
                filesCount: 10,
                executionTime: '5.5с',
                contextSize: 5000,
                reportSize: 2000
            };
            const result = formatAsJSON(sampleMarkdown, metadata);

            expect(() => JSON.parse(result)).not.toThrow();
            const parsed = JSON.parse(result);

            expect(parsed.version).toBe('2.1.0');
            expect(parsed.metadata.model).toBe('gemini-2.5-flash');
            expect(parsed.metadata.filesCount).toBe(10);
            expect(parsed.report).toBe(sampleMarkdown);
            expect(parsed.timestamp).toBeDefined();
        });

        test('обробляє відсутні метадані', () => {
            const result = formatAsJSON(sampleMarkdown, {});
            const parsed = JSON.parse(result);

            expect(parsed.metadata.model).toBeNull();
            expect(parsed.report).toBe(sampleMarkdown);
        });
    });
});
