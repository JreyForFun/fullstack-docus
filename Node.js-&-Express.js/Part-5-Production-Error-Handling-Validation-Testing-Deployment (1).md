# The Modern Node.js & Express Course (ES Modules Edition)

### Part 5: Production Concerns — Error Handling, Validation, Testing, Deployment

> The API from Parts 1–4 works, but it's held together with repeated try/catch blocks, no real input validation, no structured logging, no tests, and it's never been deployed anywhere but your own machine. This final part turns it into something you'd actually be comfortable shipping: one centralized error-handling system, structured logging, schema-based validation with Zod, layered security middleware, a testing setup that works cleanly with ESM, a graceful-shutdown-aware deployment, and an honest look at what lies beyond this series entirely.

### Part 5 Contents
1. The Problem With try/catch Everywhere
2. A Custom `AppError` Class
3. An Async Handler Wrapper
4. Centralized Error-Handling Middleware, Done Properly
5. Structured Logging with Pino
6. Input Validation with Zod
7. Security Essentials: Helmet, Sanitization, and Rate Limiting at Scale
8. Testing Your API (Vitest + Supertest)
9. Graceful Shutdown & Preparing for Deployment
10. Deploying (Render + Atlas)
11. Beyond This Series: Infra & Scaling Concerns
12. Series Recap — What You've Built

---

## 1. The Problem With try/catch Everywhere

Look back at Part 3 and Part 4's controllers — nearly every single function has this exact shape:

```js
export const someController = async (req, res) => {
  try {
    // the actual logic — maybe 2-3 lines
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message }); // repeated in EVERY controller
  }
};
```

This has three real problems:
1. **Repetition** — the same try/catch boilerplate copy-pasted across every controller, in every file.
2. **Inconsistent error shapes** — one controller might send `{ error: '...' }`, another `{ message: '...' }`, another forgets to set a status code at all.
3. **Easy to forget** — miss a single `try/catch` in one controller, and an uncaught rejected Promise inside an Express 4.x route handler crashes the entire process (Express 4 does not automatically catch rejected Promises in async route handlers — this is a well-known, easy-to-hit gotcha).

The fix: **one custom error class, one wrapper function, and one piece of centralized error-handling middleware** — write the error logic exactly once, and every controller becomes 3 lines shorter and impossible to get inconsistent.

---

## 2. A Custom `AppError` Class

```js
// utils/AppError.js
class AppError extends Error {
  constructor(message, statusCode) {
    super(message); // calls the built-in Error constructor, sets this.message
    this.statusCode = statusCode;
    this.isOperational = true; // marks this as a KNOWN, expected error (vs. an unexpected bug)
    Error.captureStackTrace(this, this.constructor); // keeps stack traces clean, excluding this constructor itself
  }
}

export default AppError;
```

`isOperational` is a useful distinction: an `AppError` you throw deliberately (e.g. "user not found," "invalid input") is an **expected** condition your app knows how to handle gracefully. An unexpected bug (a typo causing a `TypeError`, a database connection dropping) is **not** operational — and in a more advanced setup, you might treat these differently (e.g. crash-and-restart on non-operational errors, since the app is in an unknown state, but respond gracefully to operational ones).

Now controllers can express errors declaratively instead of manually setting status codes inline everywhere:

```js
import AppError from '../utils/AppError.js';

throw new AppError('User not found', 404);
throw new AppError('Email already in use', 409);
throw new AppError('Invalid credentials', 401);
```

---

## 3. An Async Handler Wrapper

This single utility eliminates every repeated try/catch block in your controllers:

```js
// utils/catchAsync.js
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next); // any rejection gets forwarded to next(err)
  };
};

export default catchAsync;
```

This is a **higher-order function** — it takes your async controller function and returns a *new* function that wraps it, automatically catching any rejected Promise (including a thrown error inside an `async` function, which JS automatically turns into a rejected Promise) and forwarding it to `next(err)`, which routes it directly into your error-handling middleware (Section 4).

### 3.1 Controllers, Rewritten — Dramatically Shorter

Compare this to Part 3, Section 9.2's version:

```js
// controllers/userController.js — the Part 5 version
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

export const getAllUsers = catchAsync(async (req, res) => {
  const users = await User.find();
  res.json(users);
});

export const getUserById = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  res.json(user);
});

export const createUser = catchAsync(async (req, res) => {
  const newUser = await User.create(req.body);
  res.status(201).json(newUser);
});

export const updateUser = catchAsync(async (req, res, next) => {
  const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!updatedUser) {
    return next(new AppError('User not found', 404));
  }
  res.json(updatedUser);
});

export const deleteUser = catchAsync(async (req, res, next) => {
  const deletedUser = await User.findByIdAndDelete(req.params.id);
  if (!deletedUser) {
    return next(new AppError('User not found', 404));
  }
  res.status(204).send();
});
```

No try/catch anywhere. Any thrown error or rejected Promise — a bad database call, a validation failure, an explicit `AppError` — flows automatically into the centralized handler in Section 4. This is the single biggest structural improvement you can make to an Express codebase past the beginner stage, and it's exactly the kind of pattern that separates tutorial code from production code.

---

## 4. Centralized Error-Handling Middleware, Done Properly

Recall Part 2, Section 11.2's bare-bones version. Here's the production-shaped one, which also translates Part 3's Mongoose-specific errors (`ValidationError`, `CastError`, and duplicate-key errors) into clean, consistent responses:

```js
// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose bad ObjectId (Part 3, Section 10.2)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose validation error (Part 3, Section 10.1)
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  // Mongoose duplicate key error (e.g. unique email violated)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already in use`;
  }

  // JWT errors (Part 4, Section 6)
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Log unexpected (non-operational) errors for debugging — never expose stack traces to the client
  if (!err.isOperational) {
    console.error('UNEXPECTED ERROR:', err);
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }), // stack traces ONLY in dev
  });
};

export default errorHandler;
```

```js
// index.js — must be registered AFTER every route (Part 2, Section 11.2's rule still applies)
import errorHandler from './middleware/errorHandler.js';

// ... all your routes go here ...

app.use((req, res, next) => {
  next(new AppError(`Cannot ${req.method} ${req.originalUrl}`, 404)); // unmatched routes flow into the error handler too
});

app.use(errorHandler); // always LAST
```

Every single error type from Parts 3 and 4 — bad IDs, failed validation, duplicate emails, invalid/expired JWTs, and explicit `AppError`s — now funnels through **one place**, with **one consistent JSON shape**, and stack traces are only ever exposed in development, never in production (leaking stack traces to real users is a real information-disclosure risk).

---

## 5. Structured Logging with Pino

Every example so far has used `console.log`/`console.error` for anything worth recording — including Section 4's caught errors. That's fine for local development, but breaks down in production: no log levels, no timestamps, no structured fields to search or filter in a real logging platform, and no way to turn verbosity down without editing code.

```bash
npm install pino pino-http
npm install -D pino-pretty
```

### 5.1 Why Pino Over `console.log`

- **Log levels** — `trace`, `debug`, `info`, `warn`, `error`, `fatal` — let you filter noise in production (`info` and up) while still getting verbose output locally (`debug` and up), without touching a single log call.
- **Structured (JSON) output** — each log line is a JSON object with a timestamp, level, and message. Log aggregation platforms (Datadog, Better Stack, or your host's built-in log viewer) can search and filter on specific fields, rather than grepping plain text.
- **Performance** — pino is one of the fastest loggers available for Node, which matters because logging runs on every single request.

### 5.2 Basic Setup

```js
// utils/logger.js
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } } // human-readable locally
    : undefined, // raw JSON in production, for log aggregators to parse
});

export default logger;
```

```js
logger.info('Server starting');
logger.warn({ userId }, 'Rate limit approaching for user');
logger.error({ err }, 'Database connection failed');
```

### 5.3 Request Logging with `pino-http`

`pino-http` replaces `morgan` (Part 2, Section 6.5) with structured, per-request logs, including a unique request ID:

```js
// app.js
import pinoHttp from 'pino-http';
import logger from './utils/logger.js';

app.use(pinoHttp({ logger }));
```

### 5.4 Wiring the Logger Into the Error Handler

Recall Section 4's `errorHandler.js` used `console.error('UNEXPECTED ERROR:', err)`. Swap it for the logger, and log operational errors too, at a lower severity:

```js
// middleware/errorHandler.js
import logger from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
  // ... statusCode / message logic unchanged from Section 4 ...

  if (!err.isOperational) {
    logger.error({ err, path: req.originalUrl, method: req.method }, 'Unexpected error');
  } else {
    logger.warn({ statusCode, path: req.originalUrl }, err.message);
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
```

Attaching structured fields (`path`, `method`, and — once available — a `userId`) to each log line, rather than just a message string, is what makes production logs actually searchable later: "show me every 500 on `/api/auth/login` in the last hour" is a real query against structured logs, and isn't really possible against a wall of plain `console.log` text.

---

## 6. Input Validation with Zod

**Zod** validates incoming data against a schema at runtime — the same core idea whether it's validating a request body, a form on a frontend, or (as this section covers) a route param or query string that never goes through a database query unvalidated.

```bash
npm install zod
```

### 6.1 Defining a Schema

```js
// validation/userSchemas.js
import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  role: z.enum(['user', 'admin']).optional(),
});
```

### 6.2 A Reusable Validation Middleware

```js
// middleware/validate.js
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join(', ');
    return res.status(400).json({ error: message });
  }

  req.body = result.data; // replace req.body with the PARSED, TYPE-COERCED, validated data
  next();
};

export default validate;
```

`schema.safeParse()` (rather than `.parse()`) is the right choice inside middleware — `.parse()` *throws* on failure, which would require wrapping this in a try/catch; `.safeParse()` returns a `{ success, data }` or `{ success: false, error }` object you can branch on directly.

### 6.3 Wiring It Into Routes

```js
// routes/authRoutes.js
import { Router } from 'express';
import validate from '../middleware/validate.js';
import { registerSchema } from '../validation/userSchemas.js';
import { register, login } from '../controllers/authController.js';

const router = Router();

router.post('/register', validate(registerSchema), register); // bad input never even reaches the controller
router.post('/login', login);

export default router;
```

With this in place, your `register` controller (Part 4, Section 3) no longer needs its manual `if (!name || !email || !password)` check at all — by the time execution reaches the controller, `req.body` is guaranteed to already match the schema exactly. This is the same separation-of-concerns principle as MVC (Part 2, Section 9): validation is its own layer, not tangled into business logic.

### 6.4 Validating `req.params` and `req.query` Too

Section 6.2's `validate` middleware only ever checks `req.body` — every route param and query string used elsewhere in this series (Part 3's `:id` params, Part 3, Section 9.3's `?page=&limit=` pagination) has gone completely unvalidated by Zod, relying entirely on Mongoose's `CastError` (Part 3, Section 10.2) to catch a malformed ID *after* it already reached the database. That's a real gap: catching bad input at the validation layer, before a query ever runs, is both faster and produces a cleaner error than waiting for the database driver to reject it.

Extend the middleware to validate any part of the request, not just the body:

```js
// middleware/validate.js
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join(', ');
    return res.status(400).json({ error: message });
  }

  req[source] = result.data;
  next();
};

export default validate;
```

```js
// validation/commonSchemas.js
import { z } from 'zod';
import mongoose from 'mongoose';

export const mongoIdParamSchema = z.object({
  id: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Invalid ID format',
  }),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20), // capped here too, alongside Part 2 §13's own cap
  role: z.enum(['user', 'admin']).optional(),
  sort: z.string().optional(),
});
```

```js
// routes/userRoutes.js
import { mongoIdParamSchema, paginationQuerySchema } from '../validation/commonSchemas.js';

router.get('/', validate(paginationQuerySchema, 'query'), getAllUsers);
router.get('/:id', validate(mongoIdParamSchema, 'params'), getUserById);
```

`z.coerce.number()` matters here specifically because everything arriving via `req.query` is a string (Part 2, Section 4.2) — `z.coerce.number()` converts `"2"` to `2` as part of validation itself, rather than needing a separate `Number(req.query.page)` conversion inside the controller afterward. With this in place, `getUserById` (Part 3, Section 9.2) no longer needs its `CastError` branch at all for malformed IDs specifically — bad formats are rejected before the controller runs; the `CastError` handling in the centralized error handler (Section 4) remains as a safety net for anywhere validation gets missed, rather than the primary defense.

---

## 7. Security Essentials: Helmet, Sanitization, and Rate Limiting at Scale

### 7.1 `helmet`

```bash
npm install helmet express-rate-limit
```

```js
// app.js
import helmet from 'helmet';

app.use(helmet()); // sets a batch of security-related HTTP headers automatically (e.g. disables X-Powered-By, sets sane CSP defaults)
```

`helmet()` is a one-line addition that sets a collection of headers mitigating several well-known attack classes (clickjacking, MIME-sniffing, etc.) — there's very little reason to ship an Express app without it.

### 7.2 Basic Rate Limiting

```js
// app.js
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
});

app.use('/api', limiter); // apply to all API routes
```

`express-rate-limit` protects against brute-force attacks (repeatedly guessing passwords against your `/login` endpoint) and basic abuse/DoS by capping how many requests a single IP can make in a given window. Apply a stricter limiter specifically to sensitive endpoints, since they're the most common targets:

```js
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // only 5 login attempts per 15 minutes per IP
  message: { error: 'Too many login attempts, please try again later' },
});

router.post('/login', loginLimiter, login);
router.post('/forgot-password', loginLimiter, forgotPassword); // Part 4, Section 10.4 — same reasoning applies
```

### 7.3 Sanitizing Against NoSQL Injection

MongoDB queries built from raw `req.body`/`req.query` are vulnerable to **NoSQL injection** — a crafted request body can smuggle MongoDB query operators into a field your code expects to be a plain string:

```json
// An attacker-crafted login request body
{ "email": { "$gt": "" }, "password": { "$gt": "" } }
```

If a controller does `User.findOne({ email: req.body.email })` with no validation in front of it, this can match *any* document rather than a specific email — `{ "$gt": "" }` is a valid MongoDB operator meaning "greater than an empty string," which every string in the collection satisfies.

**Zod (Section 6) already closes most of this door** — `z.string().email()` rejects an object outright, since it isn't a string at all. But for any route not yet covered by a Zod schema, `express-mongo-sanitize` is a cheap, defense-in-depth safety net:

```bash
npm install express-mongo-sanitize
```

```js
// app.js
import mongoSanitize from 'express-mongo-sanitize';

app.use(mongoSanitize()); // strips any key starting with '$' or containing '.' from req.body/req.query/req.params
```

Worth having even with Zod validation everywhere — it costs nothing, and it covers routes you (or a future teammate) forget to add a schema to.

### 7.4 A Note on XSS

Cross-site scripting (XSS) is primarily a **frontend rendering** concern — it happens when untrusted data gets injected into the DOM as HTML rather than as text. In React specifically, this means someone using `dangerouslySetInnerHTML` on user-supplied content; plain `{userInput}` in JSX is auto-escaped by React itself. Because of this, a pure JSON API — consumed correctly by a React frontend — has a narrower XSS surface than a server that renders HTML directly (Part 2, Section 12's SSR).

The once-standard `xss-clean` middleware is now deprecated and unmaintained — avoid adding it. If your app ever accepts and re-displays **rich text or raw HTML** from users (a formatted bio field, for instance), sanitize that specific field's content with a maintained library like `sanitize-html` or `DOMPurify` (usable server-side via `jsdom`) at the point you store or render it, rather than reaching for a blanket incoming-request middleware that doesn't actually match how the vulnerability works.

### 7.5 Rate Limiting at Scale — Why the Default Store Breaks

`express-rate-limit`'s default store keeps counts in the memory of a **single Node process**. This works perfectly on your machine and on a single-instance deployment — but the moment your host runs more than one instance of your app (for redundancy, or to handle more traffic), each instance keeps its own separate counter. A client rate-limited on instance A could get routed to instance B on their very next request and find their counter reset — the limit silently stops doing its job.

The fix is a **shared store** every instance reads and writes to — typically Redis:

```bash
npm install ioredis rate-limit-redis
```

```js
// config/redis.js
import Redis from 'ioredis';

export const redisClient = new Redis(process.env.REDIS_URL); // e.g. a free-tier Redis Cloud or Upstash instance
```

```js
// app.js
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from './config/redis.js';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
});

app.use('/api', limiter);
```

For a solo project or a single-instance deployment — which covers most internship-scale work and early-stage production apps — Section 7.2's in-memory store is entirely sufficient. Reach for the Redis-backed version specifically once you're running more than one instance of the app, not before.

---

## 8. Testing Your API (Vitest + Supertest)

A quick note on tooling choice: **Jest** (the most commonly taught test runner) has historically required extra configuration to work smoothly with native ESM — it was originally built CJS-first. **Vitest** is ESM-native from the ground up, has a near-identical API to Jest (so nothing here feels unfamiliar), and requires zero extra config for the ESM setup this entire series has used. For a project already committed to ESM, Vitest is the smoother choice.

```bash
npm install -D vitest supertest
```

```json
// package.json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

### 8.1 A Basic Endpoint Test

```js
// tests/auth.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js'; // your Express app, exported WITHOUT calling .listen() (see 7.2)

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_TEST_URI); // a SEPARATE test database, never your real one
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('POST /api/auth/register', () => {
  it('creates a new user with valid data', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('test@example.com');
    expect(res.body.password).toBeUndefined(); // never leaked back to the client
  });

  it('rejects an invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: 'not-an-email',
      password: 'password123',
    });

    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'First',
      email: 'dupe@example.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/auth/register').send({
      name: 'Second',
      email: 'dupe@example.com',
      password: 'password456',
    });

    expect(res.status).toBe(409);
  });
});
```

### 8.2 Splitting `app.js` from `index.js` — Required for Testing

To test with Supertest, your Express app needs to be importable **without** starting an actual server listening on a port (Supertest spins up its own temporary server internally per test run). The fix — separate app configuration from server startup:

```js
// app.js — configures Express, exports the app, does NOT call .listen()
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use(errorHandler);

export default app;
```

```js
// index.js — imports the configured app, connects to the DB, and starts listening
import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

connectDB().then(() => {
  app.listen(process.env.PORT || 3000, () => console.log('Server running'));
});
```

This split — `app.js` (pure configuration) vs. `index.js` (startup) — is a standard, widely-used Express project convention specifically because it enables exactly this kind of testing.

### 8.3 Unit Testing Middleware in Isolation

Section 8.1's tests are **integration tests** — they exercise a real (test) database through actual HTTP requests via Supertest. Middleware like `authorize` (Part 4, Section 12) is simple enough to unit test directly, with no database or HTTP layer involved at all — just call it as a plain function and inspect what it does to mock `req`/`res` objects:

```js
// tests/authorize.test.js
import { describe, it, expect, vi } from 'vitest';
import { authorize } from '../middleware/authMiddleware.js';

describe('authorize middleware', () => {
  it('calls next() when the role is allowed', () => {
    const req = { user: { role: 'admin' } };
    const res = {};
    const next = vi.fn(); // a mock function — records whether/how it was called

    authorize('admin')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(); // called with no arguments — no error
  });

  it('rejects with 403 when the role is not allowed', () => {
    const req = { user: { role: 'user' } };
    const json = vi.fn();
    const res = { status: vi.fn(() => ({ json })) };
    const next = vi.fn();

    authorize('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
```

`vi.fn()` (Vitest's equivalent of Jest's `jest.fn()`) creates a **mock function** — one that records every call made to it without running any real logic, so you can assert on *how* it was used rather than what it produces. This test never touches Express, a real request, or a database — it tests the middleware's decision logic in complete isolation, which makes it fast and pins down a single piece of behavior precisely, rather than relying on the mixed signal of a full HTTP round-trip.

### 8.4 Mocking the Database Layer

Integration tests hitting a real test database (8.1) are valuable but slow — and for testing a controller's *logic* rather than whether MongoDB itself works, mocking the model entirely gives fast, focused tests:

```js
// tests/userController.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserById } from '../controllers/userController.js';
import User from '../models/User.js';

vi.mock('../models/User.js'); // replaces every method on User with an auto-mocked stub

describe('getUserById', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // reset call history between tests
  });

  it('returns the user when found', async () => {
    User.findById.mockResolvedValue({ _id: '1', name: 'Test User' });

    const req = { params: { id: '1' } };
    const json = vi.fn();

    await getUserById(req, { json }, vi.fn());

    expect(json).toHaveBeenCalledWith({ _id: '1', name: 'Test User' });
  });

  it('calls next with a 404 AppError when the user does not exist', async () => {
    User.findById.mockResolvedValue(null);

    const req = { params: { id: 'missing' } };
    const next = vi.fn();

    await getUserById(req, {}, next);

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(404);
  });
});
```

`vi.mock('../models/User.js')` replaces the entire module with an auto-mocked version — `User.findById` becomes a mock function you control directly (`mockResolvedValue`, `mockRejectedValue`), with no real MongoDB connection involved. This is the right tool for testing a controller's *branching logic* — does it call `next` with a 404 when nothing's found? does it send the right shape on success? — fast and in isolation. The slower Supertest-based integration tests from 8.1 remain valuable for confirming the whole stack (routing, middleware, real Mongoose behavior) actually works together end to end. A healthy test suite has both kinds.

### 8.5 Coverage

```bash
npm install -D @vitest/coverage-v8
```

```json
// package.json
{
  "scripts": {
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

Coverage reports show which lines and branches of your code actually ran during the test suite — useful for spotting untested error paths (a `catch` block nobody ever triggers in a test, for instance). Treat the percentage as a signal to investigate, not a target to chase for its own sake: 100% coverage from tests with shallow assertions (calling a function without checking what it actually returned) is worth less than 70% coverage from tests that genuinely verify behavior.

### 8.6 Testing Ownership Middleware

`requireOwnership` (Part 4, Section 12.2) has three distinct branches worth testing individually — admin bypass, legitimate owner, and a blocked non-owner — following the same isolated-unit-test approach as 8.3:

```js
// tests/requireOwnership.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireOwnership } from '../middleware/authMiddleware.js';

const FakeModel = { findById: vi.fn() };

describe('requireOwnership middleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows an admin through regardless of ownership', async () => {
    FakeModel.findById.mockResolvedValue({ _id: '1', user: 'someone-else' });
    const req = { params: { id: '1' }, user: { userId: 'admin-id', role: 'admin' } };
    const next = vi.fn();

    await requireOwnership(FakeModel)(req, {}, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.resource).toBeDefined();
  });

  it('allows the actual owner through', async () => {
    FakeModel.findById.mockResolvedValue({ _id: '1', user: { toString: () => 'owner-id' } });
    const req = { params: { id: '1' }, user: { userId: 'owner-id', role: 'user' } };
    const next = vi.fn();

    await requireOwnership(FakeModel)(req, {}, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('blocks a non-owner with 403', async () => {
    FakeModel.findById.mockResolvedValue({ _id: '1', user: { toString: () => 'owner-id' } });
    const req = { params: { id: '1' }, user: { userId: 'a-different-user', role: 'user' } };
    const json = vi.fn();
    const res = { status: vi.fn(() => ({ json })) };
    const next = vi.fn();

    await requireOwnership(FakeModel)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
```

Passing a plain fake object (`FakeModel`) instead of `vi.mock()`-ing a real Mongoose model file works just as well here, and is arguably clearer for a middleware that only ever calls one method (`findById`) on whatever model it's given.

### 8.7 Testing the Refresh Rotation Flow

The refresh endpoint (Part 4, Section 9.4) has real branching logic worth pinning down directly, separate from the database: valid rotation issues a new pair and revokes the old one; a reused (already-revoked) token triggers mass revocation. Mock both `jsonwebtoken` and the `RefreshToken` model to test this without a real database or real token signing:

```js
// tests/refresh.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { refresh } from '../controllers/authController.js';
import RefreshToken from '../models/RefreshToken.js';

vi.mock('jsonwebtoken');
vi.mock('../models/RefreshToken.js');

describe('refresh (rotation)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rotates a valid, unused token and issues a new pair', async () => {
    jwt.verify.mockReturnValue({ userId: 'user-1' });
    jwt.sign.mockReturnValue('new-signed-token');

    const storedToken = { revoked: false, save: vi.fn() };
    RefreshToken.findOne.mockResolvedValue(storedToken);
    RefreshToken.create.mockResolvedValue({});

    const req = { cookies: { refreshToken: 'incoming-raw-token' } };
    const json = vi.fn();
    const cookie = vi.fn();
    const res = { json, cookie, status: vi.fn(() => ({ json })) };

    await refresh(req, res);

    expect(storedToken.revoked).toBe(true); // the old one was marked revoked, not deleted
    expect(storedToken.save).toHaveBeenCalledOnce();
    expect(RefreshToken.create).toHaveBeenCalledOnce(); // a fresh one was issued
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ accessToken: expect.any(String) }));
  });

  it('detects reuse of an already-revoked token and revokes every session', async () => {
    jwt.verify.mockReturnValue({ userId: 'user-1' });

    RefreshToken.findOne.mockResolvedValue({ revoked: true }); // this exact token was already rotated out
    RefreshToken.updateMany.mockResolvedValue({});

    const req = { cookies: { refreshToken: 'a-replayed-token' } };
    const json = vi.fn();
    const res = { status: vi.fn(() => ({ json })), clearCookie: vi.fn() };

    await refresh(req, res);

    expect(RefreshToken.updateMany).toHaveBeenCalledWith(
      { user: 'user-1' },
      { revoked: true }
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
```

This is the same mocking approach as 8.4, applied to genuinely the most security-critical branch of the entire series — worth a dedicated test file specifically because a regression here (rotation silently not happening, or reuse detection silently not firing) would be invisible in normal use and only matter the moment a token actually leaks.

### 8.8 Testing the Health Check Endpoint

Unlike the mocked unit tests above, the health check (Section 9.2) is simple enough to test as a real integration test against the test database from 8.1 — confirming both the "healthy" and "degraded" response shapes:

```js
// tests/health.test.js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';

describe('GET /health', () => {
  it('reports ok when the database is connected', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
  });

  it('reports degraded when the database is disconnected', async () => {
    await mongoose.connection.close(); // simulate a dropped connection for this one test

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');

    await mongoose.connect(process.env.MONGO_TEST_URI); // reconnect for any tests that run after this one
  });
});
```

The second test is a good example of a test that mutates shared state (the DB connection) deliberately — worth being careful that it reconnects afterward, or every test that runs later in the same file/session would fail for an unrelated reason.

---

## 9. Graceful Shutdown & Preparing for Deployment

### 9.1 Validating Environment Variables at Startup

Every part of this series has assumed `.env` is filled in correctly — `JWT_ACCESS_SECRET`, `MONGO_URI`, and so on. Nothing so far actually checks that assumption. If `JWT_ACCESS_SECRET` is simply missing (a typo in the hosting platform's environment-variables panel, a variable that never got copied over during deployment), the app currently doesn't fail until the *first* request that needs it — `jwt.sign(payload, undefined, ...)` either throws somewhere deep inside a request handler or, worse, silently signs with the string `"undefined"` as the secret, producing tokens that look valid but aren't secured by anything real.

The fix is to validate every required environment variable **once, at startup**, and crash immediately with a clear message if anything's missing or malformed — using Zod (Section 6), which is already in the project:

```js
// config/validateEnv.js
import { z } from 'zod';

const envSchema = z.object({
  MONGO_URI: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET should be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET should be at least 32 characters'),
  CLIENT_URL: z.string().url(),
  PORT: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env); // throws immediately, with a clear message, if anything's wrong
```

```js
// index.js — imported before anything else that reads process.env
import 'dotenv/config';
import { env } from './config/validateEnv.js'; // crashes loudly here, not confusingly later
```

`.parse()` (rather than `.safeParse()`, Section 6.2's choice for request bodies) is the right call here — a malformed request body should produce a graceful `400` response, but a malformed *server configuration* should stop the process from starting at all. Failing at startup with `JWT_ACCESS_SECRET: Required` is a five-second fix; failing three days later when a specific code path finally touches the missing variable is a debugging session.

### 9.2 A Health Check Endpoint

Section 11.8 mentions uptime monitors pinging a health-check endpoint — this is that endpoint, and it's also what most hosting platforms use internally to decide whether an instance is ready to receive traffic (or should be restarted).

```js
// routes/healthRoutes.js
import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1; // 1 = connected

  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    db: dbConnected ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  });
});

export default router;
```

```js
// app.js
import healthRoutes from './routes/healthRoutes.js';
app.use('/', healthRoutes); // exposes GET /health, deliberately outside /api and unauthenticated
```

A health check is deliberately simple and unauthenticated — its only job is answering "is this instance able to serve traffic," not exercising business logic. Checking `mongoose.connection.readyState` rather than issuing a real query is enough to catch the most common failure (the database connection dropped) without adding load to the database on every single health-check ping, which — depending on the monitor's interval — can be frequent.

### 9.3 Why Graceful Shutdown Matters

Every hosting platform (Render, Railway, Fly.io, and effectively all container-based hosts) sends your process a **`SIGTERM`** signal before killing it — on every redeploy, every scale-down, every restart. By default, Node exits as soon as it receives this signal, immediately dropping any request currently mid-flight and abruptly severing the MongoDB connection. A graceful shutdown handler intercepts this: stop accepting *new* connections, wait for in-flight requests to finish, then close the database connection and exit cleanly.

### 9.4 Implementing It

```js
// index.js
import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
import { env } from './config/validateEnv.js';
import { connectDB } from './config/db.js';
import logger from './utils/logger.js';

let server;

connectDB().then(() => {
  server = app.listen(env.PORT || 3000, () => logger.info(`Server running on port ${env.PORT || 3000}`));
});

const shutdown = async (signal) => {
  logger.info(`${signal} received: starting graceful shutdown`);

  server.close(async () => {
    logger.info('HTTP server closed — no longer accepting new connections');
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  });

  // Force-exit if shutdown hangs longer than 10 seconds — a stuck connection shouldn't block a deploy forever
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM')); // sent by hosting platforms on redeploy/scale-down
process.on('SIGINT', () => shutdown('SIGINT'));   // sent by Ctrl+C locally
```

`server.close()` stops the HTTP server from accepting *new* connections but lets existing in-flight requests finish naturally before its callback fires — exactly where closing the database connection belongs, since the DB should stay available until the last request actually needs it. The `setTimeout(...).unref()` safety net exists because a hung connection could otherwise block a deploy indefinitely; `.unref()` ensures this timer itself doesn't keep the process alive if everything else already exited cleanly.

### 9.5 A Deployment Checklist

- [ ] `.env` is in `.gitignore` and **never** committed (Part 3, Section 4)
- [ ] All secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MONGO_URI`) are set as environment variables on the hosting platform itself, not in code
- [ ] Startup env validation (Section 9.1) is in place, so a missing secret fails immediately and loudly, not confusingly on first use
- [ ] `NODE_ENV=production` is set on the host, so stack traces stay hidden (Section 4) and cookies get `secure: true`/`sameSite: 'none'` (Part 4, Section 7.1)
- [ ] CORS (Part 2, Section 6.4) is configured with your actual frontend's deployed URL, not left wide open:
  ```js
  app.use(cors({
    origin: process.env.CLIENT_URL, // e.g. 'https://nebula-app.vercel.app', set via env var
    credentials: true, // required if you're sending cookies (the refresh token) cross-origin
  }));
  ```
- [ ] `package.json`'s `"start"` script runs the production entry point: `"start": "node index.js"`
- [ ] Helmet, sanitization, and rate limiting (Section 7) are in place
- [ ] `GET /health` (Section 9.2) is wired up and reachable, for your host's own health checks and any uptime monitor (Section 11.8)
- [ ] Graceful shutdown (Section 9.4) handles `SIGTERM` so redeploys don't drop in-flight requests
- [ ] Structured logging (Section 5) is wired in, with `LOG_LEVEL` set appropriately for production
- [ ] If using a Redis-backed rate limit store (Section 7.5) or a job queue (Section 11.6), `REDIS_URL` is set on the host
- [ ] MongoDB Atlas's Network Access allows connections from your hosting provider (or `0.0.0.0/0` if the host uses dynamic IPs, which is common for platforms like Render/Railway)

### 9.6 Where This Runs

Your database is already handled — MongoDB Atlas (Part 3, Section 2) is a cloud service, so nothing changes there when you deploy. What you need now is a host for the **Express app itself**. Popular current options for a Node/Express API include Render, Railway, and Fly.io — all support connecting a GitHub repo and auto-deploying on push, with an environment-variables panel in their dashboard for your secrets. (Specific step-by-step setup varies by provider and changes over time, so check the provider's current docs when you get there — the checklist above is what stays constant regardless of which one you pick.)

---

## 10. Deploying (Render + Atlas) — The General Shape

While exact UI details shift between providers, the deployment shape for an Express + MongoDB Atlas API is consistent across all of them:

1. Push your project to a GitHub repository (make sure `.env` and `node_modules` are in `.gitignore`).
2. Create a new "Web Service" (or equivalent) on your chosen host, connected to that GitHub repo.
3. Set the **build command** (usually `npm install`) and **start command** (`npm start`, which runs `node index.js`).
4. Add every environment variable from your local `.env` file into the host's environment variable settings panel — `MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV=production`, `CLIENT_URL`.
5. In MongoDB Atlas, under Network Access, allow connections from your host (many hosts have dynamic outbound IPs, so `0.0.0.0/0` combined with a strong database user password is the common practical approach — Atlas's own access controls, not IP restriction, become your main line of defense in that case).
6. Deploy, then test your live endpoints with Postman exactly as you did locally, pointing at the new live URL instead of `localhost`.

This same pattern applies to any Express backend paired with a separately-deployed frontend (React, Vue, or otherwise) — e.g. a frontend on Vercel/Netlify and an API on Render/Railway, with `CLIENT_URL`/CORS wired to point at each other's real deployed URLs instead of `localhost` ports.

---

## 11. Beyond This Series: Infra & Scaling Concerns

Everything through Section 10 is genuinely enough to deploy and run a real API. The concerns below matter more as an app grows past a solo project — worth knowing what each one solves and where to start, without turning this series into a full DevOps course.

### 11.1 Containerization with Docker

Docker packages your app with its exact runtime environment (Node version, OS-level dependencies) into a single portable image, so "works on my machine" stops being a real category of bug — the container runs identically everywhere.

```dockerfile
# Dockerfile
FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "index.js"]
```

```bash
docker build -t nebula-api .
docker run -p 3000:3000 --env-file .env nebula-api
```

`npm ci` (rather than `npm install`) installs **exactly** what's in `package-lock.json` (Part 1, Section 11.4) with no version resolution — the correct choice inside a container build, where reproducibility matters more than picking up the latest compatible patch version.

### 11.2 CI/CD — Running Tests Before Every Deploy

**Continuous Integration** means your test suite (Section 8) runs automatically on every push, catching regressions before they reach production, rather than relying on remembering to run `npm test` locally. GitHub Actions is the common default if your code's already on GitHub:

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run test:coverage
```

**Continuous Deployment** extends this: a passing test suite on the main branch automatically triggers a deploy (most hosts — Render, Railway — support this natively just by connecting the repo, no extra YAML needed beyond the test gate above).

### 11.3 Dependency Vulnerability Scanning

Every package installed via `npm install` — including every dependency of every dependency — is code you didn't write and aren't personally reviewing. Known vulnerabilities get discovered in popular packages regularly, and there's no way to track that manually across dozens of transitive dependencies.

```bash
npm audit                  # scans installed packages against known vulnerability databases
npm audit fix               # attempts to auto-upgrade to patched versions where possible
npm audit --audit-level=high # exits with a non-zero code only for high/critical findings — the useful CI gate
```

Add it as a step in the same CI workflow from Section 11.2, so a newly-disclosed vulnerability in a dependency fails the build rather than silently shipping:

```yaml
      - run: npm ci
      - run: npm audit --audit-level=high
      - run: npm run test:coverage
```

Separately, **GitHub's Dependabot** (free, built into any GitHub repo) goes a step further than `npm audit` — it actively monitors your `package.json` against vulnerability databases and opens a pull request automatically with the fix already applied, rather than waiting for you to run a scan. Enable it under the repo's Settings → Security → Dependabot, or by committing a `.github/dependabot.yml`:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
```

### 11.4 Load & Performance Testing

Everything tested so far (Section 8) verifies *correctness* — does the endpoint return the right data. None of it verifies the API holds up under realistic concurrent traffic, which is a genuinely different question: does the Redis-backed rate limiter (Section 7.5) behave correctly when 200 requests arrive in the same second? Does pagination (Part 3, Section 9.3) stay fast once a collection has 100,000 documents and 50 concurrent users are paging through it?

`autocannon` is a lightweight, Node-native load-testing tool — good enough for a first pass without adopting a whole separate tool:

```bash
npm install -D autocannon
npx autocannon -c 100 -d 10 http://localhost:3000/api/users
```

`-c 100` opens 100 concurrent connections, `-d 10` runs for 10 seconds; the output reports requests/second and latency percentiles (p50, p99) — the p99 figure matters more than the average, since it reflects what your *slowest* real users actually experience, not just the typical case. For deeper, scriptable scenarios (simulating a full login → browse → create-entry user flow rather than hammering one endpoint), **k6** is the more full-featured option worth knowing exists, with its own scripting language for multi-step scenarios.

Treat this the same way as Section 8.5's coverage numbers: a load test's real value is surfacing where something breaks down (a query that's fine at 10 documents and falls over at 100,000, a rate limiter that works locally but was never actually tried under real concurrency) — not producing a single number to chase.

### 11.5 Caching with Redis

Beyond rate-limiting storage (Section 7.5), Redis's most common use is caching expensive or frequently-repeated database reads:

```js
export const getProductById = async (req, res) => {
  const cacheKey = `product:${req.params.id}`;
  const cached = await redisClient.get(cacheKey);

  if (cached) {
    return res.json(JSON.parse(cached)); // served from memory, no database hit at all
  }

  const product = await Product.findById(req.params.id);
  await redisClient.set(cacheKey, JSON.stringify(product), 'EX', 300); // expire after 5 minutes
  res.json(product);
};
```

The hard part of caching isn't storing the value — it's **invalidation**: making sure a cached value gets cleared or updated the moment the underlying data changes (e.g. clearing `product:${id}` inside `updateProduct`). Stale cached data served confidently is a worse bug than no caching at all, which is why caching is usually added deliberately to specific hot paths rather than blanket-applied everywhere.

### 11.6 Background Job Queues

Some work shouldn't block a request-response cycle at all — sending the verification email from Part 4, Section 10.5 synchronously means the client waits on your SMTP provider's response time before getting a `201 Created` back. A job queue (BullMQ, backed by Redis) decouples this:

```bash
npm install bullmq
```

```js
// queues/emailQueue.js
import { Queue } from 'bullmq';

export const emailQueue = new Queue('email', { connection: { url: process.env.REDIS_URL } });
```

```js
// Instead of `await sendEmail(...)` directly inside the request handler:
await emailQueue.add('send-verification', { to: user.email, verifyUrl });
res.json({ message: 'Verification email sent' }); // responds immediately, doesn't wait on SMTP
```

```js
// workers/emailWorker.js — a SEPARATE process that pulls jobs off the queue
import { Worker } from 'bullmq';
import { sendEmail } from '../utils/sendEmail.js';

new Worker('email', async (job) => {
  await sendEmail(job.data);
}, { connection: { url: process.env.REDIS_URL } });
```

This pattern matters for anything slow or unreliable that doesn't need to finish before responding to the client: emails, image processing, generating reports, calling a third-party API with unpredictable latency.

### 11.7 API Versioning

Once a real frontend (or third-party consumer) depends on your API's exact response shape, changing that shape breaks them. Versioning your routes gives you room to evolve:

```js
// app.js
app.use('/api/v1/users', userRoutesV1);
app.use('/api/v2/users', userRoutesV2); // a breaking change lives here — v1 keeps working unchanged
```

Simple URL-prefix versioning (`/api/v1/...`) is the most common approach and the easiest to reason about — worth adopting from the start of any API you expect to evolve, even if `v2` never actually arrives, since retrofitting versioning onto an already-consumed unversioned API is far more painful than starting with it.

### 11.8 Observability — Error Tracking and Uptime Monitoring

Section 5's structured logging tells you what happened *if you go looking*. **Error tracking** (Sentry is the standard choice) tells you the moment something breaks, without needing to be watching logs:

```bash
npm install @sentry/node
```

```js
// index.js — as early as possible
import * as Sentry from '@sentry/node';
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

```js
// middleware/errorHandler.js — report unexpected errors
if (!err.isOperational) {
  Sentry.captureException(err);
  logger.error({ err }, 'Unexpected error');
}
```

Separately, **uptime monitoring** (UptimeRobot, Better Stack) pings your API's health-check endpoint on an interval and alerts you if it stops responding, catching outages your users would otherwise report to you first.

### 11.9 Horizontal Scaling — Using More Than One CPU Core

Recall Part 1, Section 7: Node runs on a **single thread**. One Node process, however powerful the machine, only ever uses one CPU core. Node's built-in `cluster` module forks multiple worker processes (typically one per CPU core) that share the same port, letting a single machine actually use all its cores:

```js
// cluster.js
import cluster from 'node:cluster';
import os from 'node:os';

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  for (let i = 0; i < numCPUs; i++) cluster.fork();

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died, restarting`);
    cluster.fork(); // keep the pool at full strength
  });
} else {
  await import('./index.js'); // each worker runs the actual app
}
```

In practice, most hosting platforms (Render, Railway) handle horizontal scaling for you at the infrastructure level — running multiple *instances* of your app behind a load balancer — rather than you managing `cluster` yourself inside one instance. This is exactly why Section 7.5's Redis-backed rate-limit store and 11.5's shared cache matter: the moment there's more than one instance or worker, in-memory state stops being shared automatically, and anything that needs to stay consistent across requests has to live somewhere external, like Redis.

### 11.10 API Documentation

As an API gets consumed by more than just its own frontend — a mobile app, a third party, or just future-you six months from now — a browsable spec beats reading route files to figure out what's available. **OpenAPI/Swagger** is the standard format:

```bash
npm install swagger-ui-express swagger-jsdoc
```

```js
// app.js
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

const swaggerSpec = swaggerJsdoc({
  definition: { openapi: '3.0.0', info: { title: 'Your API', version: '1.0.0' } },
  apis: ['./routes/*.js'], // pulls documentation from JSDoc comments directly above your routes
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

Routes get documented via a JSDoc comment block directly above them (`@swagger` tags describing the endpoint, params, and responses), which `swagger-jsdoc` collects into the spec shown at `/api-docs` — an interactive page where anyone can see and even try every endpoint without reading a single route file.

### 11.11 If Your Backend Becomes TypeScript

This entire series is plain ESM JavaScript. If a backend built this way eventually adopts strict TypeScript, a few things need direct attention that don't just fall out of adding `.ts` extensions: typing `Request`/`Response` generics for `req.body`/`req.params` (`Request<ParamsType, ResponseBody, RequestBody>`), typing Mongoose documents and models (`mongoose.Document` interfaces, or a library like `zod-to-ts` to derive types directly from the Zod schemas in Section 6 — keeping runtime validation and compile-time types from drifting apart), and typing `req.user` (the auth middleware from Part 4 attaches this dynamically — under strict TS this needs an `Express.Request` interface augmentation via declaration merging). This is a real, non-trivial adjustment layer, not a mechanical find-and-replace — worth its own dedicated pass rather than something to bolt on casually.

---

## 12. Series Recap — What You've Built

Across five parts, you went from zero to a fully production-shaped Node/Express API, entirely in modern ES Modules — something none of Dave Gray's course, freeCodeCamp's curriculum, or John Smilga's repo currently teach end-to-end in this syntax:

- **Part 1:** Node.js core, ESM vs. CJS (and every gotcha in between), the event loop, async patterns, `EventEmitter`, streams, npm, and a raw HTTP server
- **Part 2:** Express, middleware, routing, `express.Router()`, the MVC pattern, a full in-memory REST API, real pagination, and file uploads with `multer`
- **Part 3:** MongoDB & Mongoose — schemas, validation, every controller rewritten against a real, persistent database, relationships via `populate()`, pagination wired into real queries, and migrations/backups with `migrate-mongo`
- **Part 4:** Full authentication — `bcrypt` hashing, JWT issuing/verification, protected routes, refresh token rotation with reuse detection, role- and ownership-based authorization, password reset and email verification, CSRF protection, and a fix for the cross-domain `sameSite` cookie bug
- **Part 5 (this part):** Centralized error handling, structured logging, Zod validation (including startup env validation), a health-check endpoint, layered security (helmet, sanitization, XSS awareness, Redis-backed rate limiting), deeper ESM-native testing, graceful shutdown, deployment, and a map of what lies beyond this series — Docker, CI/CD, dependency scanning, load testing, caching, job queues, versioning, observability, horizontal scaling, and API docs

This is, structurally, a complete backend engineering curriculum — every pattern here (MVC structure, Mongoose models, JWT auth, centralized errors, and now the production-hardening layer) transfers directly to any real MERN-stack project you build going forward.

If you want to keep going from here, a few natural next directions: WebSockets for real-time features, actually setting up the Docker/CI/observability pieces from Section 11 for a specific deployment target, or building an LLM-powered feature (RAG, tool use, agentic workflows) directly into an Express backend using something like the Vercel AI SDK. Let me know which direction is most useful next.
