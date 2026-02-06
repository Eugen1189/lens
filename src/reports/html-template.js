// HTML template module
const { marked } = require('marked');
const { extractJsonFromResponse } = require('../core/ai-client');

function formatAsHTML(content, metadata = {}, jsonAnalysis = null) {
    // Use provided JSON analysis (from Schema Response) or extract from content
    const jsonData = jsonAnalysis || extractJsonFromResponse(content);
    
    // Remove JSON block from content
    const cleanContent = content.replace(/```json\s*[\s\S]*?\s*```/g, '').trim();
    
    // Convert Markdown to HTML using marked library (professional parser)
    const htmlContent = marked.parse(cleanContent);

    // Normalize data structure (support both old and new schema)
    const complexityScore = jsonData.complexityScore !== undefined ? jsonData.complexityScore : 
                           (jsonData.tech_debt_score !== undefined ? jsonData.tech_debt_score : 
                           (jsonData.risk_score !== undefined ? 100 - jsonData.risk_score : 50));
    
    // Calculate health score (inverse of complexity: 0 = perfect, 100 = chaos)
    const healthScore = 100 - complexityScore;
    
    // Determine status color and text
    let statusColor = '#10b981'; // Green
    let statusText = 'Low Risk';
    if (healthScore < 50) {
        statusColor = '#ef4444'; // Red
        statusText = 'Critical Risk';
    } else if (healthScore < 80) {
        statusColor = '#f59e0b'; // Amber
        statusText = 'Medium Risk';
    }

    // Support both new (Deep Audit) and old schema formats
    const projectName = jsonData.projectName || jsonData.project_name || 'Unknown Project';
    const executiveSummary = jsonData.executiveSummary || (jsonData.summary ? 
        `Project has ${jsonData.summary.total_loc?.toLocaleString() || 0} lines of code. Risk level: ${jsonData.summary.risk_level || 'Unknown'}.` : 
        'No summary available.');
    
    // Convert new format to old format for HTML template compatibility
    const criticalFiles = jsonData.criticalIssues ? jsonData.criticalIssues.map(issue => ({
        file: issue.file,
        complexity: issue.severity === 'Critical' ? 90 : issue.severity === 'High' ? 70 : 50,
        issues: [issue.issue],
        risk_explanation: issue.recommendation
    })) : (jsonData.critical_files || []);
    
    const topRiskyFiles = criticalFiles.slice(0, 5).map(f => ({
        name: f.file,
        score: f.complexity || 50
    }));

    const data = {
        project_name: projectName,
        version: jsonData.version || '3.1.0',
        summary: jsonData.summary || {
            total_loc: 0,
            risk_level: complexityScore > 70 ? 'High' : complexityScore > 40 ? 'Medium' : 'Low',
            estimated_refactor_time: 'N/A'
        },
        executiveSummary: executiveSummary,
        health_score: healthScore,
        tech_debt_score: complexityScore,
        complexityScore: complexityScore,
        critical_files: criticalFiles,
        deadCode: jsonData.deadCode || [],
        criticalIssues: jsonData.criticalIssues || [],
        refactoringPlan: jsonData.refactoringPlan || [],
        dependencies: jsonData.dependencies || { nodes: [], links: [] },
        circular_dependencies: jsonData.circular_dependencies || [],
        isolated_modules: jsonData.isolated_modules || [],
        filesCount: metadata.filesCount || 0,
        // Support old format for metrics
        metrics: jsonData.metrics || {
            security: complexityScore > 70 ? 30 : complexityScore > 40 ? 50 : 70,
            reliability: 100 - complexityScore,
            maintainability: healthScore,
            testing: 50
        },
        // Support old format for languages
        languages: jsonData.languages || [
            { name: 'JavaScript', count: metadata.filesCount || 0 }
        ],
        // Support old format for top_risky_files
        top_risky_files: topRiskyFiles
    };

    // Format date
    const dateStr = metadata.date || new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    // Escape HTML content
    const escapeHtml = (text) => {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    // Generate summary text (prefer executiveSummary from new schema)
    const summaryText = data.executiveSummary || 
        (typeof data.summary === 'object' 
            ? `Project has ${data.summary.total_loc?.toLocaleString() || 0} lines of code. Risk level: ${data.summary.risk_level || 'Unknown'}. Estimated refactor time: ${data.summary.estimated_refactor_time || 'N/A'}.`
            : (data.summary || 'No summary available.'));

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LegacyLens Audit Report</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --bg-body: #f8fafc;
            --bg-card: #ffffff;
            --text-main: #0f172a;
            --text-muted: #64748b;
            --border: #e2e8f0;
            --primary: #3b82f6;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-body);
            color: var(--text-main);
            margin: 0;
            padding: 40px 20px;
            line-height: 1.6;
        }

        .container { max-width: 1000px; margin: 0 auto; }

        .header {
            display: flex; justify-content: space-between; align-items: flex-end;
            margin-bottom: 30px; border-bottom: 1px solid var(--border); padding-bottom: 20px;
        }
        .brand h1 { margin: 0; font-size: 24px; font-weight: 700; color: var(--text-main); }
        .brand span { color: var(--text-muted); font-weight: 400; font-size: 16px; }
        .meta { text-align: right; color: var(--text-muted); font-size: 14px; }

        .card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            margin-bottom: 24px;
        }
        
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; }
        .grid-2 { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 24px; }

        .kpi-box { text-align: center; }
        .kpi-label { font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .kpi-value { font-size: 36px; font-weight: 700; margin: 10px 0; color: var(--text-main); }
        .status-badge { 
            display: inline-block; padding: 4px 12px; border-radius: 20px; 
            font-size: 14px; font-weight: 600; color: #fff; background: ${statusColor}; 
        }

        h3 { margin-top: 0; font-size: 16px; font-weight: 600; color: var(--text-main); margin-bottom: 20px; }
        .chart-container { position: relative; height: 250px; width: 100%; }

        .report-content h1, .report-content h2 { border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-top: 32px; color: var(--text-main); }
        .report-content h3 { margin-top: 24px; margin-bottom: 10px; color: var(--text-main); }
        .report-content p, .report-content li { color: #334155; font-size: 15px; }
        .report-content code { background: #f1f5f9; color: #d946ef; padding: 2px 5px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 14px; }
        .report-content pre { background: #1e293b; color: #f8fafc; padding: 15px; border-radius: 6px; overflow-x: auto; }
        
        .risk-list { list-style: none; padding: 0; margin: 0; }
        .risk-item { 
            display: flex; justify-content: space-between; align-items: center; 
            padding: 10px 0; border-bottom: 1px solid var(--border); 
        }
        .risk-item:last-child { border-bottom: none; }
        .risk-name { font-weight: 500; font-size: 14px; }
        .risk-bar-bg { width: 100px; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden; }
        .risk-bar-fill { height: 100%; background: #ef4444; }

        @media (max-width: 768px) { .grid-3, .grid-2 { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        
        <div class="header">
            <div class="brand">
                <h1>LegacyLens Report</h1>
                <span>Automated Code Audit</span>
            </div>
            <div class="meta">
                Generated: ${escapeHtml(dateStr)}<br>
                Engine: Gemini 2.5 Flash
            </div>
        </div>

        <div class="grid-3">
            <div class="card kpi-box">
                <div class="kpi-label">Health Score</div>
                <div class="kpi-value" style="color: ${statusColor}">${data.health_score}%</div>
                <div class="status-badge">${statusText}</div>
            </div>
            <div class="card kpi-box">
                <div class="kpi-label">Security Rating</div>
                <div class="kpi-value">${data.metrics.security}/100</div>
                <div style="font-size: 13px; color: var(--text-muted);">Based on vulnerability scan</div>
            </div>
            <div class="card kpi-box">
                <div class="kpi-label">Files Analyzed</div>
                <div class="kpi-value">${data.filesCount || data.languages.reduce((a,b)=>a+(b.count||0),0)}</div>
                <div style="font-size: 13px; color: var(--text-muted);">Across ${data.languages.length} languages</div>
            </div>
        </div>

        <div class="card" style="background: #fff; border-left: 4px solid #3b82f6;">
            <div class="kpi-label" style="margin-bottom: 8px; color: #3b82f6;">EXECUTIVE SUMMARY</div>
            <p style="margin: 0; font-size: 16px; font-weight: 500;">${escapeHtml(summaryText)}</p>
        </div>

        <div class="grid-2">
            <div class="card">
                <h3>Quality Metrics Overview</h3>
                <div class="chart-container">
                    <canvas id="barChart"></canvas>
                </div>
            </div>
            <div class="card">
                <h3>Top Critical Files</h3>
                <ul class="risk-list">
                    ${data.top_risky_files.length > 0 ? data.top_risky_files.map(f => `
                        <li class="risk-item">
                            <span class="risk-name">${escapeHtml(f.name)}</span>
                            <div style="text-align: right;">
                                <span style="font-size: 12px; font-weight: bold; color: #ef4444;">Risk: ${f.score}</span>
                                <div class="risk-bar-bg">
                                    <div class="risk-bar-fill" style="width: ${Math.min(f.score, 100)}%"></div>
                                </div>
                            </div>
                        </li>
                    `).join('') : '<li style="padding: 10px 0; color: var(--text-muted);">No critical files detected</li>'}
                </ul>
            </div>
        </div>

        <div class="card report-content">
            ${htmlContent}
        </div>
    </div>

    <script>
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = '#64748b';
        
        new Chart(document.getElementById('barChart'), {
            type: 'bar',
            data: {
                labels: ['Security', 'Reliability', 'Maintainability', 'Testing'],
                datasets: [{
                    label: 'Score',
                    data: [
                        ${data.metrics.security}, 
                        ${data.metrics.reliability}, 
                        ${data.metrics.maintainability}, 
                        ${data.metrics.testing}
                    ],
                    backgroundColor: [
                        '${data.metrics.security > 70 ? "#10b981" : "#ef4444"}', 
                        '#3b82f6', 
                        '#6366f1', 
                        '#94a3b8'
                    ],
                    borderRadius: 4,
                    barPercentage: 0.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' } },
                    x: { grid: { display: false } }
                }
            }
        });
    </script>
</body>
</html>`;
}

module.exports = {
    formatAsHTML
};
