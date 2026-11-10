import { readFile, writeFile, access } from 'node:fs/promises';
const template = await readFile('index.html', 'utf8');
await access('dist/app.js');
await access('dist/style.css');
await writeFile('dist/index.html', template
  .replace('  <script type="module" src="/src/main.ts"></script>', '  <script src="./app.js"></script>')
  .replace('</head>', '  <link rel="stylesheet" href="./style.css">\n</head>'));
