#!/usr/bin/env node

/**
 * LegacyLens CLI - Entry Point
 * 
 * This is a thin entry point that delegates to the modular CLI implementation.
 * All business logic has been moved to src/cli.js and other modules.
 * 
 * Usage:
 *   node legacylens-cli.js <project_path>
 * 
 * Or set API key:
 *   set GEMINI_API_KEY=your_key (Windows)
 *   export GEMINI_API_KEY=your_key (Linux/Mac)
 */

// Import modular CLI
const { setupCLI } = require('./src/cli');

// Run CLI only if file is executed directly
if (require.main === module) {
    const program = setupCLI();
    // Default to "analyze" when first arg is not a subcommand (legacylens . or legacylens --mock-ai)
    const subcommands = ['analyze', 'index', 'find', 'create-api', 'auto-fix', 'get-map', 'pin-context', 'affected', 'verify', 'setup-skills'];
    const first = process.argv[2];
    if (!first || first.startsWith('-') || !subcommands.includes(first)) {
        process.argv.splice(2, 0, 'analyze');
    }
    program.parse(process.argv);

    // Global error handler
    process.on('unhandledRejection', (error) => {
        const { logError } = require('./src/utils/logger');
        logError(`\n❌ Critical error: ${error.message}`);
        if (error.stack && process.env.DEBUG) {
            console.error('\nDetails:', error.stack);
        }
        process.exit(1);
    });
}
