#!/usr/bin/env node
/**
 * LegacyLens Setup Skills — install LegacyLens agent skills into detected IDEs.
 * Detects: Cursor, Claude Code, Antigravity.
 * Copies all legacylens-* skills and checks GEMINI_API_KEY.
 * Cross-platform (Node.js); works on Windows, macOS, Linux.
 */

const fs = require('fs');
const path = require('path');

const SKILLS_SOURCE_NAME = 'skills';
const SKILL_PREFIX = 'legacylens-';

function getSkillsSourceDir() {
    // When run as: node scripts/install-skills.js, __dirname = .../scripts
    const fromScript = path.join(__dirname, '..', SKILLS_SOURCE_NAME);
    if (fs.existsSync(fromScript)) return fromScript;
    // When required from src/cli.js, we pass baseDir or use process.cwd()
    const fromCwd = path.join(process.cwd(), SKILLS_SOURCE_NAME);
    if (fs.existsSync(fromCwd)) return fromCwd;
    return fromScript;
}

function getIDEPaths() {
    const isWin = process.platform === 'win32';
    const home = isWin ? process.env.USERPROFILE || process.env.HOMEPATH : process.env.HOME;
    const appData = process.env.APPDATA;

    const paths = [];

    // Claude Code (Anthropic) — ~/.claude/skills
    if (home) {
        paths.push({
            name: 'Claude Code',
            skillsDir: path.join(home, '.claude', 'skills')
        });
    }

    // Cursor
    if (isWin && appData) {
        paths.push({
            name: 'Cursor',
            skillsDir: path.join(appData, 'Cursor', 'User', 'skills')
        });
    } else if (home) {
        if (process.platform === 'darwin') {
            paths.push({
                name: 'Cursor',
                skillsDir: path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'skills')
            });
        } else {
            paths.push({
                name: 'Cursor',
                skillsDir: path.join(home, '.config', 'Cursor', 'User', 'skills')
            });
        }
    }

    // Antigravity — ~/.antigravity/skills
    if (home) {
        paths.push({
            name: 'Antigravity',
            skillsDir: path.join(home, '.antigravity', 'skills')
        });
    }

    return paths;
}

function copyRecursiveSync(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(item => {
            copyRecursiveSync(path.join(src, item), path.join(dest, item));
        });
    } else {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
    }
}

function installSkills(options = {}) {
    const log = options.log || ((msg) => console.log(msg));
    const logWarn = options.logWarn || ((msg) => console.warn(msg));

    const sourceDir = options.skillsSourceDir || getSkillsSourceDir();
    if (!fs.existsSync(sourceDir)) {
        logWarn('Skills source directory not found: ' + sourceDir);
        return { ok: false, reason: 'skills_source_not_found', installed: [] };
    }

    const skillDirs = fs.readdirSync(sourceDir)
        .filter(name => name.startsWith(SKILL_PREFIX) && fs.statSync(path.join(sourceDir, name)).isDirectory());
    if (skillDirs.length === 0) {
        logWarn('No skill folders found (expected legacylens-*).');
        return { ok: false, reason: 'no_skills', installed: [] };
    }

    const idePaths = getIDEPaths();
    const installed = [];

    for (const ide of idePaths) {
        const targetDir = ide.skillsDir;
        try {
            fs.mkdirSync(targetDir, { recursive: true });
        } catch (err) {
            logWarn(`Could not create ${ide.name} skills dir: ${err.message}`);
            continue;
        }
        for (const skillName of skillDirs) {
            const src = path.join(sourceDir, skillName);
            const dest = path.join(targetDir, skillName);
            try {
                copyRecursiveSync(src, dest);
                installed.push({ ide: ide.name, skill: skillName, path: dest });
            } catch (err) {
                logWarn(`Failed to copy ${skillName} to ${ide.name}: ${err.message}`);
            }
        }
        log(`  ${ide.name}: ${targetDir}`);
    }

    const hasKey = !!(process.env.GEMINI_API_KEY || process.env.LEGACYLENS_API_KEY);
    if (!hasKey) {
        logWarn('');
        logWarn('GEMINI_API_KEY is not set. Set it to use LegacyLens analyze/index/auto-fix:');
        logWarn('  Windows: $env:GEMINI_API_KEY="your_key"');
        logWarn('  Linux/macOS: export GEMINI_API_KEY="your_key"');
    }

    return {
        ok: true,
        skillsCount: skillDirs.length,
        idesDetected: idePaths.length,
        installed,
        geminiKeySet: hasKey
    };
}

if (require.main === module) {
    const log = (msg) => console.log(msg);
    const logWarn = (msg) => console.warn(msg);
    console.log('LegacyLens Setup Skills\n');
    const result = installSkills({ log, logWarn });
    if (result.installed && result.installed.length > 0) {
        console.log('\nInstalled ' + result.skillsCount + ' skills into ' + result.idesDetected + ' IDE(s).');
    }
    if (!result.geminiKeySet) {
        process.exitCode = 1;
    }
}

module.exports = { installSkills, getSkillsSourceDir, getIDEPaths };
