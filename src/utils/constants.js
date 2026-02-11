// Single Source of Truth for version and constants
const path = require('path');
const fs = require('fs');

// Read version directly from package.json
const packageJsonPath = path.join(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

module.exports = {
    VERSION: packageJson.version
    // Default settings can be moved here if needed
};
