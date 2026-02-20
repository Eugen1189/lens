---
name: legacylens-clean-house
description: Full autonomous pass through the project: audit → safe dead code removal → verify. Removes everything confirmed as safe "garbage" and then verifies the project has no broken imports.
---

# LegacyLens Clean House

Orchestrates a full cleanup cycle:

1. **Audit** – Get structured report (dead code, issues, refactoring plan).
2. **Safe removal** – Run auto-fix (with dry-run first) to remove confirmed dead code.
3. **Verify** – Re-scan Project Map and confirm 0 broken imports; report "system stable."

This is the "clean house" loop: analyze → act → verify.

## When to Use This Skill

Use this skill when:
- User asks to "clean up the project" or "remove all dead code" or "do a full cleanup"
- After a big refactor to remove leftovers
- User wants an autonomous "one-shot" cleanup with verification

## How to Use It

### Step 1: Audit

```bash
legacylens analyze [project] --format skill-context
```

Parse the result; focus on `deadCode` and (optionally) `refactoringPlan`. This is the list of candidates for removal.

### Step 2: Preview Removal (Dry-Run)

**Always** run auto-fix in dry-run first:

```bash
legacylens auto-fix [project] --dry-run
```

Review what would be removed. If the user (or agent) is unsure, present the list and ask for confirmation.

### Step 3: Execute Removal

If safe to proceed:

```bash
legacylens auto-fix [project]
```

(Use `--no-confirm` only in automated/scripted environments where AI confirmation is not desired.)

### Step 4: Verify

Re-scan the project and check that no imports are broken:

```bash
legacylens verify [project]
```

Expected output: `OK: N imports checked, 0 broken. System stable.`

If there are broken imports, report them and fix (e.g. restore a needed export or update an import path).

## Recommended Agent Workflow

1. Run **analyze** with `--format skill-context`.
2. If `deadCode` is empty, respond: "No dead code found; nothing to clean."
3. Otherwise run **auto-fix --dry-run** and show the user what will be removed.
4. Ask: "Proceed with removal? (y/n)" or, in autonomous mode, proceed.
5. Run **auto-fix** (with or without confirmation depending on context).
6. Run **verify**.
7. If **verify** fails: list broken imports and suggest fixes; do not claim "clean house complete."
8. If **verify** passes: "Clean house complete. N imports checked, 0 broken. System stable."

## Integration with Other Skills

- **legacylens-audit**: Provides the initial dead code list.
- **legacylens-safe-clean**: Same auto-fix command; clean-house is the **orchestration** (audit → fix → verify).
- **legacylens-verify**: Mandatory after any removal to confirm stability.
- **legacylens-detect-side-effects**: Optional before changing a file; use if you need to explain impact before cleanup.

## Example Session

**User**: "Do a full clean house on this repo."

**Agent**:
1. `legacylens analyze . --format skill-context` → 5 dead code items.
2. `legacylens auto-fix . --dry-run` → "Would remove 3 exports from 2 files."
3. "I'll remove those. Proceed? (y/n)" → User: y.
4. `legacylens auto-fix .`
5. `legacylens verify .` → "OK: 127 imports checked, 0 broken. System stable."
6. "Clean house complete. Removed 3 dead exports; project verified stable."

## Notes

- **Clean house** does not fix critical issues or apply refactoring steps; it focuses on **safe dead code removal** and **verification**.
- For human-in-the-loop, always show dry-run results before running auto-fix.
- If verify fails after cleanup, the last auto-fix may have removed something still referenced (e.g. dynamic import); fix the code or revert that removal and re-verify.
