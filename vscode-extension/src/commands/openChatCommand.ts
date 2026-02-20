/**
 * Open Chat Command: Opens AI chat sidebar
 */

import * as vscode from 'vscode';
import { LegacyLensService } from '../services/legacyLensService';
import { ProjectMapService } from '../services/projectMapService';

export async function openChatCommand(
    service: LegacyLensService,
    projectMapService: ProjectMapService,
    projectPath: string
) {
    const panel = vscode.window.createWebviewPanel(
        'legacylensChat',
        'LegacyLens AI Chat',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    panel.webview.html = getChatWebviewHTML();

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async message => {
        if (message.command === 'sendMessage') {
            try {
                const response = await service.generateCode(projectPath, message.text);
                panel.webview.postMessage({
                    command: 'response',
                    text: response
                });
            } catch (error: any) {
                panel.webview.postMessage({
                    command: 'error',
                    text: error.message
                });
            }
        }
    });
}

function getChatWebviewHTML(): string {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                #chat { height: 400px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; }
                #input { width: 100%; padding: 10px; margin-top: 10px; }
            </style>
        </head>
        <body>
            <h2>LegacyLens AI Chat</h2>
            <div id="chat"></div>
            <input id="input" type="text" placeholder="Ask about your code...">
            <script>
                const vscode = acquireVsCodeApi();
                const chat = document.getElementById('chat');
                const input = document.getElementById('input');
                
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        const message = input.value;
                        chat.innerHTML += '<p><strong>You:</strong> ' + message + '</p>';
                        vscode.postMessage({ command: 'sendMessage', text: message });
                        input.value = '';
                    }
                });
                
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'response') {
                        chat.innerHTML += '<p><strong>AI:</strong> ' + message.text + '</p>';
                    }
                });
            </script>
        </body>
        </html>
    `;
}
