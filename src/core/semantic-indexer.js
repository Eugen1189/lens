/**
 * SemanticIndexer: vectorizes code with Gemini Embedding (gemini-embedding-001).
 * Builds an index so Atlas can find code by meaning (e.g. "auth logic" in utils_old_2.js)
 * without re-reading the whole project.
 */

const fs = require('fs');
const path = require('path');
const { getEmbeddingModel } = require('./engines');
const { logInfo, logWarn, logDebug } = require('../utils/logger');

const INDEX_FILENAME = '.legacylens-index.json';
const MAX_CHUNK_CHARS = 8000;   // Safe for embedding API
const BATCH_SIZE = 5;           // Requests in parallel (rate limit friendly)
const DEFAULT_TOP_K = 10;

/**
 * Calls Gemini Embedding API via REST (same API key as generate).
 * @param {string} apiKey
 * @param {string} model - e.g. gemini-embedding-001
 * @param {string} text
 * @param {{ taskType?: string, title?: string }} [opts]
 * @returns {Promise<number[]>} Embedding vector
 */
async function embedText(apiKey, model, text, opts = {}) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.replace('models/', '')}:embedContent?key=${apiKey}`;
    const body = {
        content: { parts: [{ text: text.slice(0, 20000) }] }
    };
    if (opts.taskType) body.taskType = opts.taskType;
    if (opts.title) body.title = opts.title;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Embedding API error ${res.status}: ${err}`);
    }
    const data = await res.json();
    const emb = data.embedding || (data.embeddings && data.embeddings[0]);
    if (!emb || !emb.values) throw new Error('Invalid embedding response');
    return emb.values;
}

/**
 * Splits file content into chunks (by lines) under MAX_CHUNK_CHARS.
 * @param {string} filePath - Relative path for labeling
 * @param {string} content
 * @returns {Array<{ path: string, text: string, startLine?: number }>}
 */
function chunkFile(filePath, content) {
    const lines = content.split('\n');
    const chunks = [];
    let current = [];
    let currentLen = 0;
    let startLine = 1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineLen = line.length + 1;
        if (currentLen + lineLen > MAX_CHUNK_CHARS && current.length) {
            chunks.push({
                path: filePath,
                text: current.join('\n'),
                startLine
            });
            current = [];
            currentLen = 0;
            startLine = i + 1;
        }
        current.push(line);
        currentLen += lineLen;
    }
    if (current.length) {
        chunks.push({ path: filePath, text: current.join('\n'), startLine });
    }
    return chunks;
}

/**
 * Cosine similarity between two vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    const den = Math.sqrt(na) * Math.sqrt(nb);
    return den === 0 ? 0 : dot / den;
}

/**
 * Builds the semantic index: for each chunk, store path + text + embedding.
 * @param {string} projectPath - Project root
 * @param {object} files - Array of { path, content } (e.g. from scanner)
 * @param {string} apiKey
 * @param {{ embeddingModel?: string }} [options]
 * @returns {Promise<{ index: Array<{ path, text, startLine, embedding }>, model: string }>}
 */
async function buildIndex(projectPath, files, apiKey, options = {}) {
    const model = options.embeddingModel || getEmbeddingModel(options.engines);
    const chunks = [];
    for (const f of files) {
        chunks.push(...chunkFile(f.path, f.content || ''));
    }
    logInfo(`SemanticIndexer: ${chunks.length} chunks from ${files.length} files (model: ${model})`);

    const index = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (c) => {
            const values = await embedText(apiKey, model, `${c.path}:\n${c.text}`, { taskType: 'RETRIEVAL_DOCUMENT', title: c.path });
            return { path: c.path, text: c.text, startLine: c.startLine, embedding: values };
        });
        const results = await Promise.all(promises);
        index.push(...results);
        logDebug(`Embedded ${index.length}/${chunks.length} chunks`);
    }

    return { index, model };
}

/**
 * Saves index to projectPath/.legacylens-index.json
 * @param {string} projectPath
 * @param {object} data - { index, model, version? }
 */
function saveIndex(projectPath, data) {
    const filePath = path.join(projectPath, INDEX_FILENAME);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 0), 'utf-8');
    logInfo(`Index saved: ${filePath} (${data.index.length} chunks)`);
}

/**
 * Loads index from disk.
 * @param {string} projectPath
 * @returns {{ index: Array<{ path, text, startLine, embedding }>, model: string } | null}
 */
function loadIndex(projectPath) {
    const filePath = path.join(projectPath, INDEX_FILENAME);
    if (!fs.existsSync(filePath)) return null;
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        logWarn(`Failed to load index: ${e.message}`);
        return null;
    }
}

/**
 * Semantic search: embed query, then find top-k chunks by similarity.
 * @param {string} query - e.g. "where is user authentication"
 * @param {object} indexData - From loadIndex or buildIndex
 * @param {string} apiKey
 * @param {string} embeddingModel
 * @param {number} topK
 * @returns {Promise<Array<{ path, text, startLine, score }>>}
 */
async function search(query, indexData, apiKey, embeddingModel, topK = DEFAULT_TOP_K) {
    if (!indexData || !indexData.index || !indexData.index.length) {
        return [];
    }
    const queryEmb = await embedText(apiKey, embeddingModel, query, { taskType: 'RETRIEVAL_QUERY' });
    const scored = indexData.index.map((item) => ({
        path: item.path,
        text: item.text,
        startLine: item.startLine,
        score: cosineSimilarity(queryEmb, item.embedding)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
}

module.exports = {
    INDEX_FILENAME,
    embedText,
    chunkFile,
    buildIndex,
    saveIndex,
    loadIndex,
    search,
    cosineSimilarity
};
