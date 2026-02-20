/**
 * ProjectMapService: Manages Project Map state and provides access to it
 */

import * as vscode from 'vscode';
import * as path from 'path';

// Import LegacyLens Core
const LEGACYLENS_CORE_PATH = path.resolve(__dirname, '../../../src/core');

export class ProjectMapService {
    private context: vscode.ExtensionContext;
    private projectMap: any = null;
    private projectPath: string | null = null;
    private _onDidChangeProjectMap = new vscode.EventEmitter<void>();
    public readonly onDidChangeProjectMap = this._onDidChangeProjectMap.event;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Initializes Project Map for a workspace
     */
    async initialize(projectPath: string): Promise<void> {
        this.projectPath = projectPath;
        await this.refresh(projectPath);
    }

    /**
     * Refreshes Project Map (rebuilds if needed)
     */
    async refresh(projectPath: string): Promise<void> {
        try {
            const { buildProjectMap } = require(LEGACYLENS_CORE_PATH + '/context-builder');
            
            this.projectMap = await buildProjectMap(projectPath, {
                forceRebuild: false // Use cache if available
            });
            
            this._onDidChangeProjectMap.fire();
        } catch (error: any) {
            console.error('Failed to refresh Project Map:', error);
            throw error;
        }
    }

    /**
     * Gets current Project Map
     */
    getProjectMap(): any {
        return this.projectMap;
    }

    /**
     * Finds dead exports using Project Map
     */
    findDeadExports(): Array<{ file: string; export: string; reason: string }> {
        if (!this.projectMap || !this.projectMap.files) return [];
        
        const { findDeadExports } = require(LEGACYLENS_CORE_PATH + '/auto-fix');
        return findDeadExports(this.projectMap);
    }

    /**
     * Gets file complexity score (for color coding)
     */
    getFileComplexity(filePath: string): number {
        if (!this.projectMap || !this.projectMap.files) return 0;
        
        const file = this.projectMap.files.find((f: any) => f.path === filePath);
        if (!file) return 0;
        
        const exportCount = file.exports 
            ? (file.exports.named?.length || 0) + (file.exports.default ? 1 : 0)
            : 0;
        const importCount = file.imports?.length || 0;
        const signatureCount = file.signatures?.length || 0;
        
        // Simple complexity score: 0-100
        return Math.min(100, (exportCount * 5) + (importCount * 3) + (signatureCount * 2));
    }
}
