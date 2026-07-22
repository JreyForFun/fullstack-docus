import { fileURLPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLPath(import.meta.url)
const __dirname = dirname(__filename)

console.log(__filename)
console.log(__dirname)

// file:///Users/innovate/projects/app/index.js   // import.meta.url
// /Users/innovate/projects/app/index.js          // __filename (recreated)
// /Users/innovate/projects/app                   // __dirname (recreated)
// in commonJS that's what it cold 

// CommonJS automatically provides these
// console.log(__dirname);   // absolute path to this file's folder
// console.log(__filename);  // absolute path to this file