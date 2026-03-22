const fs = require('fs');
const code = fs.readFileSync('/vercel/sandbox/uploads/brand-replacement.js', 'utf8');

// Extract _0x4887
const start4887 = code.indexOf('function _0x4887()');
let bc = 0, end4887;
for(let i = start4887; i < code.length; i++) {
  if(code[i] === '{') bc++;
  if(code[i] === '}') { bc--; if(bc === 0) { end4887 = i+1; break; } }
}

// Extract _0x6b4a
const start6b4a = code.indexOf('function _0x6b4a(');
bc = 0; let end6b4a;
for(let i = start6b4a; i < code.length; i++) {
  if(code[i] === '{') bc++;
  if(code[i] === '}') { bc--; if(bc === 0) { end6b4a = i+1; break; } }
}

const func4887 = code.substring(start4887, end4887);
const func6b4a = code.substring(start6b4a, end6b4a);

// The first IIFE is the array shuffle - it needs _0x4887 and _0x6b4a
// Let's find it properly
let depth = 0;
let shuffleEnd = 0;
let inStr = false, strCh = '';
for(let i = 0; i < code.length; i++) {
  const c = code[i];
  if(inStr) { if(c === strCh && code[i-1] !== '\\') inStr = false; continue; }
  if(c === "'" || c === '"') { inStr = true; strCh = c; continue; }
  if(c === '(') depth++;
  if(c === ')') { depth--; if(depth === 0) { shuffleEnd = i+1; break; } }
}
const shuffleIIFE = code.substring(0, shuffleEnd);

// Stub out _0x3f1a3c (anti-debug/self-defending) and window
const setupCode = `
var window = {};
var setInterval = function(){};
function _0x3f1a3c(){}
${func4887}
${func6b4a}
${shuffleIIFE}
`;

try {
  eval(setupCode);
} catch(e) {
  console.error('Setup error:', e.message);
  // Try without the shuffle
  try {
    eval(`
      var window = {};
      function _0x3f1a3c(){}
      ${func4887}
      ${func6b4a}
    `);
    console.log('Loaded without shuffle, testing...');
    console.log('Test:', _0x6b4a(0x293, 'cCUz'));
  } catch(e2) {
    console.error('Fallback error:', e2.message);
  }
}

// Test the decoder
try {
  console.log('Decoder test 1:', _0x6b4a(0x293, 'cCUz'));
  console.log('Decoder test 2:', _0x6b4a(0x30e, '(COa'));
} catch(e) {
  console.error('Decoder test error:', e.message);
}
