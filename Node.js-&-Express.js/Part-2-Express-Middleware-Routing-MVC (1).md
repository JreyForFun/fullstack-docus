# The Modern Node.js & Express Course (ES Modules Edition)

### Part 2: Express.js — Middleware, Routing, MVC, REST APIs

> Picking up exactly where Part 1's raw `http` server left off. Everything manual you wrote by hand there — matching `req.url`, collecting body chunks, setting headers — Express automates. This part covers Express itself, middleware (the single most important concept for understanding *how* Express works, not just how to use it), routing, and structuring a real project with the MVC pattern.

### Part 2 Contents
1. Why Express Exists
2. Installing Express & Your First App (ESM)
3. Sending Responses: `res.json`, `res.send`, `res.status`
4. Route Params vs. Query Strings
5. Middleware — The Core Concept
6. Built-in and Third-Party Middleware
7. HTTP Methods in Express (GET/POST/PUT/PATCH/DELETE)
8. `express.Router()` — Modularizing Routes
9. The MVC Pattern in an Express Project
10. Building a Full REST API (In-Memory CRUD)
11. Basic Error Handling & 404s
12. API vs. Server-Side Rendering (SSR)
13. Real Pagination for Large Collections
14. Part 2 Recap & What's Next

---

## 1. Why Express Exists

Recall the raw HTTP server from Part 1, Section 12:

```js
const server = http.createServer((req, res) => {
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Welcome');
  } else if (req.url === '/about' && req.method === 'GET') {
    // ...
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});
```

Now imagine this with 40 routes, each needing auth checks, JSON parsing, logging, and validation. The `if/else` chain becomes unmanageable fast. **Express** is a thin layer on top of Node's `http` module that gives you:

- Declarative routing (`app.get('/users/:id', handler)` instead of manual `if` chains)
- A **middleware pipeline** — composable functions that run in sequence on each request
- Convenience methods on `req`/`res` (`req.params`, `req.query`, `res.json()`, etc.)
- A massive ecosystem of plug-in middleware for auth, CORS, logging, file uploads, and more

Express doesn't replace what you learned in Part 1 — it's built on top of it. `req` and `res` in Express are still the same Node `http.IncomingMessage` and `http.ServerResponse` objects, just decorated with extra methods.

---

## 2. Installing Express & Your First App (ESM)

```bash
mkdir express-app && cd express-app
npm init -y
npm install express
```

Edit `package.json` and add `"type": "module"` (as established in Part 1 — this applies to the entire rest of this series):

```json
{
  "name": "express-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "nodemon index.js",
    "start": "node index.js"
  }
}
```

```bash
npm install -D nodemon
```

```js
// index.js
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Welcome to the homepage');
});

app.get('/about', (req, res) => {
  res.send('About page');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

```bash
npm run dev
```

Compare this to Part 1's raw version — no manual `req.url` checking, no `writeHead`, no `.end()`. `express()` is a factory function that creates an "app" object; `app.get(path, handler)` registers a route for GET requests to that path; `app.listen(port)` starts the underlying HTTP server (Express calls `http.createServer()` internally, using your `app` as the request handler).

---

## 3. Sending Responses: `res.json`, `res.send`, `res.status`

Express adds several convenience methods to the response object:

```js
app.get('/text', (req, res) => {
  res.send('Plain text or HTML string'); // auto-sets Content-Type based on content
});

app.get('/json', (req, res) => {
  res.json({ id: 1, name: 'InnovaREV' }); // auto-sets Content-Type: application/json, stringifies for you
});

app.get('/status-example', (req, res) => {
  res.status(201).json({ message: 'Created' }); // chain status code before sending
});

app.get('/error-example', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.get('/redirect-example', (req, res) => {
  res.redirect('/about'); // sends a 302 redirect by default
});
```

`res.json()` vs `res.send()`: `res.send()` is generic — it inspects what you pass it (string, Buffer, object) and sets headers accordingly. `res.json()` is explicit — always stringifies to JSON and sets `Content-Type: application/json`. **For APIs, always use `res.json()` explicitly** — it's clearer intent and avoids Express's content-type guessing.

`res.status(code)` doesn't send anything by itself — it just sets the status code on the response object and returns `res` so you can chain `.json()` or `.send()` after it. Without an explicit `.status()` call, Express defaults to `200`.

---

## 4. Route Params vs. Query Strings

Both let the client pass dynamic data via the URL, but they serve different purposes and Express exposes them differently.

### 4.1 Route Params — for identifying a specific resource

```js
// URL: /users/42
app.get('/users/:id', (req, res) => {
  console.log(req.params); // { id: '42' }
  res.json({ userId: req.params.id });
});

// Multiple params
// URL: /users/42/posts/7
app.get('/users/:userId/posts/:postId', (req, res) => {
  console.log(req.params); // { userId: '42', postId: '7' }
  res.json(req.params);
});
```

Route params are part of the URL **path** itself (`:id` is a placeholder segment). Use them when the value identifies *which* resource you're operating on — a specific user, a specific post.

**Important:** everything in `req.params` arrives as a **string**, even if it looks numeric. `req.params.id === '42'`, not `42`. If you need it as a number for comparisons or database queries, convert explicitly: `Number(req.params.id)` or `parseInt(req.params.id, 10)`.

### 4.2 Query Strings — for filtering, sorting, pagination, optional options

```js
// URL: /products?category=electronics&sort=price&page=2
app.get('/products', (req, res) => {
  console.log(req.query);
  // { category: 'electronics', sort: 'price', page: '2' }
  const { category, sort, page = 1 } = req.query;
  res.json({ category, sort, page });
});
```

Query strings live after the `?` in a URL, formatted as `key=value` pairs joined by `&`. Use them for *optional* modifiers to a request — filters, sort order, pagination — not for identifying a specific resource. Like params, all query values arrive as **strings**, and array-like query params (`?tags=a&tags=b`) get parsed into an actual array by Express automatically (`req.query.tags` → `['a', 'b']`).

### 4.3 The Rule of Thumb

| Use case | Mechanism | Example |
|---|---|---|
| "Which specific thing?" | Route param | `/users/:id` |
| "How should I filter/sort/paginate the results?" | Query string | `/users?role=admin&page=2` |

---

## 5. Middleware — The Core Concept

This is the single most important idea in Express. **Everything in Express is middleware** — even your route handlers are technically middleware functions. Understanding this fully demystifies the framework.

### 5.1 What Is Middleware?

A middleware function has this exact signature:

```js
(req, res, next) => {
  // do something with req/res
  next(); // pass control to the NEXT middleware in the chain
}
```

It receives the request, the response, and a `next` function. It can:
- Inspect or modify `req`/`res`
- End the request-response cycle (by calling `res.send()`/`res.json()`/`res.end()`)
- Call `next()` to pass control to the next middleware in line
- Call `next(error)` to skip straight to error-handling middleware

**If a middleware function doesn't call `next()` and doesn't send a response, the request hangs forever.** This is the single most common bug beginners hit with custom middleware.

### 5.2 A Minimal Custom Middleware

```js
import express from 'express';

const app = express();

// A logging middleware
const logger = (req, res, next) => {
  console.log(`${req.method} ${req.url} — ${new Date().toISOString()}`);
  next(); // MUST call this or every request hangs
};

app.use(logger); // applies to EVERY route, in the order it's registered

app.get('/', (req, res) => {
  res.send('Home');
});

app.listen(3000);
```

### 5.3 The Order of `app.use()` Matters — A Lot

Middleware runs **in the exact order it's registered**, top to bottom. This is not a stylistic preference — it fundamentally changes behavior:

```js
app.use((req, res, next) => {
  console.log('First middleware');
  next();
});

app.use((req, res, next) => {
  console.log('Second middleware');
  next();
});

app.get('/', (req, res) => {
  console.log('Route handler');
  res.send('Done');
});

// Console output for GET /:
// First middleware
// Second middleware
// Route handler
```

If you register your auth-check middleware *after* your routes, it will never run for those routes — Express has already handled and responded to the request by the time execution reaches it.

### 5.4 Middleware Scoped to Specific Routes

`app.use()` with no path applies to *every* request. You can scope middleware to a path, or to a single route:

```js
// Applies only to requests starting with /admin
app.use('/admin', (req, res, next) => {
  console.log('Admin area accessed');
  next();
});

// Applies only to this ONE route (passed as an extra argument before the handler)
app.get('/protected', authMiddleware, (req, res) => {
  res.send('You are authorized');
});

// Multiple middleware functions on a single route, run left to right
app.get('/protected', authMiddleware, roleCheckMiddleware, (req, res) => {
  res.send('You are an authorized admin');
});
```

### 5.5 Passing Data Between Middleware via `req`

A common pattern (you'll use this constantly in Part 4's auth work) is attaching data to the `req` object in one middleware so a later one can use it:

```js
const attachUser = (req, res, next) => {
  req.user = { id: 1, name: 'InnovaREV' }; // pretend this came from a decoded JWT
  next();
};

app.get('/profile', attachUser, (req, res) => {
  res.json({ message: `Hello, ${req.user.name}` }); // req.user is available here
});
```

---

## 6. Built-in and Third-Party Middleware

### 6.1 `express.json()` — Parsing JSON Request Bodies

Recall Part 1, Section 12.2, where you manually collected `req.on('data', ...)` chunks and `JSON.parse()`'d them by hand. `express.json()` does exactly that, as reusable middleware:

```js
import express from 'express';
const app = express();

app.use(express.json()); // parses incoming JSON bodies, populates req.body

app.post('/echo', (req, res) => {
  console.log(req.body); // the parsed JSON object, ready to use
  res.json({ youSent: req.body });
});
```

Without `app.use(express.json())`, `req.body` would be `undefined` for any JSON POST/PUT/PATCH request — this is the single most common "why is my req.body empty" bug.

### 6.2 `express.urlencoded()` — Parsing HTML Form Submissions

```js
app.use(express.urlencoded({ extended: true }));
```

Handles `Content-Type: application/x-www-form-urlencoded` bodies — the format traditional HTML `<form>` submissions use (as opposed to JSON, which is what fetch/Postman/frontend JS typically sends). `{ extended: true }` allows parsing of nested objects/arrays in form data (using the `qs` library under the hood); `{ extended: false }` uses the simpler built-in `querystring` module and only supports flat key-value pairs.

### 6.3 `express.static()` — Serving Static Files

```js
app.use(express.static('public'));
```

Any file inside the `public` folder becomes directly accessible via URL — e.g. `public/style.css` → `http://localhost:3000/style.css`. No route needs to be written for each file. Useful for serving a frontend build, images, or downloadable assets alongside your API.

### 6.4 CORS in Depth

**CORS (Cross-Origin Resource Sharing)** is a browser security mechanism, not an Express or Node concept — it exists entirely to protect *users*, by default blocking a page loaded from one origin from reading responses from a different origin via JavaScript (`fetch`, `XMLHttpRequest`). An **origin** is the combination of scheme + host + port — `http://localhost:5173` and `http://localhost:3000` are different origins (different ports), and so are `https://app.example.com` and `https://api.example.com` (different hosts), even though both examples might feel like "the same project" to you as the developer.

Without any CORS configuration at all, a browser-based frontend on one origin calling an Express API on a different origin gets its request blocked by the *browser itself* before your Express code even finishes responding — this is not a bug to work around with more permissive server code by accident, it's the entire point of the mechanism, and the fix is to explicitly and deliberately tell the browser which origins you trust.

```bash
npm install cors
```

#### Simple Requests vs. Preflighted Requests

Not every cross-origin request behaves the same way. A **simple request** (a plain `GET`, or a `POST` with only basic content types like `text/plain`) goes straight to your server, and the browser only decides whether to let the *frontend JavaScript read the response* based on the `Access-Control-Allow-Origin` header your server sends back.

Anything more interesting — `PUT`/`PATCH`/`DELETE`, a `POST` with `Content-Type: application/json` (which is nearly everything in this series, from Part 2 onward), or a custom header like `Authorization` — triggers a **preflight request** first. The browser automatically sends an `OPTIONS` request to the same URL *before* the real one, asking "would you allow the real request that's about to follow?" Your server has to answer that `OPTIONS` request correctly (right origin, right methods, right headers allowed) before the browser ever sends the actual `POST`/`PUT`/`DELETE`. This is entirely invisible in your route handlers — `cors()` middleware intercepts and answers `OPTIONS` requests automatically, which is exactly why installing it is so much simpler than it sounds from this description.

#### Configuring It Properly

```js
// app.js
import cors from 'cors';

app.use(cors({
  origin: process.env.CLIENT_URL, // e.g. 'https://app.example.com' — an explicit allowlist, not a wildcard
  credentials: true,              // required for cookies (Part 4's refresh token) to be sent cross-origin at all
}));
```

Two details here matter more than they look:

- **`origin: '*'` (the default with no config) cannot be combined with `credentials: true`.** Browsers actively reject this combination — if your API needs to receive cookies cross-origin (Part 4's refresh-token cookie is exactly this case), you are required to specify an explicit origin, or a function that validates the incoming origin dynamically. There's no way around this with a wildcard, by design: a server that accepts credentialed requests from literally anywhere would defeat the purpose of `httpOnly`/`sameSite` cookie protections entirely.
- **`credentials: true` here is what actually makes Part 4's cross-domain refresh cookie deployment (Part 4, Section 7.1) work at all** — without it, the browser won't attach the cookie to the request in the first place, regardless of what `sameSite` value is set. CORS and cookie configuration are two separate mechanisms that both have to be correctly set for a cross-domain authenticated request to succeed; getting one right without the other still fails.

#### Multiple Allowed Origins

A single string works for one frontend. For multiple environments (a local dev frontend and a deployed one, or multiple client apps), pass a function instead:

```js
const allowedOrigins = [process.env.CLIENT_URL, 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

The `!origin` check matters: server-to-server requests, curl, and Postman don't send an `Origin` header at all (only browsers do), so this condition allows those through while still enforcing the allowlist for actual browser requests.

### 6.5 Request Logging with `morgan`

```bash
npm install morgan
```

```js
import morgan from 'morgan';

app.use(morgan('dev')); // logs each request in a concise, color-coded format: "GET /users 200 12.3 ms"
```

`morgan` replaces the custom `logger` middleware from Section 5.2 with a battle-tested, configurable request logger — you'd typically use a real package like this instead of hand-rolling logging in a production app. (Part 5, Section 5.3 later replaces this specific package with `pino-http`, once structured JSON logging becomes the priority over human-readable console output.)

### 6.6 Middleware Execution Order Recap

A typical real app's middleware stack, in the order it should be registered:

```js
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

const app = express();

app.use(cors());               // 1. Allow cross-origin requests first
app.use(morgan('dev'));        // 2. Log the incoming request
app.use(express.json());       // 3. Parse JSON bodies before routes need req.body
app.use(express.urlencoded({ extended: true }));

// 4. Routes go here
app.get('/', (req, res) => res.send('Home'));

// 5. 404 handler (after all routes — nothing matched)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 6. Error-handling middleware (always LAST — four params signals Express this is an error handler)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});
```

### 6.7 File Uploads with `multer`

`express.json()` (Section 6.1) only parses `application/json` bodies. A file upload arrives as `multipart/form-data` — a different body format entirely, one that `express.json()` can't parse at all. **`multer`** is middleware built specifically for this format.

```bash
npm install multer
```

```js
// middleware/upload.js
import multer from 'multer';
import path from 'node:path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // folder where uploaded files get saved (create this folder in your project root)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`); // avoid overwriting files with the same name
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB cap — never trust the client to send something reasonable
});

export default upload;
```

```js
// routes/journalRoutes.js
import { Router } from 'express';
import upload from '../middleware/upload.js';
import { createJournalEntry } from '../controllers/journalController.js';

const router = Router();

// upload.single('image') expects ONE file, sent under the form field name "image"
router.post('/', upload.single('image'), createJournalEntry);

export default router;
```

```js
// controllers/journalController.js
export const createJournalEntry = (req, res) => {
  console.log(req.file);
  // { fieldname: 'image', originalname: 'nebula.jpg', filename: '1699999999-123456789.jpg', path: 'uploads/...', size: 204800, ... }
  console.log(req.body); // any OTHER form fields (title, notes) still arrive here, parsed by multer alongside the file

  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  res.status(201).json({
    title: req.body.title,
    notes: req.body.notes,
    imageUrl: imagePath, // this is exactly the field Part 3's JournalEntry schema stores
  });
};
```

`upload.single('image')` populates `req.file` with metadata about the saved upload, and — notably — also parses any accompanying plain-text form fields into `req.body`, since a `multipart/form-data` request commonly carries both a file and ordinary fields (a title, some notes) together in one submission.

**A production caveat worth naming honestly:** saving files to local disk (`multer.diskStorage`, above) works for local development, but most hosting platforms (Render, Railway, Fly.io) use **ephemeral file systems** — anything written to disk vanishes on every redeploy or restart. For a real deployed app, swap `diskStorage` for direct upload to cloud object storage (AWS S3, Cloudinary, or Cloudflare R2 are common choices), typically via `multer.memoryStorage()` feeding into that provider's SDK instead of `fs`. The `fileFilter`/`limits` config above stays identical either way — only where the final bytes land changes.

---

## 7. HTTP Methods in Express

Express exposes a method on `app` (or a `Router`, Section 8) matching each HTTP verb:

```js
app.get('/items', (req, res) => {
  res.json({ items: [] }); // Read — fetch a list or single item
});

app.post('/items', (req, res) => {
  const newItem = req.body;
  res.status(201).json({ message: 'Created', item: newItem }); // Create — 201, not 200
});

app.put('/items/:id', (req, res) => {
  const { id } = req.params;
  const replacement = req.body; // expects the FULL resource, replaces it entirely
  res.json({ message: `Item ${id} replaced`, item: replacement });
});

app.patch('/items/:id', (req, res) => {
  const { id } = req.params;
  const partialUpdate = req.body; // only the fields being changed
  res.json({ message: `Item ${id} partially updated`, updates: partialUpdate });
});

app.delete('/items/:id', (req, res) => {
  const { id } = req.params;
  res.json({ message: `Item ${id} deleted` });
});
```

A subtlety worth internalizing (from Part 1, Section 13.2): **`PUT` means "replace the whole resource"** — if you send a `PUT` with only 2 of a resource's 5 fields, a strict implementation should treat the missing 3 as absent/reset, not "leave unchanged." **`PATCH` means "update only what I sent."** In practice a lot of real-world APIs are loose about this distinction, but knowing the "correct" REST semantics matters for interviews and API design discussions.

### 7.1 Testing Non-GET Routes with Postman

Since browsers only trigger `GET` requests by typing a URL, testing `POST`/`PUT`/`PATCH`/`DELETE` routes requires a tool like **Postman** (or Thunder Client in VS Code, or `curl`). This is exactly what Dave Gray's course and freeCodeCamp's "Install Postman" section point you to — set the method, URL, and (for JSON bodies) select **Body → raw → JSON** and set the `Content-Type: application/json` header.

---

## 8. `express.Router()` — Modularizing Routes

As an app grows past a handful of routes, dumping everything into one `index.js` becomes unmanageable. `express.Router()` lets you define routes in separate files and mount them onto the main app.

### 8.1 Basic Router Setup

```js
// routes/userRoutes.js
import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Get all users' });
});

router.get('/:id', (req, res) => {
  res.json({ message: `Get user ${req.params.id}` });
});

router.post('/', (req, res) => {
  res.status(201).json({ message: 'User created', data: req.body });
});

export default router;
```

```js
// index.js
import express from 'express';
import userRoutes from './routes/userRoutes.js'; // note: .js extension required (ESM rule from Part 1!)

const app = express();
app.use(express.json());

app.use('/users', userRoutes); // mounts the router at /users

app.listen(3000);
```

With this setup:
- `router.get('/')` mounted at `/users` → responds to `GET /users`
- `router.get('/:id')` mounted at `/users` → responds to `GET /users/42`
- `router.post('/')` mounted at `/users` → responds to `POST /users`

**This is the exact pattern from freeCodeCamp's "Express Router Setup" and Dave Gray's Chapter 8** — just remember the `.js` extension on the import, which their CJS-era examples wouldn't have needed.

### 8.2 Router-Level Middleware

```js
// Applies only to routes within this router
router.use((req, res, next) => {
  console.log('Request to a /users route');
  next();
});
```

---

## 9. The MVC Pattern in an Express Project

**MVC (Model-View-Controller)** separates concerns:
- **Model** — data shape and database interaction (covered fully in Part 3 with Mongoose)
- **View** — what gets rendered/returned (for a JSON API, this is effectively just the JSON shape you send — see Section 12 on API vs SSR)
- **Controller** — the actual logic that handles a request: reads input, talks to the model, sends a response

### 9.1 Why Separate Controllers from Routes?

Without MVC, route files bloat with inline logic:

```js
// Without MVC — logic crammed directly into the route file
router.get('/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id); // business logic mixed with routing
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});
```

With MVC, the route file only wires up *which URL maps to which function* — the actual logic lives in a separate controller file:

```js
// controllers/userController.js
import { users } from '../data/users.js'; // pretend in-memory data for now (Part 3 replaces this with MongoDB)

export const getAllUsers = (req, res) => {
  res.json(users);
};

export const getUserById = (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
};

export const createUser = (req, res) => {
  const newUser = { id: users.length + 1, ...req.body };
  users.push(newUser);
  res.status(201).json(newUser);
};

export const updateUser = (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  Object.assign(user, req.body);
  res.json(user);
};

export const deleteUser = (req, res) => {
  const index = users.findIndex((u) => u.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  users.splice(index, 1);
  res.status(204).send(); // 204 No Content — successful delete, nothing to return
};
```

```js
// routes/userRoutes.js
import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/userController.js';

const router = Router();

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
```

Now the route file reads almost like documentation — you can see the entire API surface for `/users` at a glance — and all the actual logic is testable/editable independently in the controller file.

### 9.2 A Standard MVC Folder Structure

```
project-root/
├── controllers/
│   └── userController.js
├── models/
│   └── User.js          (Part 3 — Mongoose schema)
├── routes/
│   └── userRoutes.js
├── middleware/
│   └── authMiddleware.js (Part 4)
├── data/
│   └── users.js          (temporary in-memory data, pre-Part 3)
├── index.js
└── package.json
```

This is precisely the structure John Smilga's `node-express-course` repo and Dave Gray's Chapter 9 build toward — the file layout doesn't change moving into Part 3/4, you're just replacing the in-memory `data/users.js` with real Mongoose model queries, and adding an `authMiddleware.js`.

---

## 10. Building a Full REST API (In-Memory CRUD)

Putting it all together — a complete, runnable REST API for a "users" resource, in-memory (no database yet — that's Part 3), fully in ESM, following MVC.

```js
// data/users.js
export const users = [
  { id: 1, name: 'Ada Lovelace', role: 'admin' },
  { id: 2, name: 'Alan Turing', role: 'user' },
];
```

```js
// controllers/userController.js
import { users } from '../data/users.js';

export const getAllUsers = (req, res) => {
  res.json(users);
};

export const getUserById = (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
};

export const createUser = (req, res) => {
  const { name, role } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const newUser = { id: users.length + 1, name, role: role || 'user' };
  users.push(newUser);
  res.status(201).json(newUser);
};

export const updateUser = (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  Object.assign(user, req.body);
  res.json(user);
};

export const deleteUser = (req, res) => {
  const index = users.findIndex((u) => u.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'User not found' });
  const [deleted] = users.splice(index, 1);
  res.status(200).json({ message: 'Deleted', user: deleted });
};
```

```js
// routes/userRoutes.js
import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/userController.js';

const router = Router();

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
```

```js
// index.js
import express from 'express';
import userRoutes from './routes/userRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/users', userRoutes);

// 404 catch-all — must come after all real routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

Test it with Postman:
- `GET http://localhost:3000/api/users` → list all
- `GET http://localhost:3000/api/users/1` → get one
- `POST http://localhost:3000/api/users` with JSON body `{ "name": "Grace Hopper", "role": "admin" }` → create
- `PUT http://localhost:3000/api/users/1` with a JSON body → update
- `DELETE http://localhost:3000/api/users/1` → delete

---

## 11. Basic Error Handling & 404s

### 11.1 The 404 Catch-All

Express doesn't know a route "doesn't exist" — it just runs through registered middleware/routes in order, and if nothing matched *and nothing sent a response*, the request hangs. The fix: a catch-all middleware registered **after** every real route:

```js
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});
```

### 11.2 Error-Handling Middleware (4 Parameters = Special Meaning to Express)

```js
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error',
  });
});
```

Express identifies error-handling middleware **specifically by its 4-parameter signature** — `(err, req, res, next)` — as opposed to normal middleware's 3 parameters. It must be registered **last**, after all routes and other middleware.

To actually route an error into this handler, call `next(err)` instead of throwing directly inside an async handler (throwing inside a plain `async` route handler in Express 4.x does **not** automatically get caught — this is a well-known gotcha, fully addressed with a proper solution in Part 5):

```js
app.get('/risky', (req, res, next) => {
  try {
    throw new Error('Something broke');
  } catch (err) {
    next(err); // hands off to the error-handling middleware above
  }
});
```

*(Part 5 covers this properly with a wrapper utility so you're not writing try/catch in every single controller function — this section is just enough to understand the mechanism.)*

---

## 12. API vs. Server-Side Rendering (SSR)

freeCodeCamp's curriculum draws this distinction explicitly, and it matters for understanding *why* your Express app returns JSON instead of HTML.

- **SSR (Server-Side Rendering):** the server generates full HTML pages (often using a templating engine like EJS, Pug, or Handlebars) and sends complete, ready-to-display HTML to the browser. Traditional pre-React web development worked this way.
- **API (what this entire series builds toward):** the server sends raw **data** (JSON) with no presentation logic. A separate frontend (a React, Vue, or mobile app) is responsible for turning that data into UI.

Since a MERN-style app pairs a React frontend with an Express backend, that backend is — and should stay — a **pure API**. You won't be reaching for `res.render()` or a templating engine anywhere in this series; every response is `res.json()`.

---

## 13. Real Pagination for Large Collections

Section 4 covered query strings for filtering/sorting, but the CRUD example in Section 10 (and Part 3's Mongoose rewrite of it) returns **every single document** from a plain `.find()` — fine with 2 test users, unworkable once a collection holds thousands of records: slow queries, huge payloads, and a frontend trying to render an unbounded list. Real APIs paginate.

### 13.1 Offset-Based Pagination (`page` + `limit`)

The standard approach: the client requests a page number and a page size via query params (Section 4.2), and the server translates that into a `skip`/`limit` on the query.

```js
// GET /api/users?page=2&limit=10
app.get('/users', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20); // cap the max page size — never trust the client to be reasonable
  const skip = (page - 1) * limit;

  // In Part 3's Mongoose version this becomes:
  // const users = await User.find().skip(skip).limit(limit);
  res.json({ page, limit, skip }); // placeholder until Part 3 wires this to a real query
});
```

`skip` tells the database how many matching documents to bypass before returning results; `limit` caps how many it returns after that. Capping `limit` server-side (here, at 100) matters — without it, a client requesting `?limit=999999999` could force a single query to load your entire collection into memory, defeating the whole purpose of paginating.

### 13.2 Combining Pagination With Filtering and Sorting

Real endpoints combine all three query-string concerns at once:

```js
// GET /api/products?category=electronics&sort=price&page=1&limit=20
app.get('/products', async (req, res) => {
  const { category, sort } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;

  const filter = category ? { category } : {}; // build the filter conditionally
  const sortField = sort || 'createdAt';

  // Mongoose version (Part 3):
  // const products = await Product.find(filter).sort(sortField).skip(skip).limit(limit);
  res.json({ filter, sortField, page, limit });
});
```

### 13.3 Returning Pagination Metadata

A response that includes only the page's data leaves the frontend unable to render "Page 3 of 47" or disable a "Next" button correctly. Always return metadata alongside the results:

```js
// Mongoose version, once Part 3's models are in place:
const [items, total] = await Promise.all([  // run both queries concurrently (Part 1, Section 8.4)
  Product.find(filter).sort(sortField).skip(skip).limit(limit),
  Product.countDocuments(filter), // total matching documents, ignoring skip/limit
]);

res.json({
  data: items,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  },
});
```

This response shape — a `data` array plus a `pagination` object — is the de facto standard for paginated REST endpoints, and it's exactly what a frontend pagination component needs to render page controls correctly without a second round-trip just to find out how many pages exist.

### 13.4 A Note on Performance: Index the Fields You Sort/Filter On

`skip()` on a MongoDB query still has to walk past every skipped document internally — for a small blog this is irrelevant, but on a collection with millions of documents, deep pages (`?page=5000`) get progressively slower. The practical fix at that scale is **indexing** the fields you commonly filter or sort by:

```js
// models/Product.js — add an index on frequently-queried fields
productSchema.index({ category: 1, createdAt: -1 });
```

This is a genuine "worry about it when you get there" concern rather than something to prematurely optimize — for most solo projects and internship-level work, plain `skip`/`limit` is entirely sufficient.

### 13.5 Cursor-Based Pagination (Brief Mention)

For very large or real-time-changing datasets (think: an infinite-scroll social feed), `skip`/`limit` has a subtle bug — if new documents are inserted between two page requests, `skip` can cause a document to be skipped entirely or shown twice, because "skip 20" means something different once the underlying order has shifted. **Cursor-based pagination** solves this by paginating from "the last item you saw" (e.g. `?after=<lastItemId>`) instead of a raw offset:

```js
// GET /api/posts?after=64f1a2b3c4d5e6f7a8b9c0d1&limit=20
const query = after ? { _id: { $gt: after } } : {};
const posts = await Post.find(query).sort({ _id: 1 }).limit(limit);
```

This is a heavier pattern than most projects need up front — worth knowing it exists, but `skip`/`limit` (Sections 13.1–13.3) is the right default to actually build with.

---

## 14. Part 2 Recap & What's Next

- ✅ Why Express exists as a layer over Node's raw `http` module
- ✅ Sending responses correctly (`res.json` vs `res.send`, status codes)
- ✅ Route params (`req.params`) vs. query strings (`req.query`) — when to use each
- ✅ Middleware — the `(req, res, next)` signature, why `next()` is mandatory, and why order matters
- ✅ Built-in middleware (`express.json`, `express.urlencoded`, `express.static`) and third-party middleware (`cors`, `morgan`)
- ✅ CORS in depth — origins, preflight requests, and why `credentials: true` requires an explicit origin instead of a wildcard
- ✅ File uploads with `multer` — disk storage for local dev, and why cloud object storage (S3/Cloudinary) is required once deployed
- ✅ All 5 core HTTP methods implemented as Express routes
- ✅ `express.Router()` for modular, mountable route files
- ✅ The MVC pattern — separating routes (wiring) from controllers (logic) from models (data)
- ✅ A complete, runnable in-memory CRUD REST API
- ✅ Basic 404 handling and the 4-parameter error-handling middleware signature
- ✅ API vs. SSR, and why a decoupled backend should stay a pure JSON API
- ✅ Real offset-based pagination with metadata, plus when cursor-based pagination becomes worth it

**Part 3** replaces the in-memory `data/users.js` array with an actual **MongoDB database via Mongoose** — connecting to MongoDB (Atlas or local), defining schemas, building models, and converting every controller function in Section 10 to real async CRUD operations against a database. This is Dave Gray's Ch. 13–15 territory, and it's where a real backend's data layer starts taking shape.

Ready for Part 3, or want to build out this in-memory API further first (e.g. add validation, or wire up a second resource)?
