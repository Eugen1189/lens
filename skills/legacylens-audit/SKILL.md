---
name: legacylens-audit
description: Perform deep legacy code audit using LegacyLens three-level analysis. Use when analyzing code quality, finding dead code, critical issues, or creating refactoring plans. This is a specialized skill for code archaeology.
---

# LegacyLens Audit - Legacy Code Analysis Skill

Performs comprehensive code analysis using a three-level architecture:
1. **Skeleton**: Fast extraction of signatures and structure
2. **Semantic Compression**: Project Map sent to AI (sees entire repo)
3. **Deep Dive**: Full content analysis for complex/suspicious files

This provides deeper analysis than generic AI agents because it sees the **complete dependency graph**, not just open files.

## When to Use This Skill

Use this skill when:
- User asks to "analyze the codebase", "find dead code", or "audit legacy code"
- User wants to understand technical debt or code quality
- User needs a refactoring plan with before/after examples
- User asks about "critical issues" or "code smells"
- Planning a major refactoring and need to understand what to change

## How to Use It

### Step 1: Determine Project Path

Identify the project root directory (usually `.` or user-specified).

### Step 2: Execute LegacyLens Audit

Run the command:
```bash
legacylens analyze [project_path] --format skill-context
```

**Flags:**
- `--format skill-context`: Returns minimal JSON optimized for AI consumption
- `--force`: Force fresh analysis (ignore cache)
- `--quiet`: Minimal output (useful for automation)

### Step 3: Parse the Results

The `skill-context` format returns:
```json
{
  "project": "project-name",
  "complexity": 75,
  "summary": "Executive summary...",
  "deadCode": [
    {
      "file": "src/utils/old.js",
      "target": "unusedFunction",
      "confidence": "High",
      "reason": "Never imported anywhere"
    }
  ],
  "criticalIssues": [
    {
      "issue": "Security vulnerability",
      "file": "src/auth.js",
      "severity": "Critical",
      "fix": "Use bcrypt instead of md5"
    }
  ],
  "refactoringPlan": [
    {
      "step": 1,
      "action": "Extract logging to utility",
      "benefit": "Reduces duplication",
      "before": "// old code...",
      "after": "// new code..."
    }
  ],
  "meta": {
    "model": "gemini-2.0-flash",
    "filesCount": 42,
    "executionTime": "12.5s"
  }
}
```

### Step 4: Present Findings to User

Structure your response:
1. **Executive Summary**: Use `summary` field
2. **Dead Code**: List items from `deadCode` array (actionable removals)
3. **Critical Issues**: Prioritize by `severity` (Critical > High > Medium)
4. **Refactoring Plan**: Present steps with `before`/`after` code snippets

## Integration with Other Skills

- **legacylens-get-map**: Use to understand structure before auditing
- **legacylens-safe-clean**: Use audit results to safely remove dead code

## Important Notes

- **Three-Level Analysis**: LegacyLens sees the entire repo structure, not just open files
- **Project Map Integration**: Uses dependency graph to find dead code accurately
- **Structured Output**: Results are guaranteed valid JSON (Schema Response mode)
- **Caching**: Results are cached; use `--force` to refresh

## Example Agent Workflow

```javascript
// 1. Get audit results
const auditResult = await exec('legacylens analyze . --format skill-context --quiet');
const audit = JSON.parse(auditResult);

// 2. Present findings
console.log(`Project: ${audit.project}`);
console.log(`Complexity: ${audit.complexity}/100`);
console.log(`\nDead Code Found: ${audit.deadCode.length} items`);
audit.deadCode.forEach(item => {
  console.log(`- ${item.file}:${item.target} (${item.confidence} confidence)`);
});

// 3. Suggest next steps
if (audit.deadCode.length > 0) {
  console.log('\n💡 Tip: Use legacylens-safe-clean to safely remove dead code');
}
```
