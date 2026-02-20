---
name: legacylens-safe-clean
description: Safely remove dead code using LegacyLens Project Map verification. Use before deleting code to ensure it's not used elsewhere. This prevents breaking changes by checking all 63+ dependencies before removal.
---

# LegacyLens Safe Clean - Safe Dead Code Removal Skill

Safely removes dead code by:
1. Using Project Map to identify unused exports/imports
2. AI confirmation to verify safety
3. Checking all dependencies before removal

**Critical**: Always use this skill before deleting code. It verifies that code is truly unused across the entire codebase, not just in open files.

## When to Use This Skill

Use this skill when:
- User asks to "remove dead code", "clean up unused code", or "delete unused functions"
- You've identified code that might be unused
- User wants to reduce technical debt safely
- Before refactoring and removing old code paths
- After running `legacylens-audit` and finding dead code items

**⚠️ Important**: Never delete code without using this skill first. Generic AI agents can't see the full dependency graph and might break things.

## How to Use It

### Step 1: Verify Dead Code

Before removing, verify it's actually dead:
```bash
legacylens get-map . --compact | grep -i "functionName"
```

Or use audit results:
```bash
legacylens analyze . --format skill-context | jq '.deadCode[]'
```

### Step 2: Run Safe Clean

Execute with dry-run first (recommended):
```bash
legacylens auto-fix [project_path] --dry-run
```

This shows what **would** be removed without actually removing it.

### Step 3: Review the Plan

The dry-run shows:
- Files that will be modified
- Exports/functions that will be removed
- Dependencies checked (all imports verified)

### Step 4: Execute Removal

If the plan looks safe:
```bash
legacylens auto-fix [project_path]
```

**Flags:**
- `--dry-run`: Preview changes without applying (always use this first!)
- `--no-confirm`: Skip AI confirmation (faster but less safe)

### Step 5: Verify Results

After removal, verify:
```bash
legacylens analyze . --format skill-context | jq '.deadCode | length'
```

Should show fewer dead code items.

## Safety Features

1. **Project Map Verification**: Checks all imports/exports across entire codebase
2. **AI Confirmation**: Uses Gemini to double-check safety
3. **Dependency Graph**: Sees relationships that generic agents miss
4. **Dry-Run Mode**: Always preview before applying

## Integration with Other Skills

**Recommended Workflow:**
1. Use `legacylens-audit` to find dead code
2. Use `legacylens-get-map` to understand structure
3. Use `legacylens-safe-clean` (with `--dry-run`) to verify removal plan
4. Execute `legacylens-safe-clean` to apply changes

## Example Agent Workflow

```javascript
// 1. Find dead code
const audit = JSON.parse(await exec('legacylens analyze . --format skill-context --quiet'));
const deadCode = audit.deadCode;

if (deadCode.length === 0) {
  console.log('No dead code found!');
  return;
}

// 2. Preview removal
console.log('Previewing removal...');
await exec('legacylens auto-fix . --dry-run');

// 3. Ask user for confirmation
const confirmed = await askUser('Proceed with removal? (y/n)');

if (confirmed === 'y') {
  // 4. Execute removal
  await exec('legacylens auto-fix .');
  console.log('✅ Dead code removed safely');
} else {
  console.log('Removal cancelled');
}
```

## Important Notes

- **Always use `--dry-run` first**: Preview changes before applying
- **Project Map Required**: This skill uses the dependency graph, not just file contents
- **Conservative Approach**: Only removes exports that are never imported
- **AI Verification**: Uses Gemini to confirm safety before removal

## What Gets Removed

Only safe removals:
- ✅ Unused exports (never imported)
- ✅ Unused imports (imported but export doesn't exist)
- ❌ NOT: Functions used internally (even if not exported)
- ❌ NOT: Code with dynamic imports (too risky)

## Error Handling

If removal fails:
- Check error message for specific file/export
- Verify Project Map is up to date: `legacylens get-map . --force`
- Review dependencies manually using `legacylens get-map`
