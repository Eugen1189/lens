/**
 * CodeLensProvider: Shows "Auto-Fix" buttons above dead code
 */

import * as vscode from 'vscode';
import { ProjectMapService } from '../services/projectMapService';

export class CodeLensProvider implements vscode.CodeLensProvider {
    private projectMapService: ProjectMapService;
    private _onDidChangeCodeLens = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLens = this._onDidChangeCodeLens.event;

    constructor(projectMapService: ProjectMapService) {
        this.projectMapService = projectMapService;
        
        // Refresh CodeLens when Project Map changes
        projectMapService.onDidChangeProjectMap(() => {
            this._onDidChangeCodeLens.fire();
        });
    }

    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];
        const deadExports = this.projectMapService.findDeadExports();
        
        // Find dead exports in this file
        const fileDeadExports = deadExports.filter(item => item.file === document.fileName);
        
        for (const item of fileDeadExports) {
            // Find line number of export
            const text = document.getText();
            const lines = text.split('\n');
            let lineNumber = 0;
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(`export`) && lines[i].includes(item.export)) {
                    lineNumber = i;
                    break;
                }
            }
            
            if (lineNumber > 0) {
                const range = new vscode.Range(lineNumber, 0, lineNumber, 0);
                const codeLens = new vscode.CodeLens(range, {
                    title: `🔧 LegacyLens: ${item.reason} [Auto-Fix]`,
                    command: 'legacylens.quickFix',
                    arguments: [document.uri, item.export]
                });
                codeLenses.push(codeLens);
            }
        }
        
        return codeLenses;
    }

    resolveCodeLens(codeLens: vscode.CodeLens): vscode.CodeLens | Thenable<vscode.CodeLens> {
        return codeLens;
    }
}
