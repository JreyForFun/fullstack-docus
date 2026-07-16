# The Modern Node.js & Express Course (ES Modules Edition)

### Part 3: MongoDB & Mongoose — Schemas, Models, Async CRUD

> Part 2 ended with a working REST API backed by an in-memory array — meaning every time you restart the server, your data vanishes. This part replaces that array with a real database: **MongoDB**, accessed through **Mongoose**. By the end, every controller function from Part 2 will be rewritten to perform genuine, persistent, async database operations.

### Part 3 Contents
1. What Is MongoDB? (NoSQL vs. SQL, Documents & Collections)
2. Getting a MongoDB Database (Atlas vs. Local)
3. Why Mongoose? (ODM Concept)
4. Environment Variables with `dotenv`
5. Connecting to MongoDB (ESM)
6. Schemas — Defining Your Data's Shape
7. Schema Validation, Defaults, and Options
8. Creating the Model
9. Async CRUD Operations — Rewriting the User API
10. Mongoose-Specific Error Handling
11. Relationships: `ref` and `.populate()`
12. Schema Middleware (Hooks) — Setting Up for Part 4
13. Multi-Document Transactions
14. Soft Deletes
15. Full-Text Search
16. Migrations & Backups
17. Part 3 Recap & What's Next

---

## 1. What Is MongoDB? (NoSQL vs. SQL, Documents & Collections)

Every database course eventually has to explain the SQL vs. NoSQL split, because it changes how you think about your data's shape.

**SQL databases** (PostgreSQL, MySQL) store data in **tables** with a **fixed schema** — every row in a `users` table has exactly the same columns. Relationships between tables are handled via foreign keys and JOINs.

**MongoDB** is a **NoSQL, document-oriented database**. Instead of tables and rows, you have:
- **Collections** (roughly equivalent to a table — e.g. a `users` collection)
- **Documents** (roughly equivalent to a row — but stored as **BSON**, a binary form of JSON, not rigid columns)

```js
// A single MongoDB document — literally looks like a JS object
{
  _id: ObjectId("64f1a2b3c4d5e6f7a8b9c0d1"),
  name: "Ada Lovelace",
  role: "admin",
  tags: ["mathematician", "programmer"],
  address: {
    city: "London",
    country: "UK"
  }
}
```

Key differences that matter practically:
- **No fixed columns.** Two documents in the same collection can technically have different fields (though in practice, Mongoose — Section 3 — reintroduces structure on top of this flexibility, which is exactly why it's used).
- **Nested data is natural.** The `address` field above is a nested object, stored directly in the document — no separate "addresses" table and JOIN required.
- **Every document gets a unique `_id`** automatically (an `ObjectId`, a 12-byte identifier) unless you explicitly provide your own.
- Relationships between collections (e.g. a `Post` belonging to a `User`) are modeled either by **embedding** (nesting one document inside another) or **referencing** (storing just the related document's `_id` and looking it up separately — covered in Section 11).

For a MERN-stack app, MongoDB pairs naturally with JavaScript because documents are structurally just JSON — there's no "translation layer" between what your JS code works with and what gets stored, unlike mapping JS objects onto rigid SQL tables.

---

## 2. Getting a MongoDB Database (Atlas vs. Local)

You have two practical options:

### Option A — MongoDB Atlas (cloud, recommended for learning and for most real projects)

[MongoDB Atlas](https://www.mongodb.com/cloud/atlas) is MongoDB's official managed cloud service, with a free tier ("M0 cluster") that's more than enough for development and small production apps.

1. Create a free Atlas account and a free (M0) cluster.
2. Under **Database Access**, create a database user with a username/password.
3. Under **Network Access**, allow your current IP (or `0.0.0.0/0` for development convenience — not recommended for production).
4. Under **Connect → Drivers**, copy your connection string — it looks like:

```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

### Option B — Local MongoDB (install on your own machine)

Install MongoDB Community Server for your OS, then your connection string is simply:

```
mongodb://localhost:27017/your-db-name
```

**For learning and for a real deployed project, Atlas is generally the better default** — it's free at small scale, requires no local install/maintenance, and matches how you'd actually deploy a production backend (your deployed Express server on a host like Render/Railway won't have "local MongoDB" available to it anyway — it needs a real network address, which is exactly what Atlas provides).

---

## 3. Why Mongoose? (ODM Concept)

MongoDB's native driver lets you talk to the database directly, but it gives you **zero structure** — you could accidentally insert a user with a typo'd field name and MongoDB would happily store it, no questions asked. **Mongoose** is an **ODM (Object-Document Mapper)** — it sits between your Express app and MongoDB, giving you:

- **Schemas** — define exactly what fields a document should have, their types, and validation rules
- **Models** — JS classes generated from a schema, giving you methods like `.find()`, `.create()`, `.findByIdAndUpdate()`
- **Validation** — reject bad data *before* it ever reaches the database
- **Type casting** — e.g. automatically converts a string `"42"` in `req.body` to a `Number` if the schema says the field should be a number
- **Middleware/hooks** — run code before/after saves, useful for things like password hashing (Part 4)
- **Population** — resolve references between documents (Section 11)

This is the direct MongoDB equivalent of what Express is to raw `http`: it doesn't replace MongoDB, it makes working with it dramatically more structured and convenient.

```bash
npm install mongoose
```

---

## 4. Environment Variables with `dotenv`

Your MongoDB connection string contains a **password** — it must never be hardcoded into a file you commit to git. The standard solution is a `.env` file plus the `dotenv` package.

```bash
npm install dotenv
```

```
# .env  (add this file to .gitignore — NEVER commit it)
MONGO_URI=mongodb+srv://youruser:yourpassword@cluster0.xxxxx.mongodb.net/nebula?retryWrites=true&w=majority
PORT=3000
```

```
# .gitignore
node_modules
.env
```

```js
// index.js — load env vars as the VERY FIRST thing that happens
import 'dotenv/config'; // ESM shorthand for loading and configuring dotenv immediately

import express from 'express';

const app = express();
console.log(process.env.MONGO_URI); // now accessible anywhere via process.env
```

The `import 'dotenv/config'` line is the modern ESM-friendly way to do what CJS tutorials write as `require('dotenv').config()`. It must be one of the very first lines executed in your entry file, before any code that needs `process.env` values (like your database connection, next section).

---

## 5. Connecting to MongoDB (ESM)

```js
// config/db.js
import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1); // fail fast — an API with no database is useless, don't limp along
  }
};
```

```js
// index.js
import 'dotenv/config';
import express from 'express';
import { connectDB } from './config/db.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Connect to the database, THEN start listening for requests
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
```

Notice the pattern: **connect to the database first, and only start the server listening once that succeeds.** If you `app.listen()` immediately without waiting for the DB connection, your server could start accepting requests before it's actually able to talk to the database — leading to confusing early failures.

`mongoose.connect()` returns a Promise, which is why `async/await` (Part 1, Section 8) fits naturally here.

---

## 6. Schemas — Defining Your Data's Shape

A **Schema** is Mongoose's blueprint for what a document in a given collection should look like.

```js
// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
});

const User = mongoose.model('User', userSchema);

export default User;
```

`mongoose.model('User', userSchema)` does two things: it tells Mongoose to use the collection named `users` (Mongoose automatically lowercases and pluralizes your model name — `'User'` → `users` collection), and it returns a **Model** class with built-in methods for querying and manipulating that collection.

---

## 7. Schema Validation, Defaults, and Options

### 7.1 Common Field Options

```js
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'], // custom error message
    trim: true,                                     // auto-strips whitespace
    minLength: 2,
    maxLength: 100,
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative'],
  },
  category: {
    type: String,
    enum: ['electronics', 'clothing', 'books'],       // must be one of these exact values
  },
  inStock: {
    type: Boolean,
    default: true,
  },
  tags: {
    type: [String],                                    // an array of strings
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
```

### 7.2 Schema-Level Options — Timestamps

```js
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
  },
  {
    timestamps: true, // auto-adds and auto-manages createdAt and updatedAt fields
  }
);
```

`timestamps: true` is worth using on nearly every schema — Mongoose automatically adds `createdAt` (set once, on creation) and `updatedAt` (refreshed on every save/update) without you writing any logic yourself.

### 7.3 Available Types Cheat Sheet

| Type | Example use |
|---|---|
| `String` | names, emails, descriptions |
| `Number` | prices, ages, counts |
| `Boolean` | flags like `isActive`, `inStock` |
| `Date` | timestamps, birthdates |
| `[String]` / `[Number]` / etc. | arrays of a primitive type |
| `mongoose.Schema.Types.ObjectId` | a reference to another document (Section 11) |
| nested object literal | an embedded sub-document (an `address: { city, country }` style field) |

---

## 8. Creating the Model

Continuing from Section 6 — once you have a schema, `mongoose.model()` compiles it into a usable Model:

```js
// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;
```

This `User` model is what you'll import into your controllers to perform every database operation — replacing the plain `import { users } from '../data/users.js'` array from Part 2 entirely.

---

## 9. Async CRUD Operations — Rewriting the User API

This is the direct payoff of this entire part: every controller function from Part 2, Section 10, rewritten against a real database.

### 9.1 Core Mongoose Query Methods

```js
await User.find();                      // get ALL documents in the collection
await User.find({ role: 'admin' });     // get documents matching a filter
await User.findById(id);                // get ONE document by its _id
await User.findOne({ email });          // get ONE document matching a filter

await User.create({ name, email });     // insert a new document

await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
// updates an existing document; { new: true } returns the UPDATED doc (default returns the OLD one);
// { runValidators: true } re-applies schema validation on the update (off by default!)

await User.findByIdAndDelete(id);       // deletes and returns the deleted document
```

### 9.2 The Full Rewritten Controller

```js
// controllers/userController.js
import User from '../models/User.js';

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;
    const newUser = await User.create({ name, email, role });
    res.status(201).json(newUser);
  } catch (err) {
    res.status(400).json({ error: err.message }); // 400 — likely a validation failure
  }
};

export const updateUser = async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(updatedUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted', user: deletedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
```

Compare this to Part 2, Section 10's in-memory version: the *shape* of every function is identical (find, find-one, create, update, delete, all wrapped in try/catch and returning appropriate status codes) — only the actual data access changed, from array methods (`.find()`, `.push()`, `.splice()`) to Mongoose queries. **This is the whole point of the MVC structure from Part 2** — swapping your data layer required touching *only* the controller file; your `routes/userRoutes.js` from Part 2 needs zero changes.

### 9.3 Wiring Up Real Pagination

Part 2, Section 13 covered *why* pagination matters and walked through the offset-based (`skip`/`limit`) pattern in detail, including capping `limit` server-side, returning pagination metadata, and indexing sorted/filtered fields — that explanation isn't repeated here. This is that exact pattern, wired into the real `getAllUsers` controller against the actual `User` model:

```js
export const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20); // capped, per Part 2, Section 13.1
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) filter.role = req.query.role; // ?role=admin

    const sortField = req.query.sort || '-createdAt';

    const [users, total] = await Promise.all([ // concurrent, per Part 1, Section 8.4
      User.find(filter).sort(sortField).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    res.json({
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
```

Part 2, Section 13.5 briefly mentioned cursor-based pagination as an alternative for feeds. Here's the fuller version, applied to a genuinely feed-shaped resource — a journal-entry timeline is a natural fit, since users scroll forward through entries chronologically rather than jumping to "page 7":

```js
export const getJournalEntriesFeed = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const cursor = req.query.cursor; // the _id of the last entry the client already has

    const filter = cursor ? { _id: { $lt: cursor } } : {};
    // relies on ObjectIds being roughly chronologically ordered by creation time

    const entries = await JournalEntry.find(filter).sort({ _id: -1 }).limit(limit);
    const nextCursor = entries.length === limit ? entries[entries.length - 1]._id : null;

    res.json({ data: entries, nextCursor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
```

Same rule of thumb as Part 2 left off with: offset pagination for admin tables where jumping to a specific page matters, cursor pagination for feeds and infinite scroll where it doesn't.

---

## 10. Mongoose-Specific Error Handling

Two error types come up constantly and are worth recognizing by name:

### 10.1 `ValidationError` — Schema Rules Violated

```js
// Triggered by things like a missing required field, or a value outside an `enum`
try {
  await User.create({ email: 'test@test.com' }); // missing required 'name'
} catch (err) {
  console.log(err.name); // 'ValidationError'
  console.log(err.errors); // an object detailing exactly which fields failed and why
}
```

### 10.2 `CastError` — Malformed `_id` or Wrong Type

```js
// Triggered when e.g. req.params.id isn't a valid MongoDB ObjectId format at all
try {
  await User.findById('not-a-valid-id');
} catch (err) {
  console.log(err.name); // 'CastError'
}
```

A more production-shaped version of the `getUserById` controller, distinguishing these cases:

```js
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};
```

*(Part 5 covers a cleaner, centralized way to handle this across every controller at once, rather than repeating these `if` checks everywhere.)*

---

## 11. Relationships: `ref` and `.populate()`

Real apps almost always have related data — e.g. a journal or diary app's entries each belong to a specific user. MongoDB has no JOINs, but Mongoose's `ref` + `.populate()` gives you the equivalent.

### 11.1 Defining a Reference

```js
// models/JournalEntry.js
import mongoose from 'mongoose';

const journalEntrySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    notes: { type: String },
    observedAt: { type: Date, default: Date.now },
    imageUrl: { type: String }, // just a stored file path/URL — the actual upload handling is Part 2, Section 6.7
    user: {
      type: mongoose.Schema.Types.ObjectId, // stores just the referenced document's _id
      ref: 'User',                          // tells Mongoose WHICH model this _id refers to
      required: true,
    },
  },
  { timestamps: true }
);

const JournalEntry = mongoose.model('JournalEntry', journalEntrySchema);
export default JournalEntry;
```

Note that the schema only ever stores a **string** — a file path or URL pointing at where the actual image lives on disk or in cloud storage. MongoDB documents are a poor fit for storing binary file data directly; the model's job is just to remember *where* the file is, while Express/`multer` (Part 2, Section 6.7) handles receiving and saving the actual upload.

### 11.2 Creating a Related Document

```js
await JournalEntry.create({
  title: 'Observed the Orion Nebula',
  notes: 'Clear skies, used the 8-inch reflector',
  user: someUserId, // just the ObjectId string/value
});
```

### 11.3 Resolving the Reference with `.populate()`

Without `.populate()`, querying a journal entry gives you just the raw `user` ObjectId — not the actual user data:

```js
const entry = await JournalEntry.findById(entryId);
console.log(entry.user); // just an ObjectId, e.g. "64f1a2b3c4d5e6f7a8b9c0d1"

const entryWithUser = await JournalEntry.findById(entryId).populate('user');
console.log(entryWithUser.user); // the FULL user document: { _id, name, email, role, ... }

// You can also select only specific fields to populate, to avoid leaking sensitive data:
const entrySafe = await JournalEntry.findById(entryId).populate('user', 'name email');
console.log(entrySafe.user); // only { _id, name, email } — no role, no password hash, etc.
```

`.populate()` runs a second query behind the scenes to "join" the referenced document's data into the result — conceptually similar to a SQL JOIN, though mechanically it's just Mongoose doing an extra lookup for you.

---

## 12. Schema Middleware (Hooks) — Setting Up for Part 4

Mongoose schemas support `pre` and `post` hooks — functions that run automatically before/after certain operations. The most important one you'll use immediately in Part 4 is hashing a password before saving a new user:

```js
// models/User.js — a preview of what Part 4 builds on directly
import mongoose from 'mongoose';
import bcrypt from 'bcrypt'; // installed and explained fully in Part 4

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // will be stored as a HASH, never plain text
  },
  { timestamps: true }
);

// Runs automatically before every .save() — NOT before findByIdAndUpdate, that's a separate gotcha
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next(); // skip re-hashing if password wasn't changed
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const User = mongoose.model('User', userSchema);
export default User;
```

This is just a preview — Part 4 explains `bcrypt`, salt rounds, and exactly why passwords must never be stored as plain text in full depth. The key thing to internalize now is *where* this logic lives: directly on the schema, so it runs automatically no matter which controller creates a user, rather than being logic you'd have to remember to call manually every time.

---

## 13. Multi-Document Transactions

Every write so far in this series has touched exactly one document at a time — a single `create`, a single `findByIdAndUpdate`. MongoDB guarantees that a write to a **single document** is always atomic: it either fully applies or doesn't happen at all, never half-applies. But plenty of real operations need to touch **more than one document, possibly across more than one collection**, as a single logical unit — and without special handling, a failure partway through leaves your data in an inconsistent state.

### 13.1 The Problem

Take a classic example: placing an order needs to (1) decrement a product's stock and (2) create an order record. Written naively:

```js
// WITHOUT a transaction — a real risk
export const placeOrder = async (req, res) => {
  const product = await Product.findById(req.body.productId);

  product.stock -= req.body.quantity;
  await product.save(); // succeeds — stock is now decremented

  // If the server crashes, the network drops, or this next line throws for ANY reason,
  // the stock has already been reduced but no order was ever recorded. The customer
  // was charged (or thinks they ordered something) and it's simply gone from the system.
  const order = await Order.create({
    product: product._id,
    quantity: req.body.quantity,
    user: req.user.userId,
  });

  res.status(201).json(order);
};
```

Each individual `.save()` and `.create()` call is atomic on its own — the risk is entirely in the gap *between* them.

### 13.2 Using a Session and `withTransaction`

MongoDB's multi-document transactions require the database to be running as a **replica set** — MongoDB Atlas clusters (Part 3, Section 2) are replica sets by default, even the free M0 tier, so this works with zero extra setup on Atlas. A local standalone `mongod` needs to be configured as a (single-node) replica set for transactions to work at all — worth knowing if this ever behaves differently locally than on Atlas.

```js
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import AppError from '../utils/AppError.js';

export const placeOrder = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    let createdOrder;

    await session.withTransaction(async () => {
      const product = await Product.findById(req.body.productId).session(session);

      if (!product || product.stock < req.body.quantity) {
        throw new AppError('Insufficient stock', 400); // throwing here aborts the ENTIRE transaction
      }

      product.stock -= req.body.quantity;
      await product.save({ session });

      [createdOrder] = await Order.create(
        [{ product: product._id, quantity: req.body.quantity, user: req.user.userId }],
        { session }
      );
    });

    res.status(201).json(createdOrder);
  } catch (err) {
    next(err);
  } finally {
    await session.endSession();
  }
};
```

Every operation inside the callback passed to `withTransaction` must explicitly pass `{ session }` (or `.session(session)` for queries) — this is what tells Mongoose "this operation belongs to the transaction," rather than running independently. If anything inside the callback throws, **the entire transaction rolls back** — the product's stock decrement is undone as if it never happened, exactly the guarantee the naive version above was missing. Note `Order.create([...], { session })` takes an *array* and returns an array when a session is passed — a small API quirk specific to using `create` transactionally.

### 13.3 When to Reach for This (and When Not To)

Transactions have a real performance cost, and add genuine complexity (session management, the array quirk above, retry logic for transient transaction errors in a full production implementation). Reach for them specifically when an operation has a **cross-document invariant that must never be violated** — stock and order records staying in sync, a balance transfer between two accounts, anything where "partially applied" is a real data-integrity bug, not just a cosmetic inconsistency. For the vast majority of single-document operations elsewhere in this series (updating a user's profile, creating a journal entry, deleting a comment), a transaction adds cost for no real benefit — plain single-document writes are already atomic on their own.

---

## 14. Soft Deletes

Every `deleteOne`/`findByIdAndDelete` call so far in this series performs a **hard delete** — the document is gone from the database permanently, immediately. For a lot of real data (user accounts, orders, published content), that's too aggressive: an accidental delete is unrecoverable, there's no audit trail of what existed before, and "undo" simply isn't possible. A **soft delete** marks a document as deleted without actually removing it, keeping the data recoverable and auditable while still hiding it from normal application use.

### 14.1 The Schema Field

```js
// models/Post.js
import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null }, // null = active, a real Date = soft-deleted
  },
  { timestamps: true }
);
```

### 14.2 Automatically Excluding Soft-Deleted Documents

The easy mistake with soft deletes is remembering to add `{ deletedAt: null }` to every single query by hand — miss it once, and a "deleted" document quietly reappears somewhere. A **query middleware hook** closes this gap by rewriting every find-style query automatically:

```js
// models/Post.js (continued)
postSchema.pre(/^find/, function (next) {
  // Applies to find, findOne, findById (which is findOne internally), etc. — the regex matches all of them
  this.where({ deletedAt: null });
  next();
});
```

```js
postSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

postSchema.methods.restore = function () {
  this.deletedAt = null;
  return this.save();
};

const Post = mongoose.model('Post', postSchema);
export default Post;
```

```js
// controllers/postController.js
export const deletePost = async (req, res) => {
  await req.resource.softDelete(); // req.resource comes from requireOwnership (Part 4, Section 12.2)
  res.status(204).send();
};
```

With the `pre(/^find/, ...)` hook in place, `Post.find()`, `Post.findById()`, and every other find-style query anywhere in the codebase automatically excludes soft-deleted posts — without every single controller needing to remember to filter for it.

### 14.3 Two Gotchas Worth Knowing Up Front

- **The hook doesn't cover everything.** Aggregation pipelines (`Post.aggregate([...])`) and raw `updateMany`/`deleteMany` calls bypass query middleware entirely — each of those needs its own explicit `{ deletedAt: null }` filter, or its own deliberate exception if it's meant to include deleted documents (an admin "view deleted posts" screen, for instance, which would call `Post.find({ deletedAt: { $ne: null } })` while temporarily bypassing the default via a separate un-hooked query path or a static method built for that purpose).
- **Unique fields need adjusting.** A `unique: true` field like `email` on a `User` schema still enforces uniqueness against soft-deleted documents by default — a soft-deleted account can permanently block a new signup with the same email, since the "deleted" row still physically exists and still holds the unique index. The real fix is a **partial unique index**, which only enforces uniqueness among *active* (non-deleted) documents:

```js
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
```

---

## 15. Full-Text Search

Every query in this series so far has matched on exact values or ranges (`{ role: 'admin' }`, `{ createdAt: { $gt: someDate } }`). Searching *inside* text content — "find every post whose title or body mentions 'nebula'" — needs a different kind of index entirely.

### 15.1 A Text Index

```js
// models/Article.js
import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
  },
  { timestamps: true }
);

articleSchema.index({ title: 'text', body: 'text' }); // a single combined text index across both fields

const Article = mongoose.model('Article', articleSchema);
export default Article;
```

### 15.2 Querying With `$text`

```js
export const searchArticles = async (req, res) => {
  const { q } = req.query;

  const articles = await Article.find(
    { $text: { $search: q } },
    { score: { $meta: 'textScore' } } // a relevance score MongoDB computes for the match
  ).sort({ score: { $meta: 'textScore' } }); // most relevant results first

  res.json(articles);
};
```

`$text` handles basic stemming (matching "running" against a search for "run") and ranks results by how well they match, ordered via the `textScore` metadata field — genuinely useful for a simple in-app search box with minimal setup.

### 15.3 Where a Plain Text Index Falls Short

MongoDB's built-in `$text` search is intentionally basic: no typo tolerance ("nebual" won't match "nebula"), no fine-grained relevance tuning, no faceted filtering combined with ranked search, and only one text index allowed per collection. For anything beyond a simple search box — an actual product/content search experience with autocomplete, typo-correction, and tunable ranking — the realistic options are **MongoDB Atlas Search** (built directly into Atlas, powered by Lucene under the hood, configurable via an aggregation `$search` stage without leaving your existing database) or a dedicated external search engine (Elasticsearch, Algolia, Meilisearch) that your app queries alongside MongoDB rather than instead of it. Atlas Search is usually the pragmatic first upgrade specifically because it requires no new infrastructure — it's a feature of the same Atlas cluster already in use throughout this series, not a separate service to provision and keep in sync.

---

## 16. Migrations & Backups

Everything so far has assumed the schema is right the first time. Real projects change shape constantly — a new required field, a renamed key, a data type that needs converting — and once real users have real documents in the collection, "just edit the schema file" doesn't retroactively fix documents that already exist. This is what migrations and backups solve, and Mongoose has no built-in answer for either — worth knowing upfront, since ORMs for SQL databases (Sequelize, Prisma) typically do.

### 13.1 Why Schema Changes Need Migrations

Say Part 4's `isVerified` field gets added to the `User` schema *after* real users have already registered. Every existing document in the collection simply doesn't have that field at all — Mongoose's `default: false` only applies to *documents created from now on*, not retroactively to what's already stored. Querying `User.find({ isVerified: false })` would miss every pre-existing user entirely, since `isVerified` isn't `false` for them, it's *absent*.

A **migration** is a small, version-controlled script that transforms existing data to match a schema change — run once, deliberately, the same way in every environment (your machine, a teammate's, staging, production), rather than as an ad-hoc query someone runs by hand and forgets to repeat elsewhere.

### 13.2 `migrate-mongo`

```bash
npm install -D migrate-mongo
npx migrate-mongo init
```

This scaffolds a `migrations/` folder and a config file pointing at your `MONGO_URI`. Each migration is a small file with an `up` (apply the change) and `down` (reverse it):

```js
// migrations/20260714120000-add-isverified-field.js
export const up = async (db) => {
  await db.collection('users').updateMany(
    { isVerified: { $exists: false } },
    { $set: { isVerified: false } }
  );
};

export const down = async (db) => {
  await db.collection('users').updateMany({}, { $unset: { isVerified: '' } });
};
```

```bash
npx migrate-mongo up      # applies every migration that hasn't run yet, in order
npx migrate-mongo down    # reverts the most recently applied one
npx migrate-mongo status  # shows which migrations have and haven't run
```

`migrate-mongo` tracks which migrations have already been applied in a dedicated collection in your own database, so running `up` again is safe — already-applied migrations are simply skipped. This is the piece that makes "the same schema change, applied consistently everywhere" actually true: run it locally, commit the migration file, and the exact same script runs in staging and production later, rather than someone reconstructing the change from memory.

### 13.3 Backups — What Atlas Does and Doesn't Give You For Free

This is worth stating plainly, since it's easy to assume otherwise: **MongoDB Atlas's free M0 tier (Part 3, Section 2) does not include automated backups.** If your only copy of the data lives on an M0 cluster and something goes wrong — a bad migration, an accidental `deleteMany({})` with no filter, a compromised credential — there is no built-in "restore to yesterday" button waiting for you.

Paid Atlas tiers (M10 and above) include **continuous cloud backups** with point-in-time restore, configurable directly in the Atlas dashboard — the practical reason many real projects upgrade off the free tier well before they need the extra compute.

For anything on the free tier, or for an extra layer of safety regardless of tier, MongoDB's own CLI tools handle manual backups:

```bash
mongodump --uri="mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/nebula" --out=./backup-2026-07-14
mongorestore --uri="mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/nebula" ./backup-2026-07-14/nebula
```

`mongodump` exports every collection to local files; `mongorestore` loads them back in. Scheduling `mongodump` on a cron job (or a scheduled GitHub Action) writing to separate cloud storage is a reasonable, low-effort safety net for a project that isn't yet paying for Atlas's built-in backups — worth setting up before you actually need it, not after.

---

## 17. Part 3 Recap & What's Next

- ✅ MongoDB's document/collection model vs. traditional SQL tables
- ✅ Getting a real database via MongoDB Atlas (or local)
- ✅ Why Mongoose exists — schemas, models, validation, and casting on top of raw MongoDB
- ✅ Securing your connection string with `dotenv` and `.env` (never committed to git)
- ✅ Connecting to MongoDB properly — awaiting the connection before `app.listen()`
- ✅ Defining schemas: types, `required`, `unique`, `enum`, `default`, `timestamps`
- ✅ Every CRUD controller from Part 2 rewritten against real, persistent Mongoose queries
- ✅ Offset-based pagination (`.skip()`/`.limit()`) for admin-style paginated lists, and cursor-based pagination for feeds/infinite scroll — and when to reach for each
- ✅ Recognizing `ValidationError` vs. `CastError`
- ✅ Modeling relationships with `ref` + `.populate()` — directly relevant to any users ↔ owned-content structure, like the journal entries used as an example throughout this part
- ✅ A first look at `pre('save')` hooks, setting up directly for Part 4's password hashing
- ✅ Multi-document transactions (`session.withTransaction()`) for operations with a real cross-document invariant, like keeping stock and order records in sync
- ✅ Soft deletes — a `deletedAt` field, a query middleware hook that filters them out automatically, and the partial-unique-index gotcha for fields like `email`
- ✅ Full-text search with a `$text` index, and when to graduate to Atlas Search or a dedicated search engine instead
- ✅ Migrations with `migrate-mongo` for evolving a schema without leaving existing documents stale, and the honest gap in MongoDB Atlas's free tier around automated backups (plus `mongodump`/`mongorestore` as the manual fallback)

**Part 4** is authentication: the difference between session-based and JWT-based auth (and why JWT is the standard for APIs like this one), hashing passwords properly with `bcrypt`, issuing and verifying JSON Web Tokens, protecting routes with auth middleware, refresh tokens, and finally role-based authorization (the `admin` vs. `user` distinction your schema already has sitting right there, unused, waiting for Part 4 to make it mean something).

Ready for Part 4?
