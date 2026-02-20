/**
 * LegacyExplorerProvider: Tree view showing project files with complexity colors
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectMapService } from '../services/projectMapService';

export class LegacyExplorerProvider implements vscode.TreeDataProvider<FileItem> {
    private projectMapService: ProjectMapService;
    private _onDidChangeTreeData = new vscode.EventEmitter<FileItem | undefined | null | void>();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(projectMapService: ProjectMapService) {
        this.projectMapService = projectMapService;
        
        // Refresh tree when Project Map changes
        projectMapService.onDidChangeProjectMap(() => {
            this._onDidChangeTreeData.fire();
        });
    }

    getTreeItem(element: FileItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FileItem): Thenable<FileItem[]> {
        const projectMap = this.projectMapService.getProjectMap();
        if (!projectMap || !projectMap.files) {
            return Promise.resolve([]);
        }

        if (!element) {
            // Root level: show files
            return Promise.resolve(
                projectMap.files.map((file: any) => {
                    const complexity = this.projectMapService.getFileComplexity(file.path);
                    return new FileItem(
                        path.basename(file.path),
                        file.path,
                        complexity,
                        vscode.TreeItemCollapsibleState.None
                    );
                })
            );
        }

        return Promise.resolve([]);
    }
}

class FileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly filePath: string,
        public readonly complexity: number,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        
        // Color code based on complexity
        if (complexity > 70) {
            this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('errorForeground')); // Red
        } else if (complexity > 40) {
            this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('warningForeground')); // Yellow
        } else {
            this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed')); // Green
        }
        
        this.tooltip = `Complexity: ${complexity}/100`;
        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [vscode.Uri.file(filePath)]
        };
    }
}
