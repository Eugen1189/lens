#!/usr/bin/env node

/**
 * Script for preparing npm publication
 * Checks all required files and settings
 */

const fs = require('fs');
const path = require('path');

const errors = [];
const warnings = [];

console.log('🔍 Checking readiness for publication...\n');

// 1. Check package.json
console.log('1. Checking package.json...');
const packagePath = path.join(__dirname, '..', 'package.json');
if (!fs.existsSync(packagePath)) {
    errors.push('package.json not found!');
} else {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    
    if (!pkg.name) errors.push('package.json: missing package name');
    if (!pkg.version) errors.push('package.json: missing version');
    if (!pkg.description) warnings.push('package.json: missing description');
    if (!pkg.author) warnings.push('package.json: missing author');
    if (!pkg.license) warnings.push('package.json: missing license');
    if (!pkg.bin || !pkg.bin.legacylens) errors.push('package.json: missing bin command');
    // More robust repository URL validation
    const placeholderRegex = /yourusername|example\.com|github\.com\/username/i;
    const hasValidRepository = pkg.repository && 
                               pkg.repository.url && 
                               !placeholderRegex.test(pkg.repository.url) &&
                               (pkg.repository.url.startsWith('git+https://') || pkg.repository.url.startsWith('https://'));
    
    if (!hasValidRepository) {
        warnings.push('package.json: repository URL not updated or still using placeholder');
    }
    
    console.log(`   ✅ Name: ${pkg.name}`);
    console.log(`   ✅ Version: ${pkg.version}`);
    console.log(`   ${pkg.author ? '✅' : '⚠️ '} Author: ${pkg.author || 'not specified'}`);
    console.log(`   ${hasValidRepository ? '✅' : '⚠️ '} Repository: ${pkg.repository?.url || 'not specified'}`);
}

// 2. Check main files
console.log('\n2. Checking main files...');
const requiredFiles = [
    'legacylens-cli.js',
    'README.md',
    'CHANGELOG.md',
    '.npmignore'
];

requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
        console.log(`   ✅ ${file}`);
    } else {
        errors.push(`Missing file: ${file}`);
    }
});

// 3. Check .npmignore
console.log('\n3. Checking .npmignore...');
const npmignorePath = path.join(__dirname, '..', '.npmignore');
if (fs.existsSync(npmignorePath)) {
    const npmignore = fs.readFileSync(npmignorePath, 'utf-8');
    const shouldIgnore = ['__tests__', 'coverage', 'node_modules'];
    const missing = shouldIgnore.filter(item => !npmignore.includes(item));
    
    if (missing.length > 0) {
        warnings.push(`.npmignore: missing rules for: ${missing.join(', ')}`);
    }
    console.log('   ✅ .npmignore exists');
} else {
    warnings.push('.npmignore missing (will use .gitignore)');
}

// 4. Check tests
console.log('\n4. Checking tests...');
const testDir = path.join(__dirname, '..', '__tests__');
if (fs.existsSync(testDir)) {
    const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js'));
    console.log(`   ✅ Found ${testFiles.length} test files`);
} else {
    warnings.push('__tests__ directory not found');
}

// 5. Check package size
console.log('\n5. Estimating package size...');
const filesInPackage = [
    'legacylens-cli.js',
    'README.md',
    'CHANGELOG.md',
    '.legacylens.json.example'
];

let totalSize = 0;
filesInPackage.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
        console.log(`   📄 ${file}: ${(stats.size / 1024).toFixed(2)} KB`);
    }
});

console.log(`   📦 Total size: ${(totalSize / 1024).toFixed(2)} KB`);

// Summary
console.log('\n' + '='.repeat(50));
if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All checks passed successfully!');
    console.log('\n📦 Ready for publication:');
    console.log('   1. npm login');
    console.log('   2. npm publish');
} else {
    if (errors.length > 0) {
        console.log('❌ Critical errors:');
        errors.forEach(err => console.log(`   - ${err}`));
    }
    if (warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        warnings.forEach(warn => console.log(`   - ${warn}`));
    }
    if (errors.length > 0) {
        console.log('\n❌ Fix errors before publishing!');
        process.exit(1);
    }
}
console.log('='.repeat(50));
