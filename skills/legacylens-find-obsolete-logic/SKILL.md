---
name: legacylens-find-obsolete-logic
description: Use semantic index to find functions or logic that duplicate what is already implemented in newer project libraries or standard patterns. Find "old way" code that can be replaced by the "new way."
---

# LegacyLens Find Obsolete Logic

Uses the **semantic index** (LegacyLens `index` + `find`) to discover code that does the same thing as existing, newer implementations in the project. Typical case: custom helpers that duplicate functionality now provided by a library or a shared module.

## When to Use This Skill

Use this skill when:
- User asks to "find duplicate logic" or "find code that does the same thing as X"
- Project has migrated to a new library but old patterns remain
- User wants to "replace custom X with the standard Y we already use"
- Searching for functions that overlap with newer utilities in the codebase

## How to Use It

### Step 1: Ensure Semantic Index Exists

The project must be indexed first (one-time or after big changes):

```bash
legacylens index [project_path]
```

If the user hasn't run this, run it once (requires API key). Then semantic search is available.

### Step 2: Query for "New" or "Canonical" Implementation

Find where the "new way" or shared utility lives:

```bash
legacylens find "where do we parse JSON / use JSON.parse" [project]
legacylens find "authentication middleware" [project]
legacylens find "logging utility" [project]
```

Note the file(s) that represent the **canonical** implementation.

### Step 3: Query for Likely Obsolete Patterns

Search for patterns that might duplicate the above:

```bash
legacylens find "custom JSON parse or stringify" [project]
legacylens find "manual auth check or token validation" [project]
legacylens find "console.log or custom log" [project]
```

Compare results: files that implement similar logic but are not the canonical module are candidates for replacement.

### Step 4: Cross-Reference with Project Map

Use **legacylens get-map** or **legacylens pin-context** to see who imports the old vs new implementation:

- If only the canonical module is (or should be) imported, obsolete call sites can be refactored to use it.
- Use **legacylens affected <file>** before changing the old implementation to see dependents.

## Integration with Other Skills

- **legacylens-index** + **legacylens find**: Core of this skill; index once, then run multiple `find` queries.
- **legacylens-audit**: Audit report may already list "duplicate logic" or "could use X instead of Y"; combine with semantic find for evidence.
- **legacylens-detect-side-effects**: Before replacing obsolete logic, run **affected** on the file you're changing.
- **legacylens-safe-clean**: After replacing logic, dead code (old helper) can be removed with **auto-fix** (with dry-run first).

## Example Agent Workflow

**User**: "We now use the shared logger from utils/logger everywhere. Find any code that still uses console.log for the same purpose."

**Agent**:
1. Run: `legacylens find "console.log or debug logging" .`
2. Run: `legacylens find "import from utils/logger or logInfo" .`
3. Compare: Files that appear in (1) but not in (2) are candidates for switching to the shared logger.
4. For each candidate, run `legacylens affected <file>` if planning to change it.
5. Propose: "Replace console.log in [files] with logInfo from utils/logger."

## Notes

- **Semantic index** is meaning-based (embeddings), not exact text. Query with intent: "where do we validate user input" rather than only "validateInput".
- Index can be stale after large changes; run `legacylens index --rebuild` if needed.
- This skill does not modify code; it **finds** candidates. Use refactoring + **verify** and **safe-clean** to apply changes safely.
