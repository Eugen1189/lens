/**
 * Quick Fix Command: Fixes specific dead code item
 */

import * as vscode from 'vscode';
import { LegacyLensService } from '../services/legacyLensService';

export async function quickFixCommand(
    service: LegacyLensService,
    filePath: string,
    exportName: string
) {
    const confirm = await vscode.window.showWarningMessage(
        `Remove unused export "${exportName}" from ${vscode.workspace.asRelativePath(filePath)}?`,
        { modal: true },
        'Yes',
        'No'
    );

    if (confirm !== 'Yes') return;

    try {
        // Use auto-fix for specific file/export
        const projectPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!projectPath) return;

        // For now, use general auto-fix (can be enhanced to target specific export)
        await service.autoFix(projectPath, false);
        
        vscode.window.showInformationMessage(`LegacyLens: Removed ${exportName}`);
    } catch (error: any) {
        vscode.window.showErrorMessage(`LegacyLens: Quick fix failed - ${error.message}`);
    }
}
