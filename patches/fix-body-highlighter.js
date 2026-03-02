/**
 * Patches react-native-body-highlighter to fix missing React key prop warning.
 * The library's .map() returns spread arrays without a Fragment key wrapper.
 * Run via: node patches/fix-body-highlighter.js
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-body-highlighter',
  'index.tsx',
);

if (!fs.existsSync(filePath)) {
  console.log('react-native-body-highlighter not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');

const before = 'return [...commonPaths, ...leftPaths, ...rightPaths];';
const after =
  'return <React.Fragment key={bodyPart.slug}>{commonPaths}{leftPaths}{rightPaths}</React.Fragment>;';

if (content.includes(before)) {
  content = content.replace(before, after);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Patched react-native-body-highlighter: fixed missing key prop');
} else {
  console.log('react-native-body-highlighter already patched or changed');
}
