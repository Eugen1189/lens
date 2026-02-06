// Logger utility module
const fs = require('fs');

// Simple colored output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    gray: '\x1b[90m'
};

function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

let logLevel = 'info'; // 'debug', 'info', 'warn', 'error'
let logFile = null;

function log(level, message, ...args) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] < levels[logLevel]) {
        return;
    }

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message} ${args.length > 0 ? args.join(' ') : ''}`;

    if (level === 'error') {
        console.error(colorize(logMessage, 'red'));
    } else if (level === 'warn') {
        console.warn(colorize(logMessage, 'yellow'));
    } else if (level === 'debug') {
        console.log(colorize(logMessage, 'gray'));
    } else {
        console.log(logMessage);
    }

    if (logFile) {
        try {
            fs.appendFileSync(logFile, logMessage + '\n', 'utf-8');
        } catch (e) {
            // Ignore log file errors
        }
    }
}

function logInfo(message, color = 'cyan') {
    if (logLevel === 'debug' || logLevel === 'info') {
        console.log(colorize(message, color));
    }
}

function logError(message) {
    console.error(colorize(message, 'red'));
}

function logWarn(message) {
    console.warn(colorize(message, 'yellow'));
}

function logDebug(message) {
    if (logLevel === 'debug') {
        console.log(colorize(message, 'gray'));
    }
}

function setLogLevel(level) {
    logLevel = level;
}

function setLogFile(filePath) {
    logFile = filePath;
}

function updateProgress(current, total, fileName = '') {
    if (total === 0) return;
    
    const path = require('path');
    const percentage = Math.min(100, Math.floor((current / total) * 100));
    const filled = Math.floor(percentage / 5);
    const empty = 20 - filled;
    const bar = '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
    
    process.stdout.write(`\r${colorize('⏳ Scanning...', 'yellow')} ${bar} ${percentage}% ${current}/${total} ${fileName ? `(${path.basename(fileName)})` : ''}`);
    
    if (current >= total) {
        process.stdout.write('\n');
    }
}

module.exports = {
    colorize,
    log,
    logInfo,
    logError,
    logWarn,
    logDebug,
    setLogLevel,
    setLogFile,
    updateProgress
};
