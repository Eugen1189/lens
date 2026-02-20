/**
 * Engine registry: maps tasks to Gemini models (hybrid Flash / Pro / Embedding).
 * - Flash: full-repo scan, dead code, docs, quick fixes (1M context).
 * - Pro: complex refactoring, DB design, architecture.
 * - Embedding: vectorize code for semantic search (Atlas).
 */

const DEFAULT_ENGINES = {
    flash: process.env.GEMINI_MODEL_FLASH || 'gemini-3-flash-preview',      // Gemini 3 Flash: fast, 1M context, cost-efficient
    pro: process.env.GEMINI_MODEL_PRO || 'gemini-3-pro-preview',            // Gemini 3 Pro: flagship reasoning, architecture
    embedding: process.env.GEMINI_MODEL_EMBEDDING || 'gemini-embedding-001' // Gemini Embedding: semantic search
};

const TASK_TO_ENGINE = {
    audit: 'flash',           // Full repo scan, dead code, docs
    refactor: 'flash',        // Quick refactors, code gen
    design: 'pro',            // Architecture, DB design, complex refactor
    generate: 'flash',       // Code generation (create-api, etc.)
    embed: 'embedding'       // Semantic index (SemanticIndexer)
};

/**
 * Returns the model name for a given task.
 * @param {string} task - One of: audit, refactor, design, generate, embed
 * @param {{ flash?: string, pro?: string, embedding?: string }} [overrides] - Model overrides (e.g. from .legacylens.json)
 * @returns {string} Model name (e.g. gemini-3-flash-preview)
 */
function getModelForTask(task, overrides = {}) {
    const engine = TASK_TO_ENGINE[task] || 'flash';
    const models = { ...DEFAULT_ENGINES, ...overrides };
    return models[engine] || DEFAULT_ENGINES.flash;
}

/**
 * Returns the embedding model name (for SemanticIndexer).
 * @param {{ embedding?: string }} [overrides]
 * @returns {string}
 */
function getEmbeddingModel(overrides = {}) {
    const models = { ...DEFAULT_ENGINES, ...overrides };
    return models.embedding || DEFAULT_ENGINES.embedding;
}

module.exports = {
    DEFAULT_ENGINES,
    TASK_TO_ENGINE,
    getModelForTask,
    getEmbeddingModel
};
