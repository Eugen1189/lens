---
name: legacylens-get-map
description: Get architectural context and dependency graph for a codebase using LegacyLens Project Map. Use when you need to understand project structure, imports/exports, or file relationships before making changes.
---

# LegacyLens Get Map - Architectural Context Skill

Provides instant access to the complete Project Map: dependency graph, imports/exports, and file structure. This gives AI agents a precise understanding of codebase architecture without guessing.

## When to Use This Skill

Use this skill when:
- You need to understand the project structure before refactoring
- You want to see all imports/exports relationships
- You need to find where a function or class is used
- You're planning changes and need to understand dependencies
- The user asks about "project structure", "dependencies", or "how files connect"

## How to Use It

### Step 1: Determine Project Path

Identify the project root directory. This is usually:
- The current working directory (`.`)
- The directory containing `package.json`, `requirements.txt`, or similar
- The directory specified by the user

### Step 2: Execute LegacyLens Get Map

Run the command:
```bash
legacylens get-map [project_path] --compact
```

If no path is specified, it defaults to current directory.

**Output:** The command returns JSON containing:
- `tree`: Directory structure
- `files`: Array of files with:
  - `path`: Relative file path
  - `signatures`: Functions/classes defined
  - `exports`: What this file exports (named and default)
  - `imports`: What this file imports from other files
- `summary`: Text summary of the project structure

### Step 3: Parse and Use the Map

The Project Map provides:
1. **Dependency Graph**: See which files import from which files
2. **Export Inventory**: Know what each file exports
3. **Structure Overview**: Understand folder organization

**Example usage in agent context:**
```javascript
// Before making changes, check dependencies
const map = await exec('legacylens get-map . --compact');
const projectMap = JSON.parse(map);

// Find all files that import from 'utils/logger'
const dependents = projectMap.files.filter(f => 
  f.imports?.some(imp => imp.includes('utils/logger'))
);

// Check if a function is exported
const hasExport = projectMap.files.some(f => 
  f.exports?.named?.includes('myFunction')
);
```

## Integration with Other Skills

This skill works best when combined with:
- **legacylens-audit**: Use the map to understand context before auditing
- **legacylens-safe-clean**: Use the map to verify dependencies before removing code

## Notes

- The Project Map is cached (`.legacylens-map.json`) for performance
- Use `--compact` flag for machine-readable output (saves tokens)
- The map respects `.gitignore` automatically
- Works with JavaScript, TypeScript, Python, and Java projects

## Example Output Structure

```json
{
  "tree": { "name": "project", "children": [...] },
  "files": [
    {
      "path": "src/utils/logger.js",
      "signatures": ["logInfo", "logError"],
      "exports": { "named": ["logInfo", "logError"], "default": null },
      "imports": ["path", "fs"]
    }
  ],
  "summary": "Project has 42 files, 156 exports, 89 imports..."
}
```
