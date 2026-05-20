// Probe: try to require local node-pty
console.log('process versions:', process.versions);

try {
  const pty = require('node-pty');
  console.log('node-pty loaded OK keys:', Object.keys(pty));
} catch (e) {
  console.error('node-pty FAIL:', e.message);
  console.error(e.stack);
}
