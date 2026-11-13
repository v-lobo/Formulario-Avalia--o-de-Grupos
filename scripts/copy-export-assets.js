const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
for (const [source, target] of [
  ['exceljs/dist/exceljs.min.js', 'exceljs.min.js'],
  ['jspdf/dist/jspdf.umd.min.js', 'jspdf.umd.min.js'],
]) fs.copyFileSync(path.join(root, 'node_modules', source), path.join(root, 'public/js/vendor', target));
