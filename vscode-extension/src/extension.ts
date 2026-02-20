/**
 * LegacyLens VS Code Extension
 * Main entry point - activates extension and registers providers
 */

import * as vscode from 'vscode';
import { LegacyLensService } from './services/legacyLensService';
import { ProjectMapService } from './services/projectMapService';
import { CodeLensProvider } from './providers/codeLensProvider';
import { DiagnosticProvider } from './providers/diagnosticProvider';
import { LegacyExplorerProvider } from './providers/treeDataProvider';
import { SemanticSearchProvider } from './providers/semanticSearchProvider';
import { analyzeCommand } from './commands/analyzeCommand';
import { autoFixCommand } from './commands/autoFixCommand';
import { semanticSearchCommand } from './commands/semanticSearchCommand';
import { openChatCommand } from './commands/openChatCommand';
import { quickFixCommand } from './commands/quickFixCommand';

let legacyLensService: LegacyLensService;
let projectMapService: ProjectMapService;

export function activate(context: vscode.ExtensionContext) {
    console.log('LegacyLens Copilot extension is now active!');

    // Initialize services
    legacyLensService = new LegacyLensService(context);
    projectMapService = new ProjectMapService(context);

    // Get workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('LegacyLens: No workspace folder found');
        return;
    }

    // Initialize Project Map on workspace open
    projectMapService.initialize(workspaceFolder.uri.fsPath).then(() => {
        vscode.window.showInformationMessage('LegacyLens: Project Map loaded');
    }).catch(err => {
        vscode.window.showErrorMessage(`LegacyLens: Failed to load Project Map - ${err.message}`);
    });

    // Register providers
    const codeLensProvider = new CodeLensProvider(projectMapService);
    const diagnosticProvider = new DiagnosticProvider(projectMapService);
    const legacyExplorerProvider = new LegacyExplorerProvider(projectMapService);
    const semanticSearchProvider = new SemanticSearchProvider(legacyLensService);

    // Register CodeLens for multiple languages
    const languages = ['javascript', 'typescript', 'python', 'java'];
    languages.forEach(lang => {
        context.subscriptions.push(
            vscode.languages.registerCodeLensProvider(
                { language: lang, scheme: 'file' },
                codeLensProvider
            )
        );
    });

    // Register Diagnostics
    context.subscriptions.push(
        vscode.languages.registerDiagnosticsProvider(
            { scheme: 'file' },
            diagnosticProvider
        )
    );

    // Register Tree View (Legacy Explorer)
    context.subscriptions.push(
        vscode.window.createTreeView('legacylensExplorer', {
            treeDataProvider: legacyExplorerProvider,
            showCollapseAll: true
        })
    );

    // Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('legacylens.analyze', () => 
            analyzeCommand(legacyLensService, workspaceFolder.uri.fsPath)
        ),
        vscode.commands.registerCommand('legacylens.autoFix', () => 
            autoFixCommand(legacyLensService, workspaceFolder.uri.fsPath)
        ),
        vscode.commands.registerCommand('legacylens.semanticSearch', () => 
            semanticSearchCommand(semanticSearchProvider)
        ),
        vscode.commands.registerCommand('legacylens.openChat', () => 
            openChatCommand(legacyLensService, projectMapService, workspaceFolder.uri.fsPath)
        ),
        vscode.commands.registerCommand('legacylens.quickFix', (uri: vscode.Uri, exportName: string) => 
            quickFixCommand(legacyLensService, uri.fsPath, exportName)
        )
    );

    // Watch for file changes to update Project Map
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{js,ts,py,java}');
    watcher.onDidChange(() => {
        projectMapService.refresh(workspaceFolder.uri.fsPath);
    });
    watcher.onDidCreate(() => {
        projectMapService.refresh(workspaceFolder.uri.fsPath);
    });
    watcher.onDidDelete(() => {
        projectMapService.refresh(workspaceFolder.uri.fsPath);
    });
    context.subscriptions.push(watcher);
}

export function deactivate() {
    // Cleanup
}
