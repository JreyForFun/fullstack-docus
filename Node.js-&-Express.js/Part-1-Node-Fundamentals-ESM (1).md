# The Modern Node.js & Express Course (ES Modules Edition)

### Part 1: Node.js Core Fundamentals with ES Modules

> **Why this exists:** Dave Gray's course, freeCodeCamp's Node/Express curriculum, and John Smilga's `node-express-course` repo are all excellent, but they teach Node the way it was written in 2019–2021: with `require()`, `module.exports`, and `__dirname` used like it'll never change. Since Node 14+ (and especially Node 18/20/22, which is what you have installed today), **ES Modules (ESM) are the standard**, not an experimental alternate syntax. This series teaches the same skills those courses teach — but in the syntax you'll actually be writing in a real 2026 codebase, including the specific gotchas that trip people up when they try to "just switch to `import`" and things break.

---

## Table of Contents (Full Series)

- **Part 1 (this document):** Node.js Core + ES Modules
- **Part 2:** Express.js — Middleware, Routing, MVC, REST APIs
- **Part 3:** MongoDB & Mongoose — Schemas, Models, Async CRUD
- **Part 4:** Authentication — Sessions vs. JWT, Refresh Tokens, Roles/Authorization
- **Part 5:** Production Concerns — Error Handling, Validation, Testing, Deployment

### Part 1 Contents
1. What Node.js Actually Is (Browser vs. Server)
2. Installing Node & Verifying Your Setup
3. CommonJS vs. ES Modules — The Real Differences
4. Converting Your Project to ESM (`package.json` config)
5. Node Globals in an ESM World
6. Built-in Modules: `path`, `os`, `fs`
7. The Event Loop, Deeply
8. Async Patterns: Callbacks → Promises → Async/Await
9. The `EventEmitter` Class
10. Streams
11. NPM: Packages, `package-lock.json`, Nodemon, Global vs. Local
12. Building a Raw HTTP Server (No Framework)
13. HTTP Request/Response Cycle, Headers, Status Codes
14. Part 1 Recap & What's Next

---

## 1. What Node.js Actually Is

JavaScript was born in the browser in 1995. For its first ~15 years, it only ever ran inside a browser's JavaScript engine (V8 in Chrome, SpiderMonkey in Firefox, etc.), which meant it could manipulate the DOM, listen to clicks, and talk to servers — but it *had no way to read a file off a hard drive, open a server socket, or talk to a database directly*. It lived in a sandbox.

**Node.js (2009, Ryan Dahl)** took Chrome's V8 engine, ripped it out of the browser, and wrapped it with a new set of APIs suited for a server environment — file system access, networking, process control — instead of DOM/browser APIs. The language (JavaScript syntax, `Array.prototype.map`, closures, `Promise`, etc.) is identical. What changes is the **runtime environment**: the set of global objects and built-in modules available to you.

| | Browser JS | Node.js |
|---|---|---|
| Global object | `window` | `globalThis` (historically `global`) |
| Can access DOM? | Yes (`document`, `window`) | No — there is no DOM |
| Can read files? | No (sandboxed) | Yes, via `fs` module |
| Can open TCP/HTTP servers? | No | Yes, via `net`/`http` modules |
| Module system | ES Modules (`<script type="module">`) or none | CommonJS (legacy) *or* ES Modules |
| Package manager | none built-in (bundlers pull from npm) | npm (bundled with Node) |

The practical implication for you: everything you already know about JavaScript syntax, array methods, destructuring, `async/await`, closures — all of that transfers 100%. What you're learning in this series is Node's **runtime API surface** (`fs`, `path`, `http`, `process`, etc.) and its **module system**, not "a new language."

---

## 2. Installing Node & Verifying Your Setup

Since you're on a modern machine, grab the current **LTS (Long-Term Support)** release from [nodejs.org](https://nodejs.org). LTS versions are the ones battle-tested for production use; "Current" releases get new features first but change faster.

Verify your install:

```bash
node -v
npm -v
```

Node ships with npm bundled — you never install npm separately.

**The Node REPL** (Read-Eval-Print Loop) is Node's interactive shell, similar to your browser's DevTools console. Launch it by typing `node` with no arguments:

```bash
node
> const x = 5
> x * 2
10
> .exit
```

It's useful for quick one-off checks, but for anything real you'll write files and run them with `node filename.js`.

---

## 3. CommonJS vs. ES Modules — The Real Differences

This is the section every outdated tutorial skips or hand-waves. Get this right and the rest of the series is smooth; get it wrong and you'll fight cryptic errors like `ReferenceError: require is not defined in ES module scope` or `Cannot use import statement outside a module`.

### 3.1 What is CommonJS (CJS)?

CommonJS is the module system Node shipped with in 2009, **before** JavaScript itself had an official module standard. It's what almost every legacy tutorial (Dave Gray's course included) uses:

```js
// CommonJS — math.js
function add(a, b) {
  return a + b;
}
module.exports = { add };
```

```js
// CommonJS — app.js
const { add } = require('./math.js');
console.log(add(2, 3));
```

Key CJS traits:
- `require()` is **synchronous** — it blocks until the module is loaded.
- `module.exports` / `exports` for exporting.
- File extensions in `require()` are **optional** (`require('./math')` works fine).
- Every file gets its own `__dirname`, `__filename`, `module`, `require` — injected automatically by Node's module wrapper.

### 3.2 What is ESM (ECMAScript Modules)?

ESM is the **official JavaScript module standard**, added to the language spec in ES2015 (ES6) — the same `import`/`export` syntax browsers use. Node added support for it in v12+, and it's now the modern default for new projects:

```js
// ESM — math.js
export function add(a, b) {
  return a + b;
}
```

```js
// ESM — app.js
import { add } from './math.js';
console.log(add(2, 3));
```

Key ESM traits:
- `import` statements are **hoisted and asynchronous under the hood** — Node resolves the whole dependency graph before running anything.
- `export` / `export default` for exporting.
- File extensions are **required** in relative imports (`import './math.js'`, not `import './math'`). This trips up almost everyone coming from CJS tutorials.
- No `__dirname`, `__filename`, `require`, or `module` — they don't exist in ESM scope (we'll cover the replacements below).
- Supports **top-level `await`** — you can `await` directly in a module body without wrapping it in an `async function`.

### 3.3 Side-by-Side Cheat Sheet

| Task | CommonJS | ES Modules |
|---|---|---|
| Export one thing | `module.exports = add;` | `export default add;` |
| Export multiple things | `module.exports = { add, sub };` | `export { add, sub };` or `export function add(){}` |
| Import default | `const add = require('./math');` | `import add from './math.js';` |
| Import named | `const { add } = require('./math');` | `import { add } from './math.js';` |
| Import everything as namespace | `const math = require('./math');` | `import * as math from './math.js';` |
| Dynamic/conditional import | `require(condition ? './a' : './b')` (sync) | `await import(condition ? './a.js' : './b.js')` (async, returns a Promise) |
| Current directory | `__dirname` | Derived from `import.meta.url` (see 3.4) |
| Current file | `__filename` | Derived from `import.meta.url` |
| JSON import | `const data = require('./data.json');` | `import data from './data.json' with { type: 'json' };` (Node 20.10+/22+) |

### 3.4 The `__dirname` Problem (and Its Fix)

In CJS, every file automatically has `__dirname` (absolute path to the folder the file lives in) and `__filename`. In ESM, **these don't exist** — because ESM modules are conceptually loaded via URL (like in the browser), not file path.

The replacement pattern, which you'll write constantly:

```js
// ESM equivalent of __dirname / __filename
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(__dirname);  // absolute path to this file's folder
console.log(__filename); // absolute path to this file
```

`import.meta.url` is an ESM-only object that gives you the current module's URL (e.g. `file:///Users/you/project/index.js`). `fileURLToPath` converts that URL into a normal OS file path, and `dirname` (from the `path` module, covered in Section 6) strips the filename off to get just the folder.

You'll see this exact 5-line snippet at the top of *so many* real-world ESM Node files that it's worth memorizing rather than looking up every time.

### 3.5 Interop: Using CommonJS Packages from ESM

Most of the npm ecosystem has migrated to ESM or supports both ("dual packages"), but some older packages are CJS-only. Good news: **ESM can import CJS**, just not always perfectly.

```js
// If a package is CJS-only, default import usually works:
import express from 'express'; // express supports this cleanly

// For packages that only export via module.exports = {...} with named things inside,
// you sometimes need:
import pkg from 'some-old-cjs-package';
const { someNamedExport } = pkg;
```

The reverse — **CJS cannot `require()` an ESM-only package** — is a real limitation you'll hit occasionally with cutting-edge packages. If you ever see an error like `ERR_REQUIRE_ESM`, it means a package went ESM-only and you're trying to `require()` it from a CJS file. The fix is either to convert your project to ESM (this series' whole approach) or use a dynamic `await import()`.

---

## 4. Converting Your Project to ESM

There are two ways to tell Node "treat my `.js` files as ESM":

### Option A — `"type": "module"` in `package.json` (recommended, project-wide)

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js"
}
```

With this set, **every** `.js` file in your project is parsed as ESM by default. This is what you want for a real project — including any Express backend you build going forward.

If you ever need a specific file to still be CJS in a `"type": "module"` project (rare, e.g. an old config file some tool expects), name it `.cjs` instead of `.js` and Node will treat that one file as CommonJS regardless of the package.json setting.

### Option B — File extension `.mjs` (per-file, no package.json change needed)

```
node script.mjs
```

Any file ending in `.mjs` is always treated as ESM by Node, regardless of `package.json`. Any file ending in `.cjs` is always CommonJS. This is useful for quick scripts or mixed legacy codebases, but for a whole new project, Option A is cleaner — you just write normal `.js` files.

**For this entire series, assume `"type": "module"` is set and we're writing plain `.js` files with `import`/`export`.**

### 4.1 Quick Verification

```bash
mkdir esm-test && cd esm-test
npm init -y
```

Open the generated `package.json` and add `"type": "module"`. Then:

```js
// index.js
console.log(import.meta.url); // works — proves this file is running as ESM
```

```bash
node index.js
```

If you get a `file://...` URL printed, you're running ESM correctly. If you get a `ReferenceError`, double check `"type": "module"` is actually saved in `package.json`.

---

## 5. Node Globals in an ESM World

Node injects certain globals into every module. Some survive the CJS→ESM switch unchanged, some don't exist in ESM at all, and one or two behave slightly differently.

| Global | Available in CJS? | Available in ESM? | Notes |
|---|---|---|---|
| `process` | ✅ | ✅ | Unchanged — env vars, `process.argv`, `process.exit()`, etc. |
| `console` | ✅ | ✅ | Unchanged |
| `globalThis` | ✅ | ✅ | The universal "global object" reference, works in browser too |
| `global` | ✅ | ✅ (but discouraged) | Legacy alias for the global object; prefer `globalThis` |
| `__dirname` / `__filename` | ✅ | ❌ | Must derive via `import.meta.url` (Section 3.4) |
| `require()` | ✅ | ❌ | Use `import` / dynamic `import()` instead |
| `module` / `exports` | ✅ | ❌ | Use `export` / `export default` instead |
| `import.meta.url` | ❌ | ✅ | ESM-only — the URL of the current module |
| top-level `await` | ❌ | ✅ | You can `await somePromise()` directly at the top of a file, no wrapping `async function` needed |

### 5.1 `process` in Practice

```js
console.log(process.argv);       // command-line arguments
console.log(process.env.NODE_ENV); // environment variable (e.g. "development")
console.log(process.platform);   // 'darwin', 'win32', 'linux', etc.
process.exit(0);                 // exit the process manually (0 = success, non-zero = error)
```

`process.env` is how you'll read config values like database URLs and JWT secrets later in this series — always from environment variables, never hardcoded.

#### A Small CLI Project With `process.argv`

`process.argv` is an array — `process.argv[0]` is always the path to the `node` executable itself, `process.argv[1]` is the path to the script being run, and everything from index 2 onward is the actual arguments a user typed. This is worth building something real with, since "command-line tool" is a genuinely common small-project shape (linters, generators, migration runners like Part 3, Section 16's `migrate-mongo` are all CLI tools under the hood).

```js
// greet.js
const name = process.argv[2]; // process.argv[0]=node path, [1]=script path, [2]=first real argument

if (!name) {
  console.error('Usage: node greet.js <name>');
  process.exit(1);
}

console.log(`Hello, ${name}`);
```

```bash
node greet.js John
# → Hello, John
```

A slightly richer example — a two-operand calculator, which forces handling multiple arguments and basic validation:

```js
// calculator.js
const [, , a, operator, b] = process.argv; // skip argv[0] and argv[1] via empty destructuring slots

const numA = Number(a);
const numB = Number(b);

if (Number.isNaN(numA) || Number.isNaN(numB)) {
  console.error('Both operands must be numbers');
  process.exit(1);
}

const operations = {
  '+': (x, y) => x + y,
  '-': (x, y) => x - y,
  '*': (x, y) => x * y,
  '/': (x, y) => x / y,
};

const operation = operations[operator];

if (!operation) {
  console.error(`Unknown operator: ${operator}`);
  process.exit(1);
}

console.log(operation(numA, numB));
```

```bash
node calculator.js 5 + 10
# → 15
```

For anything beyond this level of simplicity — named flags (`--verbose`, `-o output.txt`), subcommands, auto-generated `--help` text — reach for a library like `commander` or `yargs` rather than hand-parsing `process.argv` further; manually handling every flag format and edge case gets tedious fast, and both libraries handle it in a few lines.

### 5.2 Top-Level Await (an ESM superpower CJS never got)

```js
// This ONLY works in an ESM file. In CJS you'd need an IIFE wrapper.
import fs from 'node:fs/promises';

const data = await fs.readFile('./notes.txt', 'utf-8');
console.log(data);
```

In CommonJS, you'd have had to do:

```js
// The old CJS workaround — an async IIFE (Immediately Invoked Function Expression)
(async () => {
  const data = await fs.readFile('./notes.txt', 'utf-8');
  console.log(data);
})();
```

ESM removes the need for that ceremony entirely at the module's top level.

### 5.3 The Last Line of Defense: `uncaughtException` and `unhandledRejection`

Part 5's graceful shutdown (Section 9.4) handles `SIGTERM`/`SIGINT` — signals *sent to* the process from outside. These two events are different: they fire *from inside* the process itself, when something goes wrong that nothing else caught.

```js
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Node's own docs are explicit on this: the process is now in an UNKNOWN state.
  // The only safe response is to log it and exit — never try to "recover" and keep serving requests.
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  process.exit(1);
});
```

`uncaughtException` fires when a **synchronous** error is thrown somewhere with no surrounding `try/catch` to catch it — code that would otherwise crash Node instantly and silently. `unhandledRejection` fires when a **Promise rejects** and nothing ever attached a `.catch()` (or an `await` inside a `try/catch`) to handle it — in older Node versions this only logged a warning, but modern Node treats it as seriously as an uncaught exception, since a silently-dropped rejection usually means a bug went completely unnoticed.

**The correct use of both handlers is to log and exit, not to keep the process running.** This surprises people expecting a "catch everything, stay alive forever" safety net — but by the time either of these fires, something happened that literally nothing in the codebase was prepared to handle. The process's internal state (open handles, in-flight operations, partially-mutated data) is no longer trustworthy. The actual fix is always to find *why* the error went uncaught in the first place — wrap the real risk in a proper `try/catch` or `.catch()` — and treat these two handlers strictly as a last-resort logger-then-crash, ideally paired with a process manager (Docker's restart policy, or a host like Render) that automatically restarts the process after this kind of exit. This is exactly why Part 5, Section 9's graceful shutdown pattern matters: a clean, fast restart is the safety net, not staying alive in a corrupted state.

---

## 6. Built-in Modules: `path`, `os`, `fs`

Node's built-ins can be imported two ways in modern Node:

```js
import path from 'path';       // works
import path from 'node:path';  // preferred — the "node:" prefix makes it unambiguous
```

The `node:` prefix explicitly tells Node (and readers of your code) "this is a built-in core module, not something from `node_modules`." It's not required, but it's the modern convention you'll see in current codebases — use it going forward.

### 6.1 `path` Module

Handles filesystem path manipulation in an OS-agnostic way (Windows uses `\`, Mac/Linux use `/` — `path` abstracts that away).

```js
import path from 'node:path';

path.join('folder', 'subfolder', 'file.txt');
// → 'folder/subfolder/file.txt' (or 'folder\subfolder\file.txt' on Windows)

path.resolve('folder', 'file.txt');
// → absolute path from current working directory, e.g. '/Users/you/project/folder/file.txt'

path.basename('/Users/you/project/index.js'); // → 'index.js'
path.dirname('/Users/you/project/index.js');  // → '/Users/you/project'
path.extname('/Users/you/project/index.js');  // → '.js'

path.parse('/Users/you/project/index.js');
// → { root: '/', dir: '/Users/you/project', base: 'index.js', ext: '.js', name: 'index' }
```

`path.join` vs `path.resolve` is a common point of confusion:
- **`join`** just concatenates segments and normalizes slashes — no guarantee of an absolute path.
- **`resolve`** builds an *absolute* path, working backward from the last argument, treating the current working directory as the implicit starting point if nothing else makes it absolute.

### 6.2 `os` Module

Gives you information about the machine Node is running on.

```js
import os from 'node:os';

os.platform();   // 'darwin', 'win32', 'linux'
os.arch();       // 'x64', 'arm64'
os.cpus();       // array of CPU core info
os.totalmem();   // total RAM in bytes
os.freemem();    // free RAM in bytes
os.homedir();    // e.g. '/Users/you'
os.uptime();     // system uptime in seconds
```

You won't use `os` constantly in everyday backend work, but it shows up in CLI tools, diagnostics, and logging setups.

### 6.3 `fs` Module — Sync vs. Async vs. Promises

This is the module you'll use constantly. Node gives you **three flavors** of every filesystem operation:

**1. Synchronous (blocks the event loop until done — avoid in servers):**

```js
import fs from 'node:fs';

const data = fs.readFileSync('./notes.txt', 'utf-8');
console.log(data);
fs.writeFileSync('./output.txt', 'Hello!');
```

**2. Async with callbacks (the old-school Node pattern — "error-first callback"):**

```js
import fs from 'node:fs';

fs.readFile('./notes.txt', 'utf-8', (err, data) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(data);
});
```

Notice the **error-first callback** convention: the first argument is always `err` (or `null` if nothing went wrong), the second is the result. This pattern predates Promises in Node and you'll still see it in some libraries.

**3. Promise-based (`fs/promises` — the modern default, pairs with `async/await`):**

```js
import fs from 'node:fs/promises';

try {
  const data = await fs.readFile('./notes.txt', 'utf-8');
  console.log(data);
  await fs.writeFile('./output.txt', 'Hello!');
} catch (err) {
  console.error(err);
}
```

**Which one should you actually use?** In a real backend (Express routes, request handlers), **always use `fs/promises` with `async/await`.** Synchronous fs calls block Node's single thread — meaning *every other request currently being handled freezes* while the file operation runs. Sync fs is only acceptable in one-off scripts, CLI tools, or startup code that runs once before the server starts accepting requests.

### 6.4 Common `fs` Operations You'll Actually Use

```js
import fs from 'node:fs/promises';

// Read
const content = await fs.readFile('./data.txt', 'utf-8');

// Write (overwrites)
await fs.writeFile('./data.txt', 'new content');

// Append
await fs.appendFile('./log.txt', 'new log line\n');

// Delete
await fs.unlink('./old-file.txt');

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
```

---

## 7. The Event Loop, Deeply

This is the single most important mental model in Node.js, and the thing every job interview will probe on.

### 7.1 The Core Idea

JavaScript is **single-threaded** — one call stack, one thing executing at a time. But Node needs to handle thousands of concurrent connections, file reads, and timers without blocking. The trick is that Node offloads slow operations (disk I/O, network requests, timers) to the **libuv** library (written in C++), which uses a thread pool and OS-level async mechanisms behind the scenes. When those operations finish, their callbacks get queued up to run on the main JS thread when it's free.

The **event loop** is the mechanism that continuously checks: "is the call stack empty? if so, is there a queued callback ready to run? if so, run it."

### 7.2 The Event Loop's Phases

Each full cycle of the event loop passes through these phases, in order:

1. **Timers** — executes callbacks scheduled by `setTimeout()` and `setInterval()` whose time has elapsed.
2. **Pending callbacks** — executes I/O callbacks deferred from the previous loop iteration.
3. **Poll** — retrieves new I/O events; executes I/O-related callbacks (file reads, network data). This is where Node spends most of its time waiting.
4. **Check** — executes `setImmediate()` callbacks.
5. **Close callbacks** — e.g. `socket.on('close', ...)`.

Interleaved *between every phase* (not a phase itself) are two special microtask queues, which always drain completely before the loop moves to the next phase:
- **`process.nextTick()` queue** — highest priority, runs before anything else, including Promises.
- **Promise microtask queue** — `.then()`/`.catch()` callbacks and resolved `async/await` continuations.

### 7.3 Why This Matters in Practice

```js
console.log('1: sync start');

setTimeout(() => console.log('2: setTimeout'), 0);

Promise.resolve().then(() => console.log('3: promise'));

process.nextTick(() => console.log('4: nextTick'));

console.log('5: sync end');

// Output order:
// 1: sync start
// 5: sync end
// 4: nextTick      <- microtask, highest priority, runs before Promises
// 3: promise       <- microtask, runs before next event loop phase
// 2: setTimeout     <- macrotask, waits for the Timers phase
```

The rule of thumb: **all synchronous code runs first**, then **all queued microtasks (`nextTick` then Promises) drain completely**, then the event loop proceeds to the next macrotask phase (timers, I/O, etc.). This is why a `setTimeout(fn, 0)` never actually runs "immediately" — it always waits for at least one full pass through synchronous code and microtasks first.

### 7.4 Blocking the Event Loop (the cardinal sin)

```js
// NEVER do this in a server — this blocks EVERY other request
function blockingSum(n) {
  let total = 0;
  for (let i = 0; i < n; i++) total += i;
  return total;
}

app.get('/bad', (req, res) => {
  const result = blockingSum(10_000_000_000); // freezes the whole server
  res.json({ result });
});
```

Because Node is single-threaded, one expensive synchronous computation in a request handler stalls *every other user's request* until it finishes — there's no "other thread" picking up the slack. This is the #1 reason to avoid `fs.readFileSync` and heavy synchronous loops inside route handlers, and it's why CPU-heavy work (image processing, big data transforms) typically gets offloaded to worker threads (covered in depth in Part 6) or a separate service entirely.

### 7.5 Cancelling Timers

Every timer function returns a handle that can cancel it before it fires — easy to forget since most examples (including this series' so far) only ever show scheduling a timer, never cancelling one:

```js
const timeoutId = setTimeout(() => console.log('This may never run'), 5000);
clearTimeout(timeoutId); // cancels it — the callback never fires

const intervalId = setInterval(() => console.log('tick'), 1000);
clearInterval(intervalId); // stops future ticks; ticks already fired aren't undone

const immediateId = setImmediate(() => console.log('This may never run either'));
clearImmediate(immediateId);
```

This matters in real code more than it looks: a component that sets up a polling `setInterval` needs to `clearInterval` it on cleanup/shutdown, or the interval keeps firing (and keeping the process alive) forever — a common source of the "why won't my Node script exit" problem, and directly relevant to Part 5, Section 9.4's graceful shutdown, where any long-lived interval needs to be cleared alongside closing the server and the database connection.

---

## 8. Async Patterns: Callbacks → Promises → Async/Await

Node's async story evolved in three generations. You need to recognize all three because you'll encounter all three in real codebases and npm packages.

### 8.1 Generation 1 — Error-First Callbacks

```js
import fs from 'node:fs';

fs.readFile('./a.txt', 'utf-8', (err, dataA) => {
  if (err) return console.error(err);
  fs.readFile('./b.txt', 'utf-8', (err, dataB) => {
    if (err) return console.error(err);
    fs.readFile('./c.txt', 'utf-8', (err, dataC) => {
      if (err) return console.error(err);
      console.log(dataA, dataB, dataC);
    });
  });
});
```

This is **"callback hell"** — nesting grows with every sequential async step, error handling repeats at every level, and control flow becomes hard to follow. This is why Promises were introduced.

### 8.2 Generation 2 — Promises

A `Promise` represents a value that will exist *eventually* — it's either `pending`, `fulfilled` (resolved with a value), or `rejected` (failed with an error).

```js
import fs from 'node:fs/promises';

fs.readFile('./a.txt', 'utf-8')
  .then((dataA) => {
    console.log(dataA);
    return fs.readFile('./b.txt', 'utf-8');
  })
  .then((dataB) => {
    console.log(dataB);
  })
  .catch((err) => console.error(err));
```

Flatter than nested callbacks, and errors propagate through a single `.catch()` — but chains of `.then()` still aren't as readable as synchronous-looking code.

### 8.3 Generation 3 — `async`/`await` (syntactic sugar over Promises)

```js
import fs from 'node:fs/promises';

async function readAllThree() {
  try {
    const dataA = await fs.readFile('./a.txt', 'utf-8');
    const dataB = await fs.readFile('./b.txt', 'utf-8');
    const dataC = await fs.readFile('./c.txt', 'utf-8');
    console.log(dataA, dataB, dataC);
  } catch (err) {
    console.error(err);
  }
}

readAllThree();
```

`async/await` doesn't replace Promises — it *is* Promises, just written to look synchronous. `await` pauses execution of the `async function` (without blocking the event loop!) until the Promise settles.

### 8.4 Running Things in Parallel: `Promise.all`

A common mistake: `await`-ing three *independent* operations sequentially when they could run concurrently.

```js
// SLOW — each read waits for the previous one to finish, even though they're unrelated
const dataA = await fs.readFile('./a.txt', 'utf-8');
const dataB = await fs.readFile('./b.txt', 'utf-8');
const dataC = await fs.readFile('./c.txt', 'utf-8');

// FAST — all three start at once, we wait for all to finish
const [dataA, dataB, dataC] = await Promise.all([
  fs.readFile('./a.txt', 'utf-8'),
  fs.readFile('./b.txt', 'utf-8'),
  fs.readFile('./c.txt', 'utf-8'),
]);
```

`Promise.all` rejects immediately if *any* of the promises reject. If you want all results regardless of individual failures, use `Promise.allSettled` instead, which always resolves with an array of `{ status: 'fulfilled', value }` or `{ status: 'rejected', reason }` objects.

---

## 9. The `EventEmitter` Class

Node's entire architecture is built on events — HTTP servers, streams, and countless core APIs all extend `EventEmitter` internally. Understanding it directly demystifies a lot of "magic" behavior elsewhere in Node.

```js
import { EventEmitter } from 'node:events';

const myEmitter = new EventEmitter();

// Register a listener
myEmitter.on('greet', (name) => {
  console.log(`Hello, ${name}!`);
});

// Fire the event
myEmitter.emit('greet', 'InnovaREV'); // → "Hello, InnovaREV!"
```

### 9.1 Key Methods

```js
myEmitter.on('event', callback);      // listen every time the event fires
myEmitter.once('event', callback);    // listen only for the FIRST occurrence
myEmitter.off('event', callback);     // remove a specific listener
myEmitter.emit('event', ...args);     // fire the event, passing args to listeners
myEmitter.listenerCount('event');     // how many listeners are registered
```

### 9.2 A Custom EventEmitter Class (a very common interview/course pattern)

```js
import { EventEmitter } from 'node:events';

class Logger extends EventEmitter {
  log(message) {
    console.log(message);
    this.emit('logged', { message, timestamp: Date.now() });
  }
}

const logger = new Logger();

logger.on('logged', (details) => {
  console.log('Log event fired at:', details.timestamp);
});

logger.log('Server started'); // triggers both console.log AND the 'logged' event
```

This pattern — extending `EventEmitter` to give a custom class its own pub/sub events — is exactly how Node's own `http.Server`, `fs.ReadStream`, and `net.Socket` are built internally.

### 9.3 Error Events Need Special Care

```js
const emitter = new EventEmitter();

// If you emit 'error' with NO listener attached, Node throws and crashes the process
emitter.emit('error', new Error('boom')); // uncaught, crashes if no 'error' listener exists

// Always attach an error listener when working with emitters that might emit 'error'
emitter.on('error', (err) => console.error('Handled:', err.message));
```

This is a special case: the `'error'` event is the one event name `EventEmitter` treats differently — if nothing is listening for it, Node throws the error and can crash your process. Always handle it.

---

## 10. Streams

Streams let you process data **in chunks** as it arrives, instead of loading an entire file/response into memory at once. Critical for large files, video, or big API responses.

### 10.1 Why Streams Matter

```js
import fs from 'node:fs/promises';

// This loads the ENTIRE file into memory before you can use it.
// Fine for a 2KB config file. Catastrophic for a 4GB video.
const data = await fs.readFile('./huge-video.mp4');
```

```js
import fs from 'node:fs';

// This reads the file in small chunks, using constant memory regardless of file size
const stream = fs.createReadStream('./huge-video.mp4');

stream.on('data', (chunk) => {
  console.log(`Received ${chunk.length} bytes`);
});

stream.on('end', () => {
  console.log('Finished reading');
});

stream.on('error', (err) => {
  console.error('Stream error:', err);
});
```

### 10.2 The Four Stream Types

| Type | Direction | Example |
|---|---|---|
| **Readable** | Data flows out | `fs.createReadStream()`, an incoming HTTP request body |
| **Writable** | Data flows in | `fs.createWriteStream()`, an outgoing HTTP response |
| **Duplex** | Both directions, independent | a TCP socket |
| **Transform** | Both directions, output derived from input | `zlib.createGzip()` (compression) |

### 10.3 Piping Streams Together

`pipe()` is how you connect a readable stream directly to a writable one — Node handles the chunk-by-chunk flow and backpressure automatically.

```js
import fs from 'node:fs';

const readStream = fs.createReadStream('./input.txt');
const writeStream = fs.createWriteStream('./output.txt');

readStream.pipe(writeStream);

writeStream.on('finish', () => console.log('Copy complete'));
```

Streams are also directly how Node's HTTP module works — an incoming `req` object is a *Readable* stream and the outgoing `res` object is a *Writable* stream (covered in depth in Section 12–13).

---

## 11. NPM: Packages, `package-lock.json`, Nodemon, Global vs. Local

### 11.1 `npm init`

```bash
npm init      # interactive, asks you questions
npm init -y   # accepts all defaults instantly
```

This creates `package.json` — your project's manifest: name, version, dependencies, scripts, and (crucially for this whole series) `"type": "module"`.

### 11.2 Installing Packages: Local vs. Global

```bash
npm install express          # local — added to THIS project's node_modules + package.json
npm install -g nodemon       # global — installed system-wide, usable as a CLI command anywhere
```

**Local** installs are the norm for anything your *code* depends on (Express, Mongoose, jsonwebtoken, etc.) — they live in `./node_modules` and are listed in `package.json`'s `"dependencies"`.

**Global** installs are for CLI *tools* you want available from any terminal, regardless of project (though modern practice increasingly favors `npx some-tool` over global installs, to avoid version drift between machines).

### 11.3 Dev Dependencies

```bash
npm install --save-dev nodemon
# or shorthand:
npm install -D nodemon
```

`devDependencies` are packages needed only during development (testing tools, nodemon, TypeScript types) — not needed to actually *run* the app in production. `npm install --production` (or `NODE_ENV=production npm install`) skips them.

### 11.4 `package-lock.json` — Why It Matters

`package.json` lists version *ranges* (e.g. `"express": "^4.19.2"` means "4.19.2 or any compatible newer 4.x version"). `package-lock.json` records the **exact** resolved version of every package (and every dependency of every dependency) that was actually installed.

This means: if you and a teammate both run `npm install` from the same `package-lock.json`, you get **byte-identical** dependency trees, even months apart, even if newer compatible versions have been published in the meantime. **Always commit `package-lock.json` to git.** Never `.gitignore` it.

### 11.5 Nodemon — Auto-Restart on File Changes

Without nodemon, you'd manually stop (`Ctrl+C`) and restart (`node index.js`) your server every single time you edit a file.

```bash
npm install -D nodemon
```

Add a script to `package.json`:

```json
{
  "scripts": {
    "dev": "nodemon index.js",
    "start": "node index.js"
  }
}
```

```bash
npm run dev
```

Nodemon watches your project files and automatically restarts the Node process whenever it detects a save. `npm run start` (using plain `node`) is what you'd use in production, where auto-restart-on-edit isn't relevant.

### 11.6 `npx` — Run a Package Without Installing It Globally

```bash
npx create-react-app my-app
```

`npx` downloads a package temporarily (or uses a local install if present) just to run its CLI once, without polluting your global installs. This is the modern preferred way to run one-off tool commands.

---

## 12. Building a Raw HTTP Server (No Framework)

Before Express, it's worth building a server with **zero dependencies** using Node's built-in `http` module — this is exactly what Express is doing under the hood, just with a lot more convenience layered on top. Understanding this makes Express feel like less of a black box.

```js
// server.js
import http from 'node:http';

const PORT = 3000;

const server = http.createServer((req, res) => {
  console.log(req.method, req.url); // e.g. "GET /about"

  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Welcome to the homepage');
  } else if (req.url === '/about' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('About page');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

```bash
node server.js
```

Notice the manual `if/else if` chain checking `req.url` and `req.method` — this is *literally what a router does*, just written by hand. When you get to Part 2 and see `app.get('/about', handler)`, you'll recognize it as syntactic sugar over exactly this pattern.

### 12.1 Serving JSON

```js
import http from 'node:http';

const server = http.createServer((req, res) => {
  if (req.url === '/api/user' && req.method === 'GET') {
    const user = { id: 1, name: 'InnovaREV' };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(user));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(3000);
```

### 12.2 Reading a Request Body (POST data)

Because `req` is a *Readable stream* (Section 10), the incoming body doesn't arrive all at once — you collect it chunk by chunk:

```js
import http from 'node:http';

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/echo') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      const parsed = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ youSent: parsed }));
    });
  }
});

server.listen(3000);
```

This is exactly the tedious, manual work that Express's `express.json()` middleware (Part 2) exists to eliminate.

---

## 13. HTTP Request/Response Cycle, Headers, Status Codes

### 13.1 The Cycle

1. Client (browser, mobile app, Postman) sends an **HTTP request**: a method (`GET`, `POST`, etc.), a URL path, headers, and optionally a body.
2. Server receives the request, does whatever processing is needed (read a DB, compute something).
3. Server sends back an **HTTP response**: a status code, headers, and optionally a body.
4. Connection closes (or stays open briefly for keep-alive/reuse).

### 13.2 Common HTTP Methods and Their Meaning

| Method | Purpose | Has a body? | Idempotent? (repeating = same result) |
|---|---|---|---|
| `GET` | Retrieve data | No | Yes |
| `POST` | Create new data | Yes | No |
| `PUT` | Replace an entire resource | Yes | Yes |
| `PATCH` | Partially update a resource | Yes | No (in practice, often treated as yes) |
| `DELETE` | Remove a resource | Sometimes | Yes |

### 13.3 Status Code Categories

| Range | Category | Common examples |
|---|---|---|
| 1xx | Informational | rarely seen directly |
| 2xx | Success | `200 OK`, `201 Created`, `204 No Content` |
| 3xx | Redirection | `301 Moved Permanently`, `304 Not Modified` |
| 4xx | Client error | `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found` |
| 5xx | Server error | `500 Internal Server Error`, `503 Service Unavailable` |

A subtlety that matters a lot in Part 4 (Auth): **`401 Unauthorized`** means "we don't know who you are / your credentials are invalid" (you need to log in), while **`403 Forbidden`** means "we know exactly who you are, and you're not allowed to do this" (a permissions/role problem). Mixing these up is one of the most common REST API mistakes.

### 13.4 Common Headers

```
Content-Type: application/json       # tells the receiver how to parse the body
Authorization: Bearer <token>        # carries credentials (critical for Part 4's JWT auth)
Content-Length: 348                  # size of the body in bytes
Cache-Control: no-cache              # caching behavior
```

---

## 14. Part 1 Recap & What's Next

You now have the pieces that every course either skips or gets wrong when they're stuck on CommonJS:

- ✅ Why Node exists and how it differs from browser JS
- ✅ ESM vs CJS, and specifically how to replace `__dirname`, `require`, and `module.exports`
- ✅ How to configure a project as `"type": "module"` and what breaks if you don't
- ✅ Node's built-in `path`, `os`, `fs` modules (sync, callback, and promise-based)
- ✅ The event loop's actual phases, why blocking it is dangerous, and how to cancel a timer with `clearTimeout`/`clearInterval`
- ✅ The full evolution from callbacks → Promises → async/await, and how to run things in parallel with `Promise.all`
- ✅ `EventEmitter`, the pattern underlying most of Node's core APIs
- ✅ Streams, and why they matter for large data
- ✅ npm mechanics: local vs global, dev dependencies, `package-lock.json`, nodemon
- ✅ A raw HTTP server built with zero dependencies — the exact thing Express abstracts
- ✅ `uncaughtException`/`unhandledRejection` as the last line of defense before a crash, and why the right response is always log-and-exit, not "catch and keep going"
- ✅ A small CLI project built directly on `process.argv` — real argument parsing, not just a `console.log`

**Part 2** picks up exactly where the raw HTTP server left off: introducing Express, why it exists (to eliminate that manual `if/else` URL-matching and body-parsing you just wrote by hand), middleware, `app.use`, routing with `express.Router()`, route params vs. query strings, and structuring a project with the MVC pattern (matching what Dave Gray's Ch. 6–9 and John Smilga's repo cover, in full ESM).

Separately, **Part 6: Node.js Internals & Systems Programming** goes deeper into the runtime itself — Worker Threads, TCP sockets, Buffers, the `crypto` and `url` modules, TLS/HTTPS, child processes, debugging tooling, and more — material that isn't required to ship the REST API Parts 2–5 build, but rounds out a genuine understanding of Node and covers common interview territory.

Let me know when you're ready for it, or if you want to sit with Part 1 first and try converting one of your own existing CJS scripts to ESM as practice.
