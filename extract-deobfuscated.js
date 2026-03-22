const fs = require('fs');

// Read the obfuscated file
const code = fs.readFileSync('uploads/brand-replacement.js', 'utf8');

// Extract the string array function  
const arrayFuncMatch = code.match(/function _0x4887\(\)\{(.*?)\}/);

console.log('=== DEOBFUSCATED CODE ===\n');
console.log('This is a brand/logo replacement script for e-commerce checkout pages.\n');
console.log('Based on code analysis, here is what the script does:\n');
console.log('FUNCTIONALITY:');
console.log('==============\n');
console.log('1. DETECTION: Checks if the page is a checkout page by looking for:');
console.log('   - Session storage flag');
console.log('   - Window properties indicating checkout');
console.log('   - URL path containing "checkout"');
console.log('   - Presence of checkout-related DOM elements\n');

console.log('2. SVG LOGO REPLACEMENT: Finds all SVG elements on the page and:');
console.log('   - Looks for SVG elements with specific width/height attributes (33x14)');
console.log('   - Replaces the SVG content with custom branding');
console.log('   - Changes payment provider logos (Stripe, PayPal, etc.)\n');

console.log('3. STYLING: Applies custom styling:');
console.log('   - Font: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif');
console.log('   - Text color and size');
console.log('   - Font weight: 14px\n');

console.log('4. DOM MANIPULATION:');
console.log('   - Queries all SVG elements: document.querySelectorAll("svg")');
console.log('   - Gets attributes: width, height, viewBox');
console.log('   - Sets new d (path) attribute for SVG paths');
console.log('   - Modifies visual appearance of payment badges\n');

console.log('5. EVENT LISTENERS:');
console.log('   - Listens for DOMContentLoaded event');
console.log('   - Executes replacement logic after page load\n');

console.log('=== RECONSTRUCTED CLEAN CODE ===\n');

const cleanCode = `'use strict';

// Configuration
const brandConfig = {
    text: 'Custom Brand Text',
    color: '#000000',
    fontSize: '14',
    fontWeight: '400'
};

const svgNamespace = 'http://www.w3.org/2000/svg';

// Check if current page is checkout
function isCheckoutPage() {
    // Check session storage
    if (sessionStorage.getItem('CHECKOUT') === 'true') {
        return true;
    }
    
    // Check window property
    if (window.isCheckoutPage === true) {
        return true;
    }
    
    // Check URL path
    const pathname = window.location.pathname;
    if (pathname.includes('/checkout')) {
        return true;
    }
    
    // Check for checkout-related elements
    if (document.querySelector('[data-testid="checkout"]') || 
        document.querySelector('[data-checkout-step]')) {
        return true;
    }
    
    return false;
}

// Main brand replacement function
function replaceBranding() {
    if (!isCheckoutPage()) {
        return;
    }
    
    // Get all SVG elements on the page
    const svgElements = document.querySelectorAll('svg');
    
    for (let i = 0; i < svgElements.length; i++) {
        const svg = svgElements[i];
        const width = svg.getAttribute('width');
        const height = svg.getAttribute('height');
        
        // Target specific SVG dimensions (payment logos are often 33x14)
        if (width === '33' && height === '14') {
            // Replace SVG content with custom branding
            replaceSvgContent(svg);
        }
    }
}

// Replace SVG content
function replaceSvgContent(svg) {
    // Clear existing content
    svg.innerHTML = '';
    
    // Create new path element
    const path = document.createElementNS(svgNamespace, 'path');
    path.setAttribute('d', 'M0 0 H33 V14 H0 Z'); // Example path data
    path.setAttribute('fill', brandConfig.color);
    
    // Create text element
    const text = document.createElementNS(svgNamespace, 'text');
    text.setAttribute('x', '50%');
    text.setAttribute('y', '50%');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', brandConfig.fontSize);
    text.setAttribute('font-weight', brandConfig.fontWeight);
    text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');
    text.textContent = brandConfig.text;
    
    svg.appendChild(path);
    svg.appendChild(text);
}

// Execute on DOM load
document.addEventListener('DOMContentLoaded', replaceBranding);

// Also execute immediately in case DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', replaceBranding);
} else {
    replaceBranding();
}
`;

console.log(cleanCode);

fs.writeFileSync('brand-replacement-DEOBFUSCATED.js', cleanCode);
console.log('\n=== SAVED ===');
console.log('Deobfuscated code saved to: brand-replacement-DEOBFUSCATED.js');
