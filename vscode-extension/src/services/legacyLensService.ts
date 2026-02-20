/**
 * LegacyLensService: Wrapper for LegacyLens Core modules
 * Provides access to analysis, auto-fix, semantic search, and code generation
 */

import * as vscode from 'vscode';
import * as path from 'path';

// Import LegacyLens Core modules
// Note: In production, these will be bundled or accessed via npm package
// For development, adjust path to point to LegacyLens source
const LEGACYLENS_CORE_PATH = path.resolve(__dirname, '../../../src/core');

export class LegacyLensService {
    private context: vscode.ExtensionContext;
    private apiKey: string | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadApiKey();
    }

    private loadApiKey() {
        const config = vscode.workspace.getConfiguration('legacylens');
        this.apiKey = config.get<string>('apiKey') || process.env.GEMINI_API_KEY || null;
    }

    /**
     * Gets API key, prompts user if not set
     */
    async getApiKey(): Promise<string> {
        if (!this.apiKey) {
            const input = await vscode.window.showInputBox({
                prompt: 'Enter your Google Gemini API key',
                placeHolder: 'Get one at https://aistudio.google.com/app/apikey',
                password: true
            });
            if (input) {
                this.apiKey = input;
                await vscode.workspace.getConfiguration('legacylens').update('apiKey', input, true);
            } else {
                throw new Error('API key required');
            }
        }
        return this.apiKey;
    }

    /**
     * Analyzes project using LegacyLens Core
     */
    async analyzeProject(projectPath: string): Promise<any> {
        // Dynamic import of LegacyLens Core
        const { analyzeProject } = require(LEGACYLENS_CORE_PATH + '/../cli');
        const apiKey = await this.getApiKey();
        
        return analyzeProject({
            project: projectPath,
            apiKey,
            format: 'json',
            quiet: true
        });
    }

    /**
     * Auto-fixes dead code
     */
    async autoFix(projectPath: string, dryRun: boolean = false): Promise<{ removed: number; skipped: number; errors: number }> {
        const { autoFix } = require(LEGACYLENS_CORE_PATH + '/auto-fix');
        const apiKey = await this.getApiKey();
        
        return autoFix(projectPath, {
            apiKey,
            dryRun,
            confirm: false // VS Code handles confirmation via UI
        });
    }

    /**
     * Semantic search
     */
    async semanticSearch(projectPath: string, query: string, topK: number = 10): Promise<any[]> {
        const { loadIndex, search } = require(LEGACYLENS_CORE_PATH + '/semantic-indexer');
        const apiKey = await this.getApiKey();
        
        const indexData = loadIndex(projectPath);
        if (!indexData) {
            throw new Error('Semantic index not found. Run: legacylens index');
        }
        
        const { getEmbeddingModel } = require(LEGACYLENS_CORE_PATH + '/engines');
        const embeddingModel = getEmbeddingModel();
        
        return search(query, indexData, apiKey, embeddingModel, topK);
    }

    /**
     * Generates code using LegacyLens Core
     */
    async generateCode(projectPath: string, prompt: string): Promise<string> {
        const { generateCode } = require(LEGACYLENS_CORE_PATH + '/code-generator');
        const apiKey = await this.getApiKey();
        
        const result = await generateCode(projectPath, prompt, {
            apiKey,
            ignore: null // Use default ignore
        });
        
        return result.code;
    }
}
