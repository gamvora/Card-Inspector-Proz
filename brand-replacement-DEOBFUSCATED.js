'use strict';

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
