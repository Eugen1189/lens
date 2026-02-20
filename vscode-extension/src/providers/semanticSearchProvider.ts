/**
 * SemanticSearchProvider: Manages semantic search results
 */

import * as vscode from 'vscode';
import { LegacyLensService } from '../services/legacyLensService';

export class SemanticSearchProvider {
    private service: LegacyLensService;
    private results: any[] = [];

    constructor(service: LegacyLensService) {
        this.service = service;
    }

    async search(query: string) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        try {
            this.results = await this.service.semanticSearch(workspaceFolder.uri.fsPath, query);
            
            // Show results in panel or quick pick
            if (this.results.length === 0) {
                vscode.window.showInformationMessage('No results found');
                return;
            }

            const items = this.results.map((r, i) => ({
                label: `${i + 1}. ${r.path}`,
                description: r.text?.slice(0, 100) || '',
                detail: `Score: ${r.score?.toFixed(3)}`,
                uri: vscode.Uri.file(r.path)
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `Found ${this.results.length} results`
            });

            if (selected && selected.uri) {
                vscode.window.showTextDocument(selected.uri);
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Semantic search failed: ${error.message}`);
        }
    }
}
