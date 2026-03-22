const fs = require('fs');
const vm = require('vm');

// Read the obfuscated code
const obfuscatedCode = fs.readFileSync('uploads/brand-replacement.js', 'utf8');

console.log('Starting deobfuscation...\n');

// Create a sandbox to safely execute parts of the code
const sandbox = {
    window: {},
    document: {
        querySelectorAll: () => [],
        querySelector: () => null,
        addEventListener: () => {},
        createElement: () => ({ 
            setAttribute: () => {},
            getAttribute: () => null,
            appendChild: () => {},
            style: {}
        })
    },
    sessionStorage: {
        getItem: () => null,
        setItem: () => {}
    },
    console: console,
    setTimeout: () => {},
    setInterval: () => {},
    location: { pathname: '' }
};

try {
    // Execute in sandbox to extract strings
    const context = vm.createContext(sandbox);
    
    // Try to extract and log the deobfuscated functionality
    console.log('Extracting code...\n');
    
    // Pretty print with better formatting
    const formatted = obfuscatedCode
        .replace(/;/g, ';\n')
        .replace(/\{/g, '{\n')
        .replace(/\}/g, '\n}')
        .replace(/,(?![^(]*\))/g, ',\n');
    
    fs.writeFileSync('brand-replacement-formatted.js', formatted);
    console.log('Formatted code written to brand-replacement-formatted.js\n');
    
    // Try to execute and capture outputs
    vm.runInContext(obfuscatedCode, context, { timeout: 5000 });
    
} catch (e) {
    console.log('Execution error (expected):', e.message);
}

console.log('\n=== MANUAL DEOBFUSCATION ===\n');
console.log('This appears to be a brand/logo replacement script for checkout pages.');
console.log('Let me extract the key functionality...\n');

// Extract string patterns that look like actual code
const functionPattern = /function\s+(\w+)\s*\([^)]*\)\s*\{/g;
const functions = [];
let match;

while ((match = functionPattern.exec(obfuscatedCode)) !== null) {
    if (!match[1].startsWith('_0x')) {
        functions.push(match[1]);
    }
}

console.log('Non-obfuscated function names found:', functions);

// Look for clear string patterns
const stringPattern = /'([^']{10,})'/g;
const clearStrings = new Set();

while ((match = stringPattern.exec(obfuscatedCode)) !== null) {
    const str = match[1];
    if (!/^[0-9a-fx!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/i.test(str) && str.length < 50) {
        clearStrings.add(str);
    }
}

console.log('\nClear strings found:', Array.from(clearStrings).slice(0, 20));
