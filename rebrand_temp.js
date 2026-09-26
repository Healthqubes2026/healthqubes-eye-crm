const fs = require('fs');
const path = require('path');
const root = process.cwd();
const replacements = [
  ['Healthqubes', 'Healthqubes'],
  ['healthqubes', 'healthqubes'],
  ['HEALTHQUBES', 'HEALTHQUBES'],
];
const extset = new Set(['.js','.jsx','.ts','.tsx','.json','.md','.env','.html','.css','.yml','.yaml','.sh','.txt','.conf','.cfg','.xml','.ini','.lock']);
let count = 0;
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const filePath = path.join(dir, name);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (name === '.git') continue;
      walk(filePath);
    } else if (stat.isFile()) {
      if (!extset.has(path.extname(name).toLowerCase())) continue;
      let text;
      try { text = fs.readFileSync(filePath, 'utf8'); } catch (_) { continue; }
      let newText = text;
      for (const [oldVal, newVal] of replacements) {
        newText = newText.split(oldVal).join(newVal);
      }
      if (newText !== text) {
        fs.writeFileSync(filePath, newText, 'utf8');
        count += 1;
      }
    }
  }
}
walk(root);
console.log(`Updated content in ${count} files`);
const oldPath = path.join(root, 'deploy', 'nginx', 'healthqubes.conf');
const newPath = path.join(root, 'deploy', 'nginx', 'healthqubes.conf');
if (fs.existsSync(oldPath)) {
  fs.renameSync(oldPath, newPath);
  console.log(`Renamed ${oldPath} to ${newPath}`);
}
