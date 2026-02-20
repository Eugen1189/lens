/**
 * ContextEngine: builds a "project map" before each AI action.
 * Delegates to context-builder (intelligence core) for tree + signatures + imports/exports.
 * Feeds the model with a structured map so it doesn't hallucinate; uses 1M context strategy.
 */

const contextBuilder = require('./context-builder');

/**
 * Builds a shallow directory tree — delegates to context-builder for consistency.
 */
function buildFolderTree(dirPath, ignore, maxDepth = 4, currentDepth = 0, projectRoot = null) {
    return contextBuilder.buildTree(dirPath, projectRoot || dirPath, ignore, [], maxDepth, currentDepth);
}

/**
 * Extracts signatures from a file — delegates to context-builder.
 */
function extractSignatures(filePath, content) {
    return contextBuilder.extractSignatures(filePath, content);
}

/**
 * Builds the full project map: tree + files with signatures, exports, imports.
 * Uses context-builder (single source of truth for "Project Map").
 */
function treeToLines(node, indent = '') {
    const lines = [];
    for (const c of node.children || []) {
        if (c.leaf) lines.push(`${indent}  ${c.name}`);
        else {
            lines.push(`${indent}  ${c.name}/`);
            lines.push(...treeToLines(c, indent + '  '));
        }
    }
    return lines;
}

async function buildProjectMap(projectPath, options = {}) {
    const map = await contextBuilder.buildProjectMap(projectPath, {
        ignore: options.ignore,
        extraIgnore: options.extraIgnore || [],
        include: options.include,
        maxFileSize: options.maxKeyFileSize || options.maxFileSize || 100000,
        maxTreeDepth: options.maxTreeDepth || 5
    });
    const structure = treeToLines(map.tree).filter(Boolean).join('\n') || '(empty)';
    const interfaces = map.files.slice(0, 150).map(f => {
        const sig = (f.signatures || []).join(', ');
        const exp = [...(f.exports.named || [])];
        if (f.exports.default) exp.push(`default:${f.exports.default}`);
        return `## ${f.path}\n  signatures: ${sig || '-'}\n  exports: ${exp.length ? exp.join(', ') : '-'}\n  imports: ${(f.imports || []).slice(0, 5).join(', ') || '-'}`;
    }).join('\n\n');
    return {
        structure,
        interfaces: interfaces || '(no key interfaces extracted)',
        map
    };
}

/**
 * Returns a single string to prepend to AI prompts: full Project Map (tree + relationships).
 * Uses context-builder so the model gets imports/exports and all signatures.
 */
async function getContextForPrompt(projectPath, options = {}) {
    return contextBuilder.getProjectMapForPrompt(projectPath, {
        ignore: options.ignore,
        extraIgnore: options.extraIgnore || [],
        include: options.include,
        maxFileSize: options.maxKeyFileSize || options.maxFileSize || 100000
    });
}

module.exports = {
    buildFolderTree,
    buildProjectMap,
    getContextForPrompt,
    extractSignatures
};
