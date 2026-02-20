/**
 * Analyze Command: Runs full project analysis
 */

import * as vscode from 'vscode';
import { LegacyLensService } from '../services/legacyLensService';

export async function analyzeCommand(service: LegacyLensService, projectPath: string) {
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBar.text = '$(sync~spin) LegacyLens: Analyzing...';
    statusBar.show();

    try {
        const result = await service.analyzeProject(projectPath);
        
        // Show results in webview or output panel
        const panel = vscode.window.createWebviewPanel(
            'legacylensReport',
            'LegacyLens Analysis Report',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );
        
        // Format report as HTML
        panel.webview.html = formatReportAsHTML(result);
        
        statusBar.text = '$(check) LegacyLens: Analysis complete';
        setTimeout(() => statusBar.dispose(), 3000);
    } catch (error: any) {
        vscode.window.showErrorMessage(`LegacyLens: Analysis failed - ${error.message}`);
        statusBar.dispose();
    }
}

function formatReportAsHTML(result: any): string {
    // Simple HTML formatting - can be enhanced
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #333; }
                .dead-code { background: #fff3cd; padding: 10px; margin: 10px 0; }
                .critical { background: #f8d7da; padding: 10px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <h1>LegacyLens Analysis Report</h1>
            <h2>Complexity Score: ${result.complexityScore}/100</h2>
            <p>${result.executiveSummary}</p>
            ${result.deadCode && result.deadCode.length > 0 ? `
                <h3>Dead Code</h3>
                ${result.deadCode.map((item: any) => `
                    <div class="dead-code">
                        <strong>${item.file}</strong>: ${item.reason}
                    </div>
                `).join('')}
            ` : ''}
        </body>
        </html>
    `;
}
