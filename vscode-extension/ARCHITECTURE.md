# LegacyLens VS Code Extension Architecture

## Overview

LegacyLens Copilot is a VS Code extension that integrates LegacyLens CLI into the editor, providing real-time code analysis, semantic search, and AI-powered code cleanup.

---

## 1. Key Features (UI/UX)

### Lens Overlays (CodeLens)
- **Location:** Above unused/dead methods
- **Display:** "LegacyLens: This export is unused. [Auto-Fix]"
- **Action:** Click to auto-fix dead code
- **Implementation:** VS Code CodeLens API

### Semantic Search Panel
- **Location:** Sidebar panel (new tab)
- **Functionality:** Search code by meaning using SemanticIndexer
- **Features:** 
  - Real-time search as you type
  - Results with file path, line number, and code snippet
  - Click to navigate to file

### Legacy Explorer
- **Location:** Explorer sidebar (custom tree view)
- **Display:** Project tree with color-coded files
- **Colors:**
  - 🔴 Red: High complexity, needs refactoring
  - 🟡 Yellow: Medium complexity
  - 🟢 Green: Clean code
- **Data Source:** Project Map complexity scores

### AI Chat Sidebar
- **Location:** Sidebar panel (chat interface)
- **Functionality:** 
  - Chat with AI that has access to Project Map
  - Can write code directly to open files
  - Context-aware suggestions based on project structure
- **Implementation:** Webview with LegacyLens Core API

---

## 2. Architectural Connection

### Backend: LegacyLens Core
- **Reuse:** Existing Node.js codebase (`src/core/*`)
- **No Rewrite:** Extension wraps CLI functionality
- **Communication:** Internal API calls to LegacyLens modules

### Communication Layer
```
VS Code Extension (TypeScript)
    ↓
Extension Host Process
    ↓
LegacyLens Core (Node.js modules)
    ↓
Gemini API / File System
```

### State Management
- **Project Map:** Initialized on workspace open, cached in memory
- **Semantic Index:** Loaded if available, rebuilt on demand
- **Analysis Cache:** Shared with CLI (`.legacylens-cache.json`)

---

## 3. Technology Stack

- **TypeScript:** Standard for VS Code extensions
- **VS Code API:** 
  - `vscode.languages.registerCodeLensProvider` - Lens overlays
  - `vscode.tree.TreeDataProvider` - Legacy Explorer
  - `vscode.window.createWebviewPanel` - AI Chat & Reports
  - `vscode.languages.registerDiagnostics` - Dead code highlighting
- **LegacyLens Core:** Imported as Node.js modules
- **Webviews:** For HTML reports and Mermaid diagrams

---

## 4. File Structure

```
vscode-extension/
├── src/
│   ├── extension.ts              # Main entry point
│   ├── providers/
│   │   ├── codeLensProvider.ts   # Lens overlays
│   │   ├── diagnosticProvider.ts # Dead code diagnostics
│   │   ├── treeDataProvider.ts   # Legacy Explorer tree
│   │   └── semanticSearchProvider.ts # Search results
│   ├── services/
│   │   ├── legacyLensService.ts  # Wrapper for LegacyLens Core
│   │   ├── projectMapService.ts  # Project Map management
│   │   └── semanticIndexService.ts # Semantic search
│   ├── webviews/
│   │   ├── aiChatPanel.ts        # AI Chat webview
│   │   └── reportPanel.ts        # Report viewer
│   └── commands/
│       ├── analyzeCommand.ts     # Analyze project
│       ├── autoFixCommand.ts     # Auto-fix dead code
│       └── semanticSearchCommand.ts # Search command
├── package.json                  # Extension manifest
├── tsconfig.json                 # TypeScript config
└── README.md                     # Extension docs
```

---

## 5. Implementation Plan

### Phase 1: Foundation
- [x] Create extension structure
- [ ] Initialize with `yo code`
- [ ] Basic activation on workspace open
- [ ] Import LegacyLens Core modules

### Phase 2: Project Map Integration
- [ ] Load Project Map on workspace open
- [ ] Cache Project Map in extension state
- [ ] Watch for file changes and update map
- [ ] Display project structure in Legacy Explorer

### Phase 3: Diagnostics & CodeLens
- [ ] Register diagnostic provider
- [ ] Highlight dead code with wavy underlines
- [ ] Register CodeLens provider
- [ ] Show "Auto-Fix" buttons above dead code

### Phase 4: Quick Fix Actions
- [ ] Implement Quick Fix commands
- [ ] Integrate with `auto-fix.js`
- [ ] Show confirmation dialog
- [ ] Apply fixes and refresh diagnostics

### Phase 5: Semantic Search
- [ ] Create sidebar panel
- [ ] Integrate SemanticIndexer
- [ ] Real-time search UI
- [ ] Navigate to results

### Phase 6: AI Chat
- [ ] Create webview panel
- [ ] Integrate with LegacyLens Core
- [ ] Chat interface with Project Map context
- [ ] Code generation and insertion

---

## 6. Integration Points

### LegacyLens Core Modules Used:
- `src/core/context-builder.js` - Project Map
- `src/core/semantic-indexer.js` - Semantic search
- `src/core/auto-fix.js` - Dead code removal
- `src/core/code-generator.js` - Code generation
- `src/core/ai-client.js` - AI analysis

### VS Code APIs Used:
- `vscode.workspace.onDidChangeTextDocument` - File change detection
- `vscode.workspace.workspaceFolders` - Project root
- `vscode.window.showInformationMessage` - User notifications
- `vscode.commands.registerCommand` - Command registration

---

## 7. Why We'll Beat Giants

| Feature | Copilot/GitHub | LegacyLens Extension |
|---------|---------------|---------------------|
| Focus | Write new code | Clean existing code |
| Context | Current file | Entire repository (Project Map) |
| Suggestions | Generic | Project-specific, context-aware |
| Dead Code | Ignored | Highlighted and auto-fixable |
| Speed | Slow (cloud) | Fast (local Project Map) |

---

## 8. Next Steps

1. **Initialize Extension:** Run `yo code` to create base structure
2. **Import Core:** Set up path to LegacyLens Core modules
3. **First Feature:** Implement Legacy Explorer (simplest)
4. **Iterate:** Add diagnostics, CodeLens, search, chat
