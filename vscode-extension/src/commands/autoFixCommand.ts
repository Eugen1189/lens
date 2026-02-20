/**
 * Auto-Fix Command: Removes dead code with confirmation
 */

import * as vscode from 'vscode';
import { LegacyLensService } from '../services/legacyLensService';

export async function autoFixCommand(service: LegacyLensService, projectPath: string) {
    const dryRun = await vscode.window.showQuickPick(
        ['Yes, show what would be removed', 'No, remove dead code now'],
        { placeHolder: 'Do you want to preview changes first?' }
    );

    if (!dryRun) return;

    const isDryRun = dryRun.startsWith('Yes');
    
    if (!isDryRun) {
        const confirm = await vscode.window.showWarningMessage(
            'This will modify your files. Continue?',
            { modal: true },
            'Yes',
            'No'
        );
        
        if (confirm !== 'Yes') return;
    }

    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBar.text = '$(sync~spin) LegacyLens: Auto-fixing...';
    statusBar.show();

    try {
        const result = await service.autoFix(projectPath, isDryRun);
        
        if (isDryRun) {
            vscode.window.showInformationMessage(
                `LegacyLens: Would remove ${result.removed} exports, skip ${result.skipped}`
            );
        } else {
            vscode.window.showInformationMessage(
                `LegacyLens: Removed ${result.removed} dead exports, skipped ${result.skipped}`
            );
        }
        
        statusBar.text = '$(check) LegacyLens: Auto-fix complete';
        setTimeout(() => statusBar.dispose(), 3000);
    } catch (error: any) {
        vscode.window.showErrorMessage(`LegacyLens: Auto-fix failed - ${error.message}`);
        statusBar.dispose();
    }
}
