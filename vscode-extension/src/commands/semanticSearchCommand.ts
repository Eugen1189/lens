/**
 * Semantic Search Command: Opens search panel
 */

import * as vscode from 'vscode';
import { SemanticSearchProvider } from '../providers/semanticSearchProvider';

export async function semanticSearchCommand(provider: SemanticSearchProvider) {
    const query = await vscode.window.showInputBox({
        prompt: 'Search code by meaning',
        placeHolder: 'e.g., authentication logic, error handling'
    });

    if (!query) return;

    // Show results in panel
    provider.search(query);
}
