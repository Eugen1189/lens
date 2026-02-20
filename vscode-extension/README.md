# LegacyLens Copilot - VS Code Extension

AI-powered code cleanup and analysis directly in VS Code.

## Features

- **🔍 CodeLens Overlays:** See dead code warnings above unused exports
- **📊 Legacy Explorer:** Color-coded project tree (red = needs refactoring, green = clean)
- **🔎 Semantic Search:** Find code by meaning, not just keywords
- **🤖 AI Chat:** Chat with AI that understands your entire project structure
- **🔧 Auto-Fix:** Remove dead code with one click

## Installation

1. Install from VS Code Marketplace (coming soon)
2. Or build from source:
   ```bash
   cd vscode-extension
   npm install
   npm run compile
   ```

## Setup

1. Get your Google Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Open VS Code Settings
3. Search for "LegacyLens"
4. Enter your API key in `legacylens.apiKey`

## Usage

### Analyze Project
- Command Palette: `LegacyLens: Analyze Project`
- Or click the LegacyLens icon in the sidebar

### Auto-Fix Dead Code
- Click the `[Auto-Fix]` button above dead code
- Or Command Palette: `LegacyLens: Auto-Fix Dead Code`

### Semantic Search
- Command Palette: `LegacyLens: Semantic Search`
- Type your query (e.g., "authentication logic")
- Click result to navigate to file

### AI Chat
- Command Palette: `LegacyLens: Open AI Chat`
- Ask questions about your code
- AI has access to your Project Map

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Package extension
npm run package
```

## License

MIT © LegacyLens Team
