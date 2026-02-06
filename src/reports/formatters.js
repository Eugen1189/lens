// Report formatters module
const { extractJsonFromResponse } = require('../core/ai-client');
const { logWarn, logDebug } = require('../utils/logger');

const VERSION = '3.1.1';

function formatAsMarkdown(content, metadata = {}, jsonAnalysis = null) {
    // Extract JSON from response (supports both old and new schema)
    let jsonData;
    
    // If jsonAnalysis is provided (from Schema Response), use it directly
    if (jsonAnalysis && typeof jsonAnalysis === 'object') {
        jsonData = jsonAnalysis;
    } else if (typeof content === 'object' && content !== null) {
        // If content is already a JSON object, use it directly
        jsonData = content;
    } else {
        // Otherwise, extract from markdown content
        jsonData = extractJsonFromResponse(content);
    }
    
    // Support both new (Deep Audit) and old schema formats
    const projectName = jsonData.projectName || jsonData.project_name || 'Unknown';
    const complexityScore = jsonData.complexityScore !== undefined ? jsonData.complexityScore : 
                          (jsonData.tech_debt_score !== undefined ? jsonData.tech_debt_score : 50);
    const executiveSummary = jsonData.executiveSummary || 
                            (jsonData.summary ? 
                                `Project has ${jsonData.summary.total_loc?.toLocaleString() || 0} lines of code. Risk level: ${jsonData.summary.risk_level || 'Unknown'}.` : 
                                'No summary available.');
    
    const date = metadata.date || new Date().toLocaleString('en-US');
    
    let md = `# 🛡️ LegacyLens Audit Report\n`;
    md += `**Date:** ${date} | **Project:** ${projectName} | **Complexity Score:** ${complexityScore}/100\n\n`;

    md += `## 1. 📢 Executive Summary\n`;
    md += `${executiveSummary}\n\n`;

    // Dead Code Section (Deep Audit Edition)
    const deadCode = jsonData.deadCode || jsonData.isolated_modules || [];
    if (deadCode.length > 0) {
        md += `## 2. 🧟 Dead Code Detection\n`;
        md += `> Remove these to instantly reduce technical debt.\n\n`;
        md += `| File | Target | Confidence | Reason |\n`;
        md += `|------|--------|------------|--------|\n`;
        deadCode.forEach(item => {
            const file = item.file || item.path || 'Unknown';
            const target = item.lineOrFunction || item.reason || 'Unknown location';
            const confidence = item.confidence || 'Medium';
            const reason = item.reason || 'No dependencies';
            md += `| \`${file}\` | \`${target}\` | **${confidence}** | ${reason} |\n`;
        });
        md += `\n`;
    } else {
        md += `## 2. 🧟 Dead Code Detection\n`;
        md += `No dead code detected.\n\n`;
    }

    // Critical Issues Section (Deep Audit Edition)
    const criticalIssues = jsonData.criticalIssues || jsonData.critical_files || [];
    if (criticalIssues.length > 0) {
        md += `## 3. 🚨 Critical Issues\n`;
        criticalIssues.forEach(issue => {
            const issueDesc = issue.issue || issue.risk_explanation || 'Issue detected';
            const file = issue.file || issue.path || 'Unknown';
            const severity = issue.severity || (issue.complexity > 70 ? 'Critical' : issue.complexity > 50 ? 'High' : 'Medium');
            const recommendation = issue.recommendation || issue.ai_fix_snippet || 'Review and fix';
            
            const icon = severity === 'Critical' ? '🔴' : (severity === 'High' ? '🟠' : '🟡');
            md += `### ${icon} ${issueDesc}\n`;
            md += `- **Location:** \`${file}\`\n`;
            md += `- **Fix:** ${recommendation}\n\n`;
        });
    } else {
        md += `## 3. 🚨 Critical Issues\n`;
        md += `No critical issues detected.\n\n`;
    }

    // Refactoring Plan Section (Deep Audit Edition - Most Important)
    const refactoringPlan = jsonData.refactoringPlan || [];
    if (refactoringPlan.length > 0) {
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

    // Legacy format support: Dependencies (if present)
    if (jsonData.dependencies && (jsonData.dependencies.nodes?.length > 0 || jsonData.dependencies.links?.length > 0)) {
        md += `## 5. 🔗 Dependencies\n\n`;
        if (jsonData.dependencies.nodes && jsonData.dependencies.nodes.length > 0) {
            md += `**Total Modules:** ${jsonData.dependencies.nodes.length}\n\n`;
        }
        if (jsonData.dependencies.links && jsonData.dependencies.links.length > 0) {
            md += `**Total Dependencies:** ${jsonData.dependencies.links.length}\n\n`;
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

function formatAsJSON(content, metadata = {}) {
    const json = {
        version: VERSION,
        timestamp: new Date().toISOString(),
        metadata: {
            model: metadata.model || null,
            filesCount: metadata.filesCount || null,
            executionTime: metadata.executionTime || null,
            contextSize: metadata.contextSize || null,
            reportSize: content.length
        },
        report: content
    };
    return JSON.stringify(json, null, 2);
}

function formatAsXML(content, metadata = {}) {
    const escapeXML = (str) => {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

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
        <![CDATA[${content}]]>
    </report>
</legacylens-report>`;

    return xml;
}

function formatAsPlainText(content, metadata = {}) {
    let text = content
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
Date: ${metadata.date || new Date().toLocaleString('uk-UA')}
Execution Time: ${metadata.executionTime || '0s'}
Context Size: ${metadata.contextSize || 0} bytes
Report Size: ${metadata.reportSize || 0} bytes
${'='.repeat(80)}

`;

    return header + text;
}

function formatAsPDF(content, metadata = {}, jsonAnalysis = null) {
    // PDF is generated via HTML
    // Use dynamic require to avoid circular dependency
    // This is loaded only when PDF format is requested
    const { formatAsHTML } = require('./html-template');
    const html = formatAsHTML(content, metadata, jsonAnalysis);
    
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

module.exports = {
    formatAsMarkdown,
    formatAsJSON,
    formatAsXML,
    formatAsPlainText,
    formatAsPDF
};
