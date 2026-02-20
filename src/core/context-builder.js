/**
 * Context Builder — Intelligence core for LegacyLens ("better than Codex").
 *
 * Turns a chaotic set of files into a structured Project Map that Gemini can
 * consume in one shot (1M context). Codex often forgets files not open in the
 * editor; we index the whole repo so that e.g. "Change logging logic" finds
 * src/utils/logger.js, src/core/scanner.js and all call sites automatically.
 *
 * Responsibilities:
 * - Ignore junk (node_modules, dist, logs, .git, etc.)
 * - Build project tree
 * - Extract function/class signatures (exports)
 * - Extract imports/exports so the model understands relationships
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { logDebug, logInfo } = require('../utils/logger');
const { VERSION } = require('../utils/constants');

const DEFAULT_IGNORE = [
    'node_modules', 'dist', 'build', '.git', '.env', '__pycache__', 'venv',
    '.vscode', '.idea', 'out', 'logs', 'coverage', '.nyc_output', '*.log',
    '.legacylens-map.json', '.legacylens-cache.json', '.legacylens-index.json' // Exclude our own cache files
];

const MAP_CACHE_FILENAME = '.legacylens-map.json';

const SOURCE_EXTENSIONS = ['.js', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.java', '.jsx'];

// ——— Signatures (functions, classes) ———
const SIGNATURES = {
    js: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(|(?:export\s+)?(?:async\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|(?:export\s+)?class\s+(\w+)\s*[{\s]/g,
    ts: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(|(?:export\s+)?(?:async\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|(?:export\s+)?(?:interface|type)\s+(\w+)\s*[{\s=]|(?:export\s+)?class\s+(\w+)\s*[{\s<]/g,
    py: /^def\s+(\w+)\s*\(|^class\s+(\w+)\s*\(/gm,
    java: /(?:public|private|protected)\s+(?:\w+\s+)+(\w+)\s*\([^)]*\)|class\s+(\w+)\s*[\{<]/g
};

// ——— Imports (JS/TS): require(), import from '', import() ———
const REQUIRE_REGEX = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const IMPORT_FROM_REGEX = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
const IMPORT_DYNAMIC_REGEX = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// ——— Exports (JS/TS): export {}, export default, module.exports ———
const EXPORT_NAMED_REGEX = /export\s+\{([^}]*)\}|export\s+(?:const|let|var|function|class|async\s+function)\s+(\w+)/g;
const EXPORT_DEFAULT_REGEX = /export\s+default\s+(\w+)\s*[;(\s]/g;
const MODULE_EXPORTS_REGEX = /module\.exports\s*=\s*(\w+)\b/g;

/**
 * Checks if a relative path should be ignored (junk).
 * @param {string} relPath - Path relative to project root
 * @param {object} [ignoreInstance] - Optional ignore instance (e.g. from parseGitignore)
 * @param {string[]} [extraPatterns] - Additional patterns (e.g. from config)
 */
function shouldIgnore(relPath, ignoreInstance, extraPatterns = []) {
    const parts = relPath.split(path.sep);
    const allPatterns = [...DEFAULT_IGNORE, ...extraPatterns];
    for (const p of allPatterns) {
        const pattern = p.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        if (parts.some(part => regex.test(part))) return true;
        if (regex.test(relPath)) return true;
    }
    if (ignoreInstance && typeof ignoreInstance.ignores === 'function' && ignoreInstance.ignores(relPath)) return true;
    return false;
}

/**
 * Builds a compact directory tree (respecting ignore).
 */
function buildTree(dirPath, projectRoot, ignoreInstance, extraIgnore, maxDepth = 5, depth = 0) {
    const root = projectRoot || dirPath;
    const name = path.basename(dirPath) || dirPath;
    const node = { name, children: [] };
    if (depth >= maxDepth) return node;

    let entries = [];
    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (e) {
        logDebug(`context-builder: cannot read dir ${dirPath}: ${e.message}`);
        return node;
    }

    for (const ent of entries) {
        const full = path.join(dirPath, ent.name);
        const rel = path.relative(root, full);
        if (shouldIgnore(rel, ignoreInstance, extraIgnore)) continue;
        if (ent.isDirectory()) {
            node.children.push(buildTree(full, root, ignoreInstance, extraIgnore, maxDepth, depth + 1));
        } else {
            node.children.push({ name: ent.name, leaf: true });
        }
    }
    return node;
}

/**
 * Extracts import targets (paths) from file content (JS/TS).
 */
function extractImports(content) {
    const out = new Set();
    for (const re of [REQUIRE_REGEX, IMPORT_FROM_REGEX, IMPORT_DYNAMIC_REGEX]) {
        let m;
        const regex = new RegExp(re.source, re.flags || 'g');
        while ((m = regex.exec(content)) !== null) {
            const spec = m[1];
            if (spec && !spec.startsWith('.')) continue; // skip node_modules / builtins
            if (spec) out.add(spec.trim());
        }
    }
    return [...out];
}

/**
 * Extracts export names / default from file content (JS/TS).
 */
function extractExports(content) {
    const named = new Set();
    let defaultExport = null;
    let m;
    const namedRe = new RegExp(EXPORT_NAMED_REGEX.source, EXPORT_NAMED_REGEX.flags || 'g');
    while ((m = namedRe.exec(content)) !== null) {
        if (m[1]) {
            const part = m[1].trim();
            if (part) {
                part.split(',').forEach(s => {
                    const name = s.replace(/\s+as\s+\w+$/, '').trim().split(/\s+/)[0];
                    if (name) named.add(name);
                });
            }
        }
        if (m[2]) named.add(m[2]);
    }
    const defaultRe = new RegExp(EXPORT_DEFAULT_REGEX.source, EXPORT_DEFAULT_REGEX.flags || 'g');
    if ((m = defaultRe.exec(content)) !== null && m[1]) defaultExport = m[1];
    const modRe = new RegExp(MODULE_EXPORTS_REGEX.source, MODULE_EXPORTS_REGEX.flags || 'g');
    while ((m = modRe.exec(content)) !== null) {
        if (m[1]) named.add(m[1]);
    }
    return { named: [...named], default: defaultExport };
}

/**
 * Extracts function/class/signature names from file content by extension.
 */
function extractSignatures(filePath, content) {
    const ext = path.extname(filePath).toLowerCase();
    const regex = SIGNATURES.ts && (ext === '.ts' || ext === '.tsx') ? SIGNATURES.ts
        : ext === '.py' ? SIGNATURES.py
        : ext === '.java' ? SIGNATURES.java
        : SIGNATURES.js;
    const out = [];
    let m;
    const re = new RegExp(regex.source, regex.flags || 'g');
    while ((m = re.exec(content)) !== null) {
        const name = m.slice(1).find(Boolean);
        if (name && !out.includes(name)) out.push(name);
    }
    return out.slice(0, 30);
}

/**
 * Recursively collects all source files under dir, respecting ignore and extensions.
 */
function collectSourceFiles(dirPath, projectRoot, ignoreInstance, extraIgnore, extensions, list = []) {
    const root = projectRoot || dirPath;
    let entries = [];
    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (e) {
        return list;
    }
    for (const ent of entries) {
        const full = path.join(dirPath, ent.name);
        const rel = path.relative(root, full);
        if (shouldIgnore(rel, ignoreInstance, extraIgnore)) continue;
        if (ent.isDirectory()) {
            collectSourceFiles(full, root, ignoreInstance, extraIgnore, extensions, list);
        } else if (extensions.some(ext => ent.name.endsWith(ext))) {
            list.push({ full, rel });
        }
    }
    return list;
}

/**
 * Calculates hash of file list (paths + content hashes) for cache invalidation.
 * Uses content hash instead of mtime to avoid cache misses when files are read but not changed.
 */
function calculateMapHash(fileList) {
    const sorted = [...fileList].sort((a, b) => a.rel.localeCompare(b.rel));
    const hash = crypto.createHash('sha256');
    for (const f of sorted) {
        try {
            const stat = fs.statSync(f.full);
            // Use content hash (first 1KB) + size instead of mtime for stability
            const content = fs.readFileSync(f.full, 'utf-8').slice(0, 1024);
            const contentHash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
            hash.update(`${f.rel}:${stat.size}:${contentHash}`);
        } catch (e) {
            hash.update(`${f.rel}:missing`);
        }
    }
    return hash.digest('hex');
}

/**
 * Saves Project Map to cache file.
 */
function saveProjectMap(projectPath, map, fileHash) {
    const cachePath = path.join(projectPath, MAP_CACHE_FILENAME);
    try {
        const data = {
            hash: fileHash,
            map,
            timestamp: Date.now(),
            version: VERSION
        };
        fs.writeFileSync(cachePath, JSON.stringify(data, null, 0), 'utf-8');
        logDebug(`Project Map cached: ${cachePath}`);
        return true;
    } catch (e) {
        logDebug(`Failed to save Project Map cache: ${e.message}`);
        return false;
    }
}

/**
 * Loads Project Map from cache if hash matches.
 */
function loadProjectMap(projectPath, expectedHash) {
    const cachePath = path.join(projectPath, MAP_CACHE_FILENAME);
    if (!fs.existsSync(cachePath)) {
        logDebug('Project Map cache not found');
        return null;
    }
    try {
        const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        if (data.version !== VERSION) {
            logDebug(`Project Map cache version mismatch: ${data.version} vs ${VERSION}`);
            return null;
        }
        if (data.hash !== expectedHash) {
            logDebug(`Project Map cache hash mismatch: ${data.hash?.substring(0, 8)}... vs ${expectedHash?.substring(0, 8)}...`);
            return null;
        }
        logInfo(`✅ Project Map loaded from cache (${data.map?.files?.length || 0} files)`);
        return data.map;
    } catch (e) {
        logDebug(`Failed to load Project Map cache: ${e.message}`);
    }
    return null;
}

/**
 * Builds the full Project Map: tree + per-file signatures, exports, imports.
 * Uses cache if available and files haven't changed.
 *
 * @param {string} projectPath - Project root
 * @param {object} [options] - { ignore, include (extensions), maxFileSize, maxDepth, forceRebuild }
 * @returns {Promise<{ tree, files: Array<{ path, signatures, exports, imports }>, summary }>}
 */
async function buildProjectMap(projectPath, options = {}) {
    const ignoreInstance = options.ignore || null;
    const extraIgnore = options.extraIgnore || [];
    const extensions = options.include && options.include.length
        ? options.include.filter(e => e.startsWith('.'))
        : SOURCE_EXTENSIONS;
    const maxFileSize = options.maxFileSize != null ? options.maxFileSize : 100000;
    const maxDepth = options.maxTreeDepth != null ? options.maxTreeDepth : 5;
    const forceRebuild = options.forceRebuild || false;

    // Collect file list first (needed for hash)
    const fileList = collectSourceFiles(projectPath, projectPath, ignoreInstance, extraIgnore, extensions);
    const fileHash = calculateMapHash(fileList);

    // Try cache (unless force rebuild)
    if (!forceRebuild) {
        const cached = loadProjectMap(projectPath, fileHash);
        if (cached) {
            // Rebuild summary (may depend on options)
            cached.summary = toSummaryString(cached);
            logDebug(`Using cached Project Map (hash: ${fileHash.substring(0, 8)}...)`);
            return cached;
        }
    }

    // Build fresh map
    logInfo(`🔨 Building Project Map (${fileList.length} files, hash: ${fileHash.substring(0, 8)}...)...`);
    const tree = buildTree(projectPath, projectPath, ignoreInstance, extraIgnore, maxDepth);

    const files = [];
    for (const { full, rel } of fileList) {
        let content = '';
        try {
            content = fs.readFileSync(full, 'utf-8');
        } catch (e) {
            logDebug(`context-builder: skip read ${rel}: ${e.message}`);
            continue;
        }
        if (content.length > maxFileSize) content = content.slice(0, maxFileSize);
        const signatures = extractSignatures(full, content);
        const imports = extractImports(content);
        const exports = extractExports(content);
        files.push({
            path: rel.replace(/\\/g, '/'), // Normalize to forward slashes
            signatures,
            imports: imports.map(i => i.replace(/\\/g, '/')), // Normalize imports too
            exports: { 
                named: Array.isArray(exports.named) ? exports.named : Array.from(exports.named || []), 
                default: exports.default 
            }
        });
    }

    const map = { tree, files };
    map.summary = toSummaryString(map);

    // Save to cache
    saveProjectMap(projectPath, map, fileHash);

    return map;
}

/**
 * Converts the Project Map to a single string for prepending to Gemini prompts.
 * Kept compact so more room remains for actual code.
 */
function toSummaryString(map) {
    const lines = [];
    lines.push('--- PROJECT MAP (structure + relationships; use to avoid hallucinating files) ---');
    lines.push('FOLDER TREE:');
    lines.push(treeToString(map.tree));
    lines.push('');
    lines.push('FILES (signatures + imports → exports):');
    for (const f of map.files.slice(0, 200)) {
        const exp = [...(f.exports.named || [])];
        if (f.exports.default) exp.push(`default:${f.exports.default}`);
        const imp = (f.imports || []).slice(0, 8).join(', ');
        const sig = (f.signatures || []).slice(0, 10).join(', ');
        lines.push(`  ${f.path}`);
        if (sig) lines.push(`    signatures: ${sig}`);
        if (exp.length) lines.push(`    exports: ${exp.join(', ')}`);
        if (imp) lines.push(`    imports: ${imp}`);
    }
    if (map.files.length > 200) lines.push(`  ... and ${map.files.length - 200} more files`);
    lines.push('--- END PROJECT MAP ---');
    return lines.join('\n');
}

function treeToString(node, indent = '') {
    const lines = [];
    for (const c of node.children || []) {
        if (c.leaf) lines.push(`${indent}  ${c.name}`);
        else {
            lines.push(`${indent}  ${c.name}/`);
            lines.push(treeToString(c, indent + '  '));
        }
    }
    return lines.filter(Boolean).join('\n');
}

/**
 * Generates Mermaid flowchart for folder structure.
 */
function generateMermaidTree(tree, maxDepth = 3, depth = 0) {
    if (depth >= maxDepth || !tree || !tree.children) return '';
    const lines = [];
    const nodeId = (name) => {
        const clean = (name || 'root').replace(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, 'n$1');
        return clean || 'root';
    };
    const seen = new Set();
    function walk(node, parentId = null, currentDepth = 0) {
        if (currentDepth >= maxDepth) return;
        const id = nodeId(node.name || 'root');
        if (seen.has(id)) return;
        seen.add(id);
        const label = (node.name || 'root').replace(/"/g, '&quot;').slice(0, 30);
        if (parentId === null) {
            lines.push(`  ${id}["${label}"]`);
        } else if (!node.leaf) {
            lines.push(`  ${id}["${label}"]`);
            lines.push(`  ${parentId} --> ${id}`);
        }
        for (const c of node.children || []) {
            if (!c.leaf) walk(c, id, currentDepth + 1);
        }
    }
    walk(tree, null, 0);
    return lines.length ? lines.join('\n') : '';
}

/**
 * Generates Mermaid graph for import/export relationships between files.
 * Shows which files import from which (edges: imports → exports).
 */
function generateMermaidGraph(files, maxFiles = 50) {
    if (!files || files.length === 0) return '';
    const lines = [];
    const nodeId = (p) => {
        const clean = p.replace(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, 'n$1').slice(0, 30);
        return clean || 'file';
    };
    
    // Build full file map for resolution (ALL files, not just those with imports)
    const fileMap = new Map();
    files.forEach(f => fileMap.set(f.path, f));
    
    // Find files with imports (they will be source nodes)
    const filesWithImports = files.filter(f => f.imports && f.imports.length > 0);
    if (filesWithImports.length === 0) return '';
    
    // Limit to maxFiles but prioritize files with more imports
    const sorted = filesWithImports.sort((a, b) => (b.imports?.length || 0) - (a.imports?.length || 0));
    const limited = sorted.slice(0, maxFiles);
    
    const nodeIds = new Set();
    const edges = new Set();
    const importedFiles = new Set(); // Files that are imported (targets)

    // First pass: collect all nodes (files with imports and their targets)
    limited.forEach(f => {
        const id = nodeId(f.path);
        nodeIds.add(id);
        (f.imports || []).forEach(imp => {
            const resolved = resolveImportPath(f.path, imp, fileMap);
            if (resolved && fileMap.has(resolved)) {
                importedFiles.add(resolved);
            }
        });
    });
    
    // Add imported files as nodes too
    importedFiles.forEach(filePath => {
        const id = nodeId(filePath);
        nodeIds.add(id);
    });

    // Second pass: add nodes (only those that will have edges)
    const allNodes = new Set([...nodeIds]);
    allNodes.forEach(id => {
        // Find file path for this id
        const filePath = [...fileMap.keys()].find(p => nodeId(p) === id);
        if (filePath) {
            const name = (filePath.split(/[/\\]/).pop() || filePath).replace(/"/g, '&quot;').slice(0, 25);
            lines.push(`  ${id}["${name}"]`);
        }
    });

    // Third pass: add edges (only if both nodes exist)
    limited.forEach(f => {
        const fromId = nodeId(f.path);
        if (!allNodes.has(fromId)) {
            logDebug(`generateMermaidGraph: skipping ${f.path} (not in allNodes)`);
            return;
        }
        (f.imports || []).forEach(imp => {
            const resolved = resolveImportPath(f.path, imp, fileMap);
            if (resolved && fileMap.has(resolved)) {
                const toId = nodeId(resolved);
                if (allNodes.has(toId)) {
                    const edge = `${fromId} --> ${toId}`;
                    if (!edges.has(edge)) {
                        edges.add(edge);
                        lines.push(`  ${edge}`);
                    }
                } else {
                    logDebug(`generateMermaidGraph: target ${resolved} (${toId}) not in allNodes`);
                }
            } else {
                logDebug(`generateMermaidGraph: failed to resolve ${imp} from ${f.path}`);
            }
        });
    });

    return lines.length ? lines.join('\n') : '';
}

/**
 * Resolves import path (e.g. './utils' or '../core/scanner') to actual file path.
 * fileMap contains relative paths from project root.
 */
function resolveImportPath(fromFile, importPath, fileMap) {
    if (!importPath || !importPath.startsWith('.')) return null; // skip node_modules
    
    // Normalize: fromFile is relative to project root (e.g. "src/cli.js" or "legacylens-cli.js")
    const fromDir = path.dirname(fromFile || '.').replace(/\\/g, '/');
    const normalizedFromDir = fromDir === '.' ? '' : fromDir;
    
    // Resolve relative path: if fromDir is empty, importPath is relative to root
    let resolved = '';
    if (normalizedFromDir) {
        resolved = path.posix.join(normalizedFromDir, importPath).replace(/\\/g, '/');
    } else {
        resolved = importPath.replace(/^\.\//, '').replace(/\\/g, '/');
    }
    
    // Normalize: remove leading ./ and resolve ..
    const parts = resolved.split('/').filter(p => p && p !== '.');
    const normalized = [];
    for (const part of parts) {
        if (part === '..') {
            normalized.pop();
        } else {
            normalized.push(part);
        }
    }
    resolved = normalized.join('/');
    
    // Normalize resolved to forward slashes for comparison
    resolved = resolved.replace(/\\/g, '/');
    
    // Try exact match first
    if (fileMap.has(resolved)) return resolved;
    
    // Try with extensions (most common case: './src/cli' -> 'src/cli.js')
    for (const ext of ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs']) {
        const candidate = resolved + ext;
        if (fileMap.has(candidate)) return candidate;
    }
    
    // Try as directory with index file (e.g. './src/utils' -> 'src/utils/index.js')
    for (const ext of ['/index.js', '/index.ts', '/index.jsx', '/index.tsx']) {
        const candidate = resolved + ext;
        if (fileMap.has(candidate)) return candidate;
    }
    
    // Try matching by basename (last resort: find file with same name)
    const basename = path.basename(resolved);
    for (const filePath of fileMap.keys()) {
        const fileBasename = path.basename(filePath, path.extname(filePath));
        if (fileBasename === basename) {
            // Prefer files in same directory or closer
            const fileDir = path.dirname(filePath).replace(/\\/g, '/');
            const targetDir = normalized.slice(0, -1).join('/');
            if (fileDir === targetDir || fileDir.endsWith('/' + targetDir)) {
                return filePath.replace(/\\/g, '/'); // Normalize to forward slashes
            }
        }
    }
    
    return null;
}

/**
 * Generates Mermaid diagrams (tree + graph) as markdown code blocks.
 */
function generateMermaidDiagrams(map, options = {}) {
    const maxTreeDepth = options.maxTreeDepth || 3;
    const maxGraphFiles = options.maxGraphFiles || 50;
    const parts = [];

    // Folder structure flowchart
    const treeMermaid = generateMermaidTree(map.tree, maxTreeDepth);
    if (treeMermaid) {
        parts.push('```mermaid\nflowchart TD\n' + treeMermaid + '\n```');
    }

    // Import/export graph
    const graphMermaid = generateMermaidGraph(map.files, maxGraphFiles);
    if (graphMermaid) {
        parts.push('```mermaid\ngraph LR\n' + graphMermaid + '\n```');
    }

    return parts.join('\n\n');
}

/**
 * High-level: build Project Map and return the string to prepend to any Gemini prompt.
 */
async function getProjectMapForPrompt(projectPath, options = {}) {
    const map = await buildProjectMap(projectPath, options);
    return map.summary;
}

/**
 * Normalize file path to project-relative forward slashes (for comparison).
 */
function normalizePath(relPath) {
    return (relPath || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Get files affected by changing the given file: dependencies (what it imports) and dependents (what imports it).
 * @param {object} map - Project Map from buildProjectMap()
 * @param {string} relativeFilePath - File path relative to project root (e.g. "src/utils/logger.js")
 * @returns {{ dependencies: string[], dependents: string[], all: string[] }}
 */
function getAffectedFiles(map, relativeFilePath) {
    if (!map || !map.files) return { dependencies: [], dependents: [], all: [] };
    const fileMap = new Map(map.files.map(f => [f.path, f]));
    const focus = normalizePath(relativeFilePath);
    const focusEntry = map.files.find(f => normalizePath(f.path) === focus || f.path === relativeFilePath);
    if (!focusEntry) return { dependencies: [], dependents: [], all: [focus] };

    const dependencies = new Set();
    (focusEntry.imports || []).forEach(imp => {
        const resolved = resolveImportPath(focusEntry.path, imp, fileMap);
        if (resolved) dependencies.add(resolved);
    });

    const dependents = new Set();
    map.files.forEach(f => {
        (f.imports || []).forEach(imp => {
            const resolved = resolveImportPath(f.path, imp, fileMap);
            if (resolved && (normalizePath(resolved) === focus || resolved === relativeFilePath)) {
                dependents.add(f.path);
            }
        });
    });

    const all = [...new Set([focusEntry.path, ...dependencies, ...dependents])];
    return {
        dependencies: [...dependencies],
        dependents: [...dependents],
        all
    };
}

/**
 * Context-Pinning: return only the slice of Project Map relevant to the given file.
 * Reduces context pollution by giving agents only dependencies + dependents of the focus file.
 * @param {string} projectPath - Project root
 * @param {string} relativeFilePath - File to focus (e.g. "src/utils/logger.js")
 * @param {object} [options] - buildProjectMap options + { transitive: number } (default 0 = direct only; 1 = one level out)
 * @returns {Promise<{ focusFile: string, dependencies: string[], dependents: string[], files: object[], summary: string }>}
 */
async function getPinnedContext(projectPath, relativeFilePath, options = {}) {
    const { transitive = 0, ...buildOptions } = options;
    const map = await buildProjectMap(projectPath, buildOptions);
    const affected = getAffectedFiles(map, relativeFilePath);
    const pathSet = new Set(affected.all);

    if (transitive >= 1) {
        const secondLevel = new Set(affected.all);
        affected.dependencies.forEach(dep => {
            const sub = getAffectedFiles(map, dep);
            sub.dependencies.forEach(p => secondLevel.add(p));
            sub.dependents.forEach(p => secondLevel.add(p));
        });
        affected.dependents.forEach(dep => {
            const sub = getAffectedFiles(map, dep);
            sub.dependencies.forEach(p => secondLevel.add(p));
            sub.dependents.forEach(p => secondLevel.add(p));
        });
        secondLevel.forEach(p => pathSet.add(p));
    }

    const files = map.files.filter(f => pathSet.has(f.path));
    const focusEntry = map.files.find(f => normalizePath(f.path) === normalizePath(relativeFilePath));
    const summary = [
        '--- PINNED CONTEXT (only files related to ' + relativeFilePath + ') ---',
        'Focus file: ' + (focusEntry ? focusEntry.path : relativeFilePath),
        'Dependencies (this file imports): ' + affected.dependencies.join(', ') || 'none',
        'Dependents (import this file): ' + affected.dependents.join(', ') || 'none',
        'Total files in context: ' + files.length,
        '---'
    ].join('\n');

    return {
        focusFile: focusEntry ? focusEntry.path : relativeFilePath,
        dependencies: affected.dependencies,
        dependents: affected.dependents,
        files,
        summary,
        projectMap: { tree: map.tree, files, summary }
    };
}

/**
 * Verify Project Map: check that every import resolves to an existing file.
 * Used for loop-based verification after refactors (e.g. legacylens-verify).
 * @param {string} projectPath - Project root
 * @param {object} [options] - buildProjectMap options
 * @returns {Promise<{ ok: boolean, brokenImports: Array<{ from: string, import: string, reason: string }>, totalChecked: number }>}
 */
async function verifyProjectMap(projectPath, options = {}) {
    const map = await buildProjectMap(projectPath, options);
    const fileMap = new Map(map.files.map(f => [f.path, f]));
    const brokenImports = [];
    let totalChecked = 0;

    map.files.forEach(f => {
        (f.imports || []).forEach(imp => {
            if (!imp || !imp.startsWith('.')) return; // skip node_modules
            totalChecked++;
            const resolved = resolveImportPath(f.path, imp, fileMap);
            if (!resolved) {
                brokenImports.push({
                    from: f.path,
                    import: imp,
                    reason: 'Target not found or not in project map'
                });
            } else if (!fileMap.has(resolved)) {
                brokenImports.push({
                    from: f.path,
                    import: imp,
                    reason: 'Resolved to ' + resolved + ' but file not in map'
                });
            }
        });
    });

    return {
        ok: brokenImports.length === 0,
        brokenImports,
        totalChecked
    };
}

module.exports = {
    DEFAULT_IGNORE,
    MAP_CACHE_FILENAME,
    shouldIgnore,
    buildTree,
    extractSignatures,
    extractImports,
    extractExports,
    collectSourceFiles,
    calculateMapHash,
    saveProjectMap,
    loadProjectMap,
    buildProjectMap,
    toSummaryString,
    generateMermaidTree,
    generateMermaidGraph,
    resolveImportPath,
    generateMermaidDiagrams,
    getProjectMapForPrompt,
    normalizePath,
    getAffectedFiles,
    getPinnedContext,
    verifyProjectMap
};
