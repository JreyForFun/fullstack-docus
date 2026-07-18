import path from 'path';

//======= PATH ========//

path.join('ging', 'peng', 'pengging');
console.log(path.join('ging', 'peng', 'pengging')) // output: gging\peng\pengging
// → 'folder/subfolder/file.txt' (or 'folder\subfolder\file.txt' on Windows)

path.resolve('ging', 'peng', 'pengging'); // output: C:\Users\ADMIN\learn_node\ging\peng\pengging
console.log(path.resolve('ging', 'peng', 'pengging'))
// → absolute path from current working directory, e.g. '/Users/you/project/folder/file.txt'

// path.join vs path.resolve is a common point of confusion:

// join just concatenates segments and normalizes slashes — no guarantee of an absolute path.
// resolve builds an absolute path, working backward from the last argument, treating the current working directory as the implicit starting point if nothing else makes it absolute.

path.basename('/Users/you/project/index.js'); // → 'index.js'
path.dirname('/Users/you/project/index.js');  // → '/Users/you/project'
path.extname('/Users/you/project/index.js');  // → '.js'

path.parse('/Users/you/project/index.js');
// → { root: '/', dir: '/Users/you/project', base: 'index.js', ext: '.js', name: 'index' }

//======== path =======//


/// ======= OS ======= ///

import os from 'os';

os.platform();   // 'darwin', 'win32', 'linux'
os.arch();       // 'x64', 'arm64'
os.cpus();       // array of CPU core info
os.totalmem();   // total RAM in bytes
os.freemem();    // free RAM in bytes
os.homedir();    // e.g. '/Users/you'
os.uptime();     // system uptime in seconds

/// ======= os ======= ///

//// ================== F S ================= ////

import fs from 'fs/promises';

// 1. Synchronous (blocks the event loop until done — avoid in servers):

const data = fs.readFileSync('./notes.txt', 'utf-8');
console.log(data);
fs.writeFileSync('./output.txt', 'Hello!');

// 2. Async with callbacks (the old-school Node pattern — "error-first callback"):

import fs from 'node:fs';

fs.readFile('./notes.txt', 'utf-8', (err, data) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(data);
});

// 3. Promise-based (fs/promises — the modern default, pairs with async/await):

try {
    const data = await fs.readFile('./notes.txt', 'utf-8');
    console.log(data);
    await fs.writeFile('./output.txt', 'Hello!');
  } catch (err) {
    console.error(err);
  }


// ===============

// READ
const read = await fs.readFile('./data.txt', 'utf-8');

// WRITE ((OVERWRITE))
await fs.writeLine('./data.txt', 'new content');

// APPEND
await fs.appendFile('./data.txt', 'new log line\n')

// DELETE 
await fs.unlink('./data.txt')

// Check existence (there's no fs.exists — use a try/catch with stat instead)
try {
    await fs.access('./maybe-here.txt');
    console.log('exists');
  } catch {
    console.log('does not exist');
  }
  
  // Read a directory's contents
  const files = await fs.readdir('./some-folder');
  
  // Create a directory (recursive: true means "make parent dirs if needed, don't error if it exists")
  await fs.mkdir('./nested/folder', { recursive: true });
  
  // Rename / move a file
  await fs.rename('./old-name.txt', './new-name.txt');


//// ================== f s ================= ////
