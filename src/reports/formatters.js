// Report formatters module
const { logWarn, logDebug } = require('../utils/logger');
const { VERSION } = require('../utils/constants');
const { generateMermaidDiagrams } = require('../core/context-builder');

function formatAsMarkdown(jsonData, metadata = {}) {
    // jsonData is now always a JSON object (from Schema Response)
    if (!jsonData || typeof jsonData !== 'object') {
        logWarn('⚠️  Invalid JSON data provided to formatter');
        return '# LegacyLens Report\n\nInvalid data provided.';
    }
    
    // Strict schema: only use fields from ANALYSIS_SCHEMA (no fallback to old fields)
    const { projectName, complexityScore, executiveSummary, deadCode, criticalIssues, refactoringPlan } = jsonData;
    
    // Validate required fields
    if (!projectName || complexityScore === undefined || !executiveSummary) {
        logWarn('⚠️  Missing required fields in JSON data');
        return '# LegacyLens Report\n\nInvalid data structure. Missing required fields.';
    }
    
    const date = metadata.date || new Date().toLocaleString('en-US');
    
    let md = `# 🛡️ LegacyLens Audit Report\n`;
    md += `**Version:** ${VERSION} | **Date:** ${date} | **Project:** ${projectName} | **Complexity Score:** ${complexityScore}/100\n\n`;

    md += `## 1. 📢 Executive Summary\n`;
    md += `${executiveSummary}\n\n`;

    // Dead Code Section (Deep Audit Edition) - use destructured variable
    if (deadCode && deadCode.length > 0) {
        md += `## 2. 🧟 Dead Code Detection\n`;
        md += `> Remove these to instantly reduce technical debt.\n\n`;
        md += `| File | Target | Confidence | Reason |\n`;
        md += `|------|--------|------------|--------|\n`;
        deadCode.forEach(item => {
            const file = item.file || 'Unknown';
            const target = item.lineOrFunction || 'Unknown location';
            const confidence = item.confidence || 'Medium';
            const reason = item.reason || 'No reason provided';
            md += `| \`${file}\` | \`${target}\` | **${confidence}** | ${reason} |\n`;
        });
        md += `\n`;
    } else {
        md += `## 2. 🧟 Dead Code Detection\n`;
        md += `No dead code detected.\n\n`;
    }

    // Critical Issues Section (Deep Audit Edition) - use destructured variable
    if (criticalIssues && criticalIssues.length > 0) {
        md += `## 3. 🚨 Critical Issues\n`;
        criticalIssues.forEach(issue => {
            const issueDesc = issue.issue || 'Issue detected';
            const file = issue.file || 'Unknown';
            const severity = issue.severity || 'Medium';
            const recommendation = issue.recommendation || 'Review and fix';
            
            const icon = severity === 'Critical' ? '🔴' : (severity === 'High' ? '🟠' : '🟡');
            md += `### ${icon} ${issueDesc}\n`;
            md += `- **Location:** \`${file}\`\n`;
            md += `- **Fix:** ${recommendation}\n\n`;
        });
    } else {
        md += `## 3. 🚨 Critical Issues\n`;
        md += `No critical issues detected.\n\n`;
    }

    // Refactoring Plan Section (Deep Audit Edition - Most Important) - use destructured variable
    if (refactoringPlan && refactoringPlan.length > 0) {
        md += `## 4. 🛠️ Actionable Refactoring Plan\n`;
        refactoringPlan.forEach(step => {
            md += `### Step ${step.step}: ${step.action}\n`;
            md += `*Benefit: ${step.benefit}*\n\n`;
            
            if (step.codeSnippetBefore && step.codeSnippetAfter) {
                md += `**🔻 BEFORE (Legacy):**\n\`\`\`javascript\n${step.codeSnippetBefore}\n\`\`\`\n`;
                md += `**🟢 AFTER (Modern):**\n\`\`\`javascript\n${step.codeSnippetAfter}\n\`\`\`\n`;
            }
            md += `---\n`;
        });
    } else {
        md += `## 4. 🛠️ Actionable Refactoring Plan\n`;
        md += `No specific refactoring steps identified.\n\n`;
    }

    // Project Map Visualization (Mermaid diagrams)
    if (metadata.projectMap) {
        md += `---\n\n`;
        md += `## 📊 Project Structure & Dependencies\n\n`;
        md += `Visual representation of folder structure and import/export relationships:\n\n`;
        try {
            const mermaid = generateMermaidDiagrams(metadata.projectMap, {
                maxTreeDepth: 3,
                maxGraphFiles: 50
            });
            if (mermaid) {
                md += mermaid + '\n\n';
            } else {
                md += `*No diagrams generated (project too small or no relationships found).*\n\n`;
            }
        } catch (e) {
            logDebug(`Failed to generate Mermaid diagrams: ${e.message}`);
            md += `*Diagram generation skipped due to error.*\n\n`;
        }
    }

    // Analysis Metadata
    md += `---\n\n`;
    md += `## ⚙️ Analysis Metadata\n\n`;
    md += `| Property | Value |\n`;
    md += `|----------|-------|\n`;
    md += `| Files Analyzed | ${metadata.filesCount || 'N/A'} |\n`;
    md += `| AI Model | ${metadata.model || 'N/A'} |\n`;
    md += `| Execution Time | ${metadata.executionTime || 'N/A'} |\n`;
    md += `| Analysis Date | ${metadata.date || 'N/A'} |\n`;
    md += `\n`;

    md += `\n*Generated by LegacyLens v${VERSION}*`;
    return md;
}

function formatAsJSON(jsonData, metadata = {}) {
    const json = {
        version: VERSION,
        timestamp: new Date().toISOString(),
        metadata: {
            model: metadata.model || null,
            filesCount: metadata.filesCount || null,
            executionTime: metadata.executionTime || null,
            contextSize: metadata.contextSize || null,
            reportSize: JSON.stringify(jsonData || {}).length
        },
        report: jsonData
    };
    return JSON.stringify(json, null, 2);
}

function formatAsXML(jsonData, metadata = {}) {
    const escapeXML = (str) => {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    const reportContent = escapeXML(JSON.stringify(jsonData || {}, null, 2));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<legacylens-report version="${VERSION}">
    <metadata>
        <model>${escapeXML(metadata.model || 'unknown')}</model>
        <filesCount>${metadata.filesCount || 0}</filesCount>
        <date>${escapeXML(metadata.date || new Date().toISOString())}</date>
        <executionTime>${escapeXML(metadata.executionTime || '0s')}</executionTime>
        <contextSize>${metadata.contextSize || 0}</contextSize>
        <reportSize>${metadata.reportSize || 0}</reportSize>
    </metadata>
    <report>
        <![CDATA[${reportContent}]]>
    </report>
</legacylens-report>`;

    return xml;
}

function formatAsPlainText(jsonData, metadata = {}) {
    // Convert JSON to markdown first, then to plain text
    const markdown = formatAsMarkdown(jsonData, metadata);
    let text = markdown
        .replace(/^#+\s+(.*)$/gm, '$1\n')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .replace(/^\* (.*)$/gm, '  • $1')
        .replace(/^\d+\. (.*)$/gm, '  $1')
        .replace(/\n{3,}/g, '\n\n');

    const header = `LegacyLens Report
${'='.repeat(80)}
Version: ${VERSION}
Model: ${metadata.model || 'unknown'}
Files Analyzed: ${metadata.filesCount || 0}
Date: ${metadata.date || new Date().toLocaleString('en-US')}
Execution Time: ${metadata.executionTime || '0s'}
Context Size: ${metadata.contextSize || 0} bytes
Report Size: ${metadata.reportSize || 0} bytes
${'='.repeat(80)}

`;

    return header + text;
}

function formatAsPDF(jsonData, metadata = {}) {
    // PDF is generated via HTML
    // Use dynamic require to avoid circular dependency
    // This is loaded only when PDF format is requested
    const { formatAsHTML } = require('./html-template');
    const html = formatAsHTML(jsonData, metadata);
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>LegacyLens Report - PDF Export</title>
    <style>
        @media print {
            body { margin: 0; padding: 20px; }
            @page { margin: 2cm; }
        }
    </style>
</head>
<body>
${html}
</body>
</html>`;
}

/**
 * Format output optimized for AI agents (skill-context format).
 * Returns minimal, structured JSON that other AI agents can easily consume.
 * Focuses on actionable insights without verbose formatting.
 */
function formatAsSkillContext(jsonData, metadata = {}) {
    if (!jsonData || typeof jsonData !== 'object') {
        return JSON.stringify({ error: 'Invalid data' }, null, 0);
    }
    
    const { projectName, complexityScore, executiveSummary, deadCode, criticalIssues, refactoringPlan } = jsonData;
    
    // Minimal structure optimized for AI consumption
    const skillContext = {
        // Core metadata
        project: projectName || 'unknown',
        complexity: complexityScore || 0,
        summary: executiveSummary || '',
        
        // Actionable items (arrays of minimal objects)
        deadCode: (deadCode || []).map(item => ({
            file: item.file || '',
            target: item.lineOrFunction || '',
            confidence: item.confidence || 'Medium',
            reason: item.reason || ''
        })),
        
        criticalIssues: (criticalIssues || []).map(issue => ({
            issue: issue.issue || '',
            file: issue.file || '',
            severity: issue.severity || 'Medium',
            fix: issue.recommendation || ''
        })),
        
        refactoringPlan: (refactoringPlan || []).map(step => ({
            step: step.step || 0,
            action: step.action || '',
            benefit: step.benefit || '',
            target: step.target || null,
            verification: step.verification || null,
            before: step.codeSnippetBefore || null,
            after: step.codeSnippetAfter || null
        })),
        // Refactoring Roadmap: ordered steps for agents (Cursor, Claude) — "Step 1: X. Step 2: Y. Verify: Z"
        roadmap: (refactoringPlan || []).map(step => ({
            step: step.step || 0,
            line: `Step ${step.step || 0}: ${step.action || ''}${step.target ? `. Target: ${step.target}` : ''}${step.verification ? `. Verify: ${step.verification}` : ''}`
        })),
        
        // Metadata for context
        meta: {
            model: metadata.model || null,
            filesCount: metadata.filesCount || 0,
            executionTime: metadata.executionTime || null,
            timestamp: new Date().toISOString()
        }
    };
    
    // Return compact JSON (no pretty printing to save tokens)
    return JSON.stringify(skillContext, null, 0);
}

module.exports = {
    formatAsMarkdown,
    formatAsJSON,
    formatAsXML,
    formatAsPlainText,
    formatAsPDF,
    formatAsSkillContext
};
