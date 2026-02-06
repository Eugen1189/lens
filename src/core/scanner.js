// Project scanner module
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { logDebug, updateProgress } = require('../utils/logger');
const { shouldIgnore, parseGitignore } = require('./gitignore');

async function scanProject(rootDir, config, gitignoreInstance, currentDir = null, progress = { scanned: 0, total: 0 }, fileListCache = null) {
    if (currentDir === null) {
        currentDir = rootDir;
        // Optimization: if cached file list exists, use it
        if (fileListCache && fileListCache.total > 0) {
            progress.total = fileListCache.total;
            logDebug('Using cached file list for progress bar');
        } else {
            // First count total number of files for progress bar
            console.log(require('../utils/logger').colorize('⏳ Estimating file count...', 'yellow'));
            progress.total = await estimateFileCount(rootDir, config, gitignoreInstance);
            if (progress.total > 0) {
                console.log(require('../utils/logger').colorize(`   Found approximately ${progress.total} files to scan\n`, 'gray'));
            }
        }
    }

    let results = [];
    let list = [];

    try {
        list = await fsPromises.readdir(currentDir);
    } catch (e) {
        return results;
    }

    // Create regex for extension checking
    const includePattern = new RegExp(`\\.(${config.include.map(ext => ext.replace(/^\./, '')).join('|')})$`, 'i');

    // Collect all files for parallel reading
    const maxConcurrentReads = config.maxConcurrentReads || 20;
    let currentBatch = [];

    for (const file of list) {
        const filePath = path.join(currentDir, file);
        const relativePath = path.relative(rootDir, filePath);

        // Check if file/folder is ignored
        if (shouldIgnore(filePath, relativePath, gitignoreInstance)) {
            continue;
        }

        try {
            const stat = await fsPromises.stat(filePath);
            if (stat && stat.isDirectory()) {
                // Recursive scanning of subdirectories
                const subResults = await scanProject(rootDir, config, gitignoreInstance, filePath, progress, fileListCache);
                results = results.concat(subResults);
            } else {
                // Check file extension
                if (includePattern.test(file)) {
                    // Add file to reading queue
                    currentBatch.push({ filePath, relativePath });

                    // If reached limit, read batch
                    if (currentBatch.length >= maxConcurrentReads) {
                        const batchResults = await readFileBatch(currentBatch, config, progress, rootDir);
                        results = results.concat(batchResults);
                        currentBatch = [];
                    }
                }
            }
        } catch (e) {
            // Skip files with errors
        }
    }

    // Read remaining files
    if (currentBatch.length > 0) {
        const batchResults = await readFileBatch(currentBatch, config, progress, rootDir);
        results = results.concat(batchResults);
    }

    return results;
}

async function readFileBatch(fileBatch, config, progress, rootDir) {
    // Optimization: use Promise.allSettled for better error handling
    const readPromises = fileBatch.map(async ({ filePath, relativePath }) => {
        try {
            // Optimization: read only needed portion for large files
            const stats = await fsPromises.stat(filePath);
            let content;

            if (stats.size > config.maxFileSize) {
                // For large files read only first maxFileSize bytes
                const fileHandle = await fsPromises.open(filePath, 'r');
                const buffer = Buffer.alloc(config.maxFileSize);
                await fileHandle.read(buffer, 0, config.maxFileSize, 0);
                await fileHandle.close();
                content = buffer.toString('utf-8') + "\n...[TRUNCATED]...";
            } else {
                content = await fsPromises.readFile(filePath, 'utf-8');
            }

            return {
                path: relativePath || path.basename(filePath),
                content: content
            };
        } catch (readError) {
            // Skip files that couldn't be read
            logDebug(`Failed to read file ${filePath}: ${readError.message}`);
            return null;
        }
    });

    // Use Promise.allSettled for better error handling
    const batchResults = await Promise.allSettled(readPromises);
    const validResults = batchResults
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);

    // Update progress bar
    progress.scanned += validResults.length;
    if (progress.total > 0) {
        updateProgress(progress.scanned, progress.total, fileBatch[fileBatch.length - 1]?.filePath);
    }

    return validResults;
}

async function estimateFileCount(dir, config, gitignoreInstance, visited = new Set(), rootDir = null) {
    if (rootDir === null) {
        rootDir = dir;
    }

    // Prevent infinite loops
    let realPath;
    try {
        realPath = await fsPromises.realpath(dir);
    } catch (e) {
        return 0;
    }

    if (visited.has(realPath)) {
        return 0;
    }
    visited.add(realPath);

    let count = 0;
    let list = [];

    try {
        list = await fsPromises.readdir(dir);
    } catch (e) {
        return 0;
    }

    // Create regex for extension checking
    const includePattern = new RegExp(`\\.(${config.include.map(ext => ext.replace(/^\./, '')).join('|')})$`, 'i');

    for (const file of list) {
        const filePath = path.join(dir, file);
        const relativePath = path.relative(rootDir, filePath);

        // Check if file/folder is ignored
        if (shouldIgnore(filePath, relativePath, gitignoreInstance)) {
            continue;
        }

        try {
            const stat = await fsPromises.stat(filePath);
            if (stat && stat.isDirectory()) {
                count += await estimateFileCount(filePath, config, gitignoreInstance, visited, rootDir);
            } else {
                if (includePattern.test(file)) {
                    count++;
                }
            }
        } catch (e) {
            // Skip files with errors
        }
    }

    return count;
}

module.exports = {
    scanProject,
    readFileBatch,
    estimateFileCount
};
