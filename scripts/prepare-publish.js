#!/usr/bin/env node

/**
 * Скрипт для підготовки до публікації на npm
 * Перевіряє всі необхідні файли та налаштування
 */

const fs = require('fs');
const path = require('path');

const errors = [];
const warnings = [];

console.log('🔍 Перевірка готовності до публікації...\n');

// 1. Перевірка package.json
console.log('1. Перевірка package.json...');
const packagePath = path.join(__dirname, '..', 'package.json');
if (!fs.existsSync(packagePath)) {
    errors.push('package.json не знайдено!');
} else {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    
    if (!pkg.name) errors.push('package.json: відсутня назва пакету');
    if (!pkg.version) errors.push('package.json: відсутня версія');
    if (!pkg.description) warnings.push('package.json: відсутній опис');
    if (!pkg.author) warnings.push('package.json: відсутній автор');
    if (!pkg.license) warnings.push('package.json: відсутня ліцензія');
    if (!pkg.bin || !pkg.bin.legacylens) errors.push('package.json: відсутня bin команда');
    if (!pkg.repository || pkg.repository.url.includes('yourusername')) {
        warnings.push('package.json: repository URL не оновлено');
    }
    
    console.log(`   ✅ Назва: ${pkg.name}`);
    console.log(`   ✅ Версія: ${pkg.version}`);
    console.log(`   ${pkg.author ? '✅' : '⚠️ '} Автор: ${pkg.author || 'не вказано'}`);
    console.log(`   ${pkg.repository && !pkg.repository.url.includes('yourusername') ? '✅' : '⚠️ '} Repository: ${pkg.repository?.url || 'не вказано'}`);
}

// 2. Перевірка основних файлів
console.log('\n2. Перевірка основних файлів...');
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
        errors.push(`Відсутній файл: ${file}`);
    }
});

// 3. Перевірка .npmignore
console.log('\n3. Перевірка .npmignore...');
const npmignorePath = path.join(__dirname, '..', '.npmignore');
if (fs.existsSync(npmignorePath)) {
    const npmignore = fs.readFileSync(npmignorePath, 'utf-8');
    const shouldIgnore = ['__tests__', 'coverage', 'node_modules'];
    const missing = shouldIgnore.filter(item => !npmignore.includes(item));
    
    if (missing.length > 0) {
        warnings.push(`.npmignore: відсутні правила для: ${missing.join(', ')}`);
    }
    console.log('   ✅ .npmignore існує');
} else {
    warnings.push('.npmignore відсутній (буде використано .gitignore)');
}

// 4. Перевірка тестів
console.log('\n4. Перевірка тестів...');
const testDir = path.join(__dirname, '..', '__tests__');
if (fs.existsSync(testDir)) {
    const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js'));
    console.log(`   ✅ Знайдено ${testFiles.length} тестових файлів`);
} else {
    warnings.push('Директорія __tests__ не знайдена');
}

// 5. Перевірка розміру пакету
console.log('\n5. Оцінка розміру пакету...');
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

console.log(`   📦 Загальний розмір: ${(totalSize / 1024).toFixed(2)} KB`);

// Підсумок
console.log('\n' + '='.repeat(50));
if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Всі перевірки пройдено успішно!');
    console.log('\n📦 Готово до публікації:');
    console.log('   1. npm login');
    console.log('   2. npm publish');
} else {
    if (errors.length > 0) {
        console.log('❌ Критичні помилки:');
        errors.forEach(err => console.log(`   - ${err}`));
    }
    if (warnings.length > 0) {
        console.log('\n⚠️  Попередження:');
        warnings.forEach(warn => console.log(`   - ${warn}`));
    }
    if (errors.length > 0) {
        console.log('\n❌ Виправте помилки перед публікацією!');
        process.exit(1);
    }
}
console.log('='.repeat(50));
