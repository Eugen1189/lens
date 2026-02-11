/**
 * Тести для функцій форматування виводу
 */

const { formatAsMarkdown, formatAsJSON } = require('../src/reports/formatters');
const { formatAsHTML } = require('../src/reports/html-template');
const { VERSION } = require('../src/utils/constants');

describe('Функції форматування', () => {
    const sampleJsonData = {
        projectName: 'test-project',
        complexityScore: 75,
        executiveSummary: 'This is a **test** project with *some* issues.',
        deadCode: [
            {
                file: 'src/utils.js',
                lineOrFunction: 'function oldHelper()',
                confidence: 'High',
                reason: 'Never called'
            }
        ],
        criticalIssues: [
            {
                file: 'src/app.js',
                issue: 'Hardcoded API key',
                severity: 'Critical',
                recommendation: 'Move to environment variables'
            }
        ],
        refactoringPlan: [
            {
                step: 1,
                action: 'Extract function',
                codeSnippetBefore: 'const x = a + b;',
                codeSnippetAfter: 'const x = add(a, b);',
                benefit: 'Improves readability'
            }
        ]
    };

    describe('formatAsMarkdown', () => {
        test('форматує JSON дані в Markdown', () => {
            const result = formatAsMarkdown(sampleJsonData);
            expect(result).toContain('test-project');
            expect(result).toContain('75');
            expect(result).toContain('This is a');
            expect(result).toContain('Dead Code');
        });

        test('обробляє невалідні дані', () => {
            const result = formatAsMarkdown(null);
            expect(result).toContain('Invalid');
        });
    });

    describe('formatAsHTML', () => {
        test('конвертує JSON дані в HTML Dashboard', () => {
            const result = formatAsHTML(sampleJsonData, {
                model: 'gemini-2.5-flash',
                filesCount: 10,
                date: '2025-02-04'
            });

            expect(result).toContain('<!DOCTYPE html>');
            expect(result).toContain('LegacyLens Audit Report');
            expect(result).toContain('LegacyLens');
            expect(result).toContain('chart.js'); // CDN link
            expect(result).toContain('test-project');
        });

        test('включає метадані в HTML Dashboard', () => {
            const metadata = {
                model: 'test-model',
                filesCount: 5,
                date: '2025-02-04'
            };
            const result = formatAsHTML(sampleJsonData, metadata);

            expect(result).toContain('2025-02-04');
            expect(result).toContain('test-project');
            expect(result).toContain('75'); // complexityScore
            expect(result).toContain('LegacyLens');
        });

        test('обробляє невалідні дані', () => {
            const result = formatAsHTML(null, {});
            expect(result).toContain('Invalid data provided');
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
            const result = formatAsJSON(sampleJsonData, metadata);

            expect(() => JSON.parse(result)).not.toThrow();
            const parsed = JSON.parse(result);

            expect(parsed.version).toBe(VERSION);
            expect(parsed.metadata.model).toBe('gemini-2.5-flash');
            expect(parsed.metadata.filesCount).toBe(10);
            expect(parsed.report).toEqual(sampleJsonData);
            expect(parsed.timestamp).toBeDefined();
        });

        test('обробляє відсутні метадані', () => {
            const result = formatAsJSON(sampleJsonData, {});
            const parsed = JSON.parse(result);

            expect(parsed.metadata.model).toBeNull();
            expect(parsed.report).toEqual(sampleJsonData);
        });
    });
});
