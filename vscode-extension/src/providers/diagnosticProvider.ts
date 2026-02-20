/**
 * DiagnosticProvider: Highlights dead code with wavy underlines
 */

import * as vscode from 'vscode';
import { ProjectMapService } from '../services/projectMapService';

export class DiagnosticProvider {
    private projectMapService: ProjectMapService;
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor(projectMapService: ProjectMapService) {
        this.projectMapService = projectMapService;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('legacylens');
        
        // Update diagnostics when Project Map changes
        projectMapService.onDidChangeProjectMap(() => {
            this.updateDiagnostics();
        });
    }

    provideDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const deadExports = this.projectMapService.findDeadExports();
        
        // Find dead exports in this file
        const fileDeadExports = deadExports.filter(item => item.file === document.fileName);
        
        for (const item of fileDeadExports) {
            const text = document.getText();
            const lines = text.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(`export`) && lines[i].includes(item.export)) {
                    const range = new vscode.Range(i, 0, i, lines[i].length);
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `Dead code: ${item.reason}`,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = 'LegacyLens';
                    diagnostic.code = 'dead-code';
                    diagnostics.push(diagnostic);
                }
            }
        }
        
        return diagnostics;
    }

    private updateDiagnostics() {
        // Update diagnostics for all open documents
        vscode.workspace.textDocuments.forEach(doc => {
            if (doc.uri.scheme === 'file') {
                const diagnostics = this.provideDiagnostics(doc);
                this.diagnosticCollection.set(doc.uri, diagnostics);
            }
        });
    }
}
