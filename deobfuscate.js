const fs = require('fs');
const code = fs.readFileSync('/vercel/sandbox/uploads/brand-replacement.js', 'utf8');

// Step 1: Extract and execute the _0x4887 function (string array)
const start4887 = code.indexOf('function _0x4887()');
let bc = 0, end4887;
for(let i = start4887; i < code.length; i++) {
  if(code[i] === '{') bc++;
  if(code[i] === '}') { bc--; if(bc === 0) { end4887 = i+1; break; } }
}

// Step 2: Extract the _0x6b4a function (decoder)
const start6b4a = code.indexOf('function _0x6b4a(');
bc = 0; let end6b4a;
for(let i = start6b4a; i < code.length; i++) {
  if(code[i] === '{') bc++;
  if(code[i] === '}') { bc--; if(bc === 0) { end6b4a = i+1; break; } }
}

// Step 3: Extract the first IIFE (shuffle function)
// It's the very first thing in the file
let depth = 0;
let inStr = false;
let strChar = '';
let shuffleEnd = 0;

// The pattern is (function(a,b){...}(_0x4887, number))
// We need to find the matching closing paren
for(let i = 0; i < code.length; i++) {
  const c = code[i];
  if(inStr) {
    if(c === strChar && code[i-1] !== '\\') inStr = false;
    continue;
  }
  if(c === "'" || c === '"' || c === '`') { inStr = true; strChar = c; continue; }
  if(c === '(') depth++;
  if(c === ')') { 
    depth--; 
    if(depth === 0) { shuffleEnd = i+1; break; } 
  }
}

const func4887 = code.substring(start4887, end4887);
const func6b4a = code.substring(start6b4a, end6b4a);
const shuffleIIFE = code.substring(0, shuffleEnd);

// Execute them in correct order: define _0x4887, define _0x6b4a, then run shuffle
const setupCode = `
${func4887}
${func6b4a}
${shuffleIIFE}
`;

try {
  eval(setupCode);
} catch(e) {
  console.error('Setup eval error:', e.message);
  process.exit(1);
}

// Now _0x6b4a should be available as the decoder
const decode = _0x6b4a;

// Step 4: Decode all string calls in the code
// Pattern: _0x6b4a(0xNNN, 'XXXX') or via aliases like _0x42b655, _0x149e67, etc.
// First, let's build a map of all decoded strings

// Find all calls to decoder aliases 
// The pattern is: _0xVARIABLE=_0x6b4a  (assignment of decoder to local variable)
const aliasPattern = /(_0x[0-9a-f]+)\s*=\s*_0x6b4a/g;
const aliases = new Set(['_0x6b4a']);
let match;
while((match = aliasPattern.exec(code)) !== null) {
  aliases.add(match[1]);
}
console.log('Decoder aliases found:', [...aliases]);

// Now find all calls to these aliases
const results = {};
const aliasArr = [...aliases];
const callPattern = new RegExp(
  '(' + aliasArr.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')' +
  '\\s*\\(\\s*(0x[0-9a-f]+)\\s*,\\s*[\'"]([^"\']+)[\'"]\\s*\\)',
  'g'
);

let decoded = code;
const replacements = [];
while((match = callPattern.exec(code)) !== null) {
  const fullMatch = match[0];
  const numArg = parseInt(match[2], 16);
  const strArg = match[3];
  try {
    const result = decode(numArg, strArg);
    replacements.push({ match: fullMatch, result: result, index: match.index });
  } catch(e) {
    // skip failed decodings
  }
}

console.log('Total replacements:', replacements.length);

// Apply replacements from end to start to preserve indices
replacements.sort((a, b) => b.index - a.index);
for(const r of replacements) {
  const quoted = "'" + r.result.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
  decoded = decoded.substring(0, r.index) + quoted + decoded.substring(r.index + r.match.length);
}

// Also resolve hex number expressions like (0x2670+-0xe23+-0x184c)
decoded = decoded.replace(/\b(0x[0-9a-f]+)\b/gi, (match) => {
  const val = parseInt(match, 16);
  if(isNaN(val)) return match;
  return String(val);
});

// Simplify constant arithmetic expressions like (9840+-3619+-6220)
// Simple pass: evaluate expressions with only numbers and +-*
decoded = decoded.replace(/\((-?\d+\*-?\d+(?:[+\-]\d+\*-?\d+)*(?:[+\-]-?\d+)*)\)/g, (match, expr) => {
  try { return String(eval(expr)); } catch { return match; }
});

decoded = decoded.replace(/\((-?\d+(?:\*-?\d+)?(?:[+\-]-?\d+(?:\*-?\d+)?)*)\)/g, (match, expr) => {
  try { 
    const result = eval(expr);
    if(typeof result === 'number' && Number.isInteger(result)) return String(result);
    return match;
  } catch { return match; }
});

fs.writeFileSync('/vercel/sandbox/brand-replacement-decoded.js', decoded);
console.log('Decoded file written!');

// Print first 2000 chars of decoded
console.log('\n=== DECODED PREVIEW ===');
console.log(decoded.substring(0, 3000));
