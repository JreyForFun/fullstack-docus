# The Modern Node.js & Express Course (ES Modules Edition)

### Part 4: Authentication — Sessions vs. JWT, Hashing, Protected Routes, Roles

> Part 3 gave your `User` model a `password` field and a `pre('save')` hook that hashes it — but nothing yet *uses* that. This part builds the full authentication system: registering users securely, logging in, issuing and verifying JSON Web Tokens, protecting routes so only logged-in users can reach them, refresh tokens for staying logged in safely, and finally role-based authorization — making that `role: 'admin' | 'user'` field from Part 3 actually mean something.

### Part 4 Contents
1. Sessions vs. JWT — Two Ways to "Stay Logged In"
2. Password Hashing with `bcrypt`
3. Registration — Building It Properly
4. JSON Web Tokens: Structure and Signing
5. Login — Verifying Credentials & Issuing a Token
6. Protecting Routes — Auth Middleware
7. Access Tokens vs. Refresh Tokens
8. Implementing the Refresh Flow
9. Logout
10. Password Reset & Email Verification
11. CSRF Protection
12. Role-Based and Ownership-Based Authorization
13. Account Lockout After Repeated Failed Logins
14. Session Management — Active Devices & "Log Out Everywhere"
15. Multi-Factor Authentication (TOTP)
16. OAuth / Social Login
17. Full Auth System, Assembled
18. Common Auth Mistakes to Avoid
19. Part 4 Recap & What's Next

---

## 1. Sessions vs. JWT — Two Ways to "Stay Logged In"

HTTP is **stateless** — every request is independent, with no memory of previous requests. So "staying logged in" across multiple requests requires the server (or client) to hold onto *some* proof of identity between requests. There are two dominant approaches:

### 1.1 Session-Based Auth (the traditional approach)

1. User logs in with email/password.
2. Server creates a **session** record (often stored in memory, Redis, or a DB) and sends the client a **session ID** in a cookie.
3. On every subsequent request, the browser automatically sends that cookie back.
4. Server looks up the session ID in its session store to figure out who's making the request.

This requires the server to keep **state** — a session store somewhere, that must be checked on every request. This is why it's called "stateful" auth.

### 1.2 JWT-Based Auth (the modern default for APIs)

1. User logs in with email/password.
2. Server verifies credentials and issues a **JSON Web Token (JWT)** — a signed, self-contained piece of data encoding *who the user is*.
3. Client stores that token and sends it with every subsequent request (typically in an `Authorization: Bearer <token>` header).
4. Server **verifies the token's signature** on each request — no database or session store lookup needed to know who's asking, because the token itself carries that information, cryptographically signed so it can't be tampered with.

This is "stateless" auth — the server doesn't need to store anything about active sessions; the token itself is proof. This is why **JWT is the standard choice for REST APIs**, especially ones with a separate frontend (a React client talking to an Express API, for instance) or multiple clients (web + mobile) sharing one backend.

### 1.3 Which Should You Use?

| | Sessions | JWT |
|---|---|---|
| Server needs to store state? | Yes (session store) | No (self-contained token) |
| Scales across multiple servers easily? | Needs shared session store (e.g. Redis) | Yes, naturally — any server can verify the token |
| Revoking access immediately | Easy — just delete the session | Harder — a valid JWT stays valid until it expires (mitigated with short expiry + refresh tokens, Section 7) |
| Typical use case | Traditional server-rendered websites | REST APIs, SPAs, mobile apps |

**This series uses JWT**, matching Dave Gray's Chapter 11 and the standard approach for a MERN-stack API.

---

## 2. Password Hashing with `bcrypt`

**Never store plain-text passwords.** If your database is ever breached, plain-text passwords hand attackers every user's actual password directly — and because people reuse passwords across sites, that damage extends far beyond your app.

```bash
npm install bcrypt
```

### 2.1 Hashing — One-Way, Irreversible

```js
import bcrypt from 'bcrypt';

const plainPassword = 'mySecret123';
const saltRounds = 10; // cost factor — higher = slower to compute = more resistant to brute-force

const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
console.log(hashedPassword);
// e.g. '$2b$10$N9qo8uLOickgx2ZMRZoMy...'
```

A **hash** is a one-way transformation — you cannot reverse a bcrypt hash back into the original password (unlike encryption, which is reversible with the right key). This is exactly the property you want: even if your database leaks, the actual passwords aren't recoverable.

The **salt** (baked automatically into `bcrypt.hash()`) is random data mixed into each password before hashing, which ensures two users with the identical password `"password123"` get *completely different* stored hashes — preventing precomputed "rainbow table" attacks.

### 2.2 Comparing — Verifying a Login Attempt

You never "un-hash" a password to check it. Instead, you hash the *login attempt* the same way and compare the two hashes:

```js
const isMatch = await bcrypt.compare(plainPasswordAttempt, hashedPasswordFromDB);
// true if they match, false if not
```

### 2.3 Where This Lives — Recall Part 3's `pre('save')` Hook

```js
// models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false }, // see note below
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Instance method — callable on any fetched user document as user.comparePassword(...)
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
```

`select: false` on the `password` field tells Mongoose to **exclude it from query results by default** — so a plain `User.find()` never accidentally leaks password hashes to your API responses. When you specifically need it (like during login, to compare), you opt back in explicitly: `User.findOne({ email }).select('+password')`.

`userSchema.methods.comparePassword` defines a **custom instance method** — any document fetched from this model can call `.comparePassword(attempt)` directly, keeping the bcrypt logic colocated with the model rather than scattered across controllers.

---

## 3. Registration — Building It Properly

```js
// controllers/authController.js
import User from '../models/User.js';

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already in use' }); // 409 Conflict
    }

    const newUser = await User.create({ name, email, password }); // password gets hashed by the pre('save') hook automatically

    res.status(201).json({
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      // deliberately NOT sending back the password hash, even though select:false already hides it by default
    });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
};
```

Note the explicit response shape at the end — even though `select: false` already excludes the password from normal queries, being deliberate about *exactly* which fields go back to the client is good practice, especially as your schema grows more fields over time.

---

## 4. JSON Web Tokens: Structure and Signing

A JWT is a string made of **three Base64-encoded parts, separated by dots**:

```
header.payload.signature
```

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NGYxIiwicm9sZSI6ImFkbWluIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

- **Header** — metadata: which algorithm was used to sign it (e.g. `HS256`).
- **Payload** — the actual data you encode (e.g. `{ userId, role }`). **This is readable by anyone** who has the token — Base64 is *encoding*, not encryption. Never put secrets (passwords, sensitive PII) in a JWT payload.
- **Signature** — computed from the header + payload + a **secret key** only the server knows. This is what makes the token tamper-proof: if anyone modifies the payload (e.g. changes `"role": "user"` to `"role": "admin"`), the signature no longer matches, and verification fails.

```bash
npm install jsonwebtoken
```

### 4.1 Signing a Token

```js
import jwt from 'jsonwebtoken';

const payload = { userId: user._id, role: user.role };

const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
```

`process.env.JWT_SECRET` should be a long, random string, stored in `.env` (never committed), e.g.:

```
JWT_SECRET=a9f8c7e6b5d4a3f2e1d0c9b8a7f6e5d4c3b2a1f0
```

`expiresIn: '15m'` sets the token's lifetime. **Short expiry is intentional** — it limits how long a stolen token remains useful (more on this in Section 7's refresh token pattern).

### 4.2 Verifying a Token

```js
import jwt from 'jsonwebtoken';

try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log(decoded); // { userId: '...', role: '...', iat: ..., exp: ... }
} catch (err) {
  console.log(err.name); // 'TokenExpiredError' or 'JsonWebTokenError' (invalid signature)
}
```

`jwt.verify()` throws if the signature doesn't match (meaning it was tampered with or signed with a different secret) or if the token has expired. `iat` (issued-at) and `exp` (expiry) are automatically embedded timestamps.

---

## 5. Login — Verifying Credentials & Issuing a Token

```js
// controllers/authController.js (continued)
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Explicitly select password since the schema hides it by default (select: false)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' }); // deliberately vague — see Section 18
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' }); // SAME message as above, on purpose
    }

    const accessToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      accessToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
};
```

Notice the identical `'Invalid credentials'` message whether the email doesn't exist *or* the password is wrong. This is deliberate (expanded on in Section 18) — telling an attacker "that email doesn't exist" vs. "that password is wrong" leaks information about which emails are registered in your system.

---

## 6. Protecting Routes — Auth Middleware

Recall Part 2's middleware pattern: a function of `(req, res, next)` that can inspect/reject a request before it reaches the route handler. Auth middleware is the canonical use case.

```js
// middleware/authMiddleware.js
import jwt from 'jsonwebtoken';

export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization; // e.g. "Bearer eyJhbGc..."

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1]; // strip off the "Bearer " prefix

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach { userId, role } to req, available in every downstream handler
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

```js
// routes/userRoutes.js
import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getAllUsers } from '../controllers/userController.js';

const router = Router();

router.get('/', protect, getAllUsers); // now requires a valid token to reach getAllUsers

export default router;
```

Recall Part 1, Section 13.3: **`401 Unauthorized`** is the correct status for "we don't know who you are" — exactly what every branch of this middleware returns. The client sends the token via the `Authorization` header on every subsequent request:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 7. Access Tokens vs. Refresh Tokens

A 15-minute-lived access token is great for security (a leaked token stops working fast) but terrible for user experience if it means re-logging-in every 15 minutes. The standard fix is a **two-token system**:

| | Access Token | Refresh Token |
|---|---|---|
| Lifespan | Short (minutes) | Long (days/weeks) |
| Sent on | Every API request (`Authorization` header) | Only to the token-refresh endpoint |
| Storage (client) | In memory / app state | `httpOnly` cookie (not accessible to JS — mitigates XSS theft) |
| Purpose | Prove identity for a request | Get a *new* access token without re-entering credentials |

The refresh token being stored in an **`httpOnly` cookie** matters: JavaScript running in the browser (including malicious injected scripts, in an XSS attack) cannot read `httpOnly` cookies at all — only the browser automatically attaches them to requests. This is a meaningfully safer place to keep a long-lived credential than `localStorage`, which any script on the page can read freely.

```bash
npm install cookie-parser
```

```js
// index.js
import cookieParser from 'cookie-parser';
app.use(cookieParser()); // lets Express read cookies via req.cookies
```

### 7.1 A Correctness Note: `sameSite` and Cross-Domain Deployments

Every cookie example through the rest of this part uses a shared helper rather than the flat `sameSite: 'strict'` you might expect — worth explaining why up front, since it's a real bug if skipped.

`sameSite: 'strict'` is correct and safest **when your frontend and backend live on the same registrable domain** — which includes `localhost` during development, since browsers treat different `localhost` ports as same-site for this purpose. It silently breaks the moment you deploy your React frontend and Express backend to two separate domains (e.g. `nebula-app.vercel.app` and `nebula-api.onrender.com`, following Part 5's own deployment guidance). `sameSite: 'strict'` — and even `'lax'` — blocks the browser from attaching the cookie to any cross-*site* request at all, and every request from a Vercel-hosted frontend to a Render-hosted backend is exactly that. Login would still appear to work (the access token comes back in the JSON body, not a cookie), but the refresh cookie would never actually reach the server: silent refresh would fail, and users would get logged out roughly every 15 minutes with no visible error anywhere in the logs.

The fix is one shared helper, driven by environment, used everywhere a cookie is set or cleared:

```js
// utils/cookieOptions.js
export const refreshCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd, // 'none' below requires this to be true whenever it's actually in use
    sameSite: isProd ? 'none' : 'lax', // 'lax' works fine over plain HTTP for same-site localhost dev
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
};
```

One consequence worth being explicit about: once `sameSite` is `'none'` in production, the cookie is no longer protected by the browser's same-site rule at all — at that point, the origin-checking `verifyOrigin` middleware (Section 11) stops being a defense-in-depth extra and becomes the **primary** CSRF defense for the refresh/logout routes. Confirm it's actually applied there before deploying cross-domain — Section 11 revisits this directly.

---

## 8. Implementing the Refresh Flow

### 8.1 Why a Bare Refresh Token Isn't Enough

The refresh flow as described in Section 7 has a real weakness: the refresh token is a signed JWT the server never keeps a record of. As long as its signature checks out and it hasn't expired, `jwt.verify()` accepts it — for the *entire* 7-day window. If a refresh token is ever copied (a leaked cookie, a compromised device), it stays fully usable for up to 7 days with no way to shut it down individually, and no way to even detect that a copy is being used.

The standard fix is **rotation with reuse detection**: every time a refresh token is used, it's immediately invalidated and replaced with a new one — so a stolen token only works exactly once, for exactly as long as it takes the legitimate rotation to happen. And critically: if a token that's already been rotated out ever shows up again, that's a direct signal the token leaked — not a normal usage pattern — and the server responds by revoking every session for that user at once.

This requires the server to actually track issued tokens, rather than trusting the JWT signature alone.

### 8.2 A `RefreshToken` Model

```js
// models/RefreshToken.js
import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true }, // SHA-256 hash — never store the raw token
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('RefreshToken', refreshTokenSchema);
```

```js
// utils/hashToken.js
import crypto from 'node:crypto';

export const hashToken = (rawToken) => crypto.createHash('sha256').update(rawToken).digest('hex');
```

Same principle as Part 4, Section 10.2's password-reset tokens: store a hash, not the raw value, so a database leak alone doesn't hand out working credentials.

### 8.3 Issuing Tokens on Login

```js
// controllers/authController.js — login, now tracking the refresh token
import RefreshToken from '../models/RefreshToken.js';
import { hashToken } from '../utils/hashToken.js';
import { refreshCookieOptions } from '../utils/cookieOptions.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    await RefreshToken.create({
      user: user._id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.cookie('refreshToken', refreshToken, refreshCookieOptions());

    res.json({
      accessToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
};
```

### 8.4 Refresh: Rotate on Every Use, Detect Reuse

```js
// controllers/authController.js
export const refresh = async (req, res) => {
  const incomingToken = req.cookies.refreshToken;
  if (!incomingToken) {
    return res.status(401).json({ error: 'No refresh token provided' });
  }

  try {
    const decoded = jwt.verify(incomingToken, process.env.JWT_REFRESH_SECRET);
    const incomingHash = hashToken(incomingToken);

    const storedToken = await RefreshToken.findOne({ user: decoded.userId, tokenHash: incomingHash });

    if (!storedToken) {
      // Valid signature, but no matching record at all — never issued by us, or already cleaned up.
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (storedToken.revoked) {
      // This exact token was already rotated out once before. Its reappearance means it leaked
      // and is being replayed — not a normal usage pattern. Revoke every session for this user.
      await RefreshToken.updateMany({ user: decoded.userId }, { revoked: true });
      res.clearCookie('refreshToken', refreshCookieOptions());
      return res.status(401).json({ error: 'Refresh token reuse detected — all sessions revoked' });
    }

    // Valid and unused — rotate: revoke this one, issue a brand new access/refresh pair
    storedToken.revoked = true;
    await storedToken.save();

    const newAccessToken = jwt.sign(
      { userId: decoded.userId },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    const newRefreshToken = jwt.sign(
      { userId: decoded.userId },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    await RefreshToken.create({
      user: decoded.userId,
      tokenHash: hashToken(newRefreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.cookie('refreshToken', newRefreshToken, refreshCookieOptions());
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};
```

Note that expired/rotated-out documents are marked `revoked: true` rather than deleted — that record is exactly what makes reuse detection possible. (A scheduled cleanup job deleting documents well past their `expiresAt` is reasonable for housekeeping, but never delete a `revoked` document immediately, or the reuse check above has nothing to compare against.)

### 8.5 Wiring the Routes

```js
// routes/authRoutes.js
import { Router } from 'express';
import { register, login, refresh, logout } from '../controllers/authController.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

export default router;
```

The typical frontend flow: keep the access token in memory (e.g. React state or context — not `localStorage`, for the same XSS-exposure reason as the refresh token). When an API call fails with a `401` because the access token expired, silently call `/auth/refresh` (the browser sends the `httpOnly` cookie automatically), get a new access token, and retry the original request — the user never notices, and every silent refresh now transparently rotates the underlying token too.

---

## 9. Logout

```js
// controllers/authController.js
import RefreshToken from '../models/RefreshToken.js';
import { hashToken } from '../utils/hashToken.js';
import { refreshCookieOptions } from '../utils/cookieOptions.js';

export const logout = async (req, res) => {
  const incomingToken = req.cookies.refreshToken;
  if (incomingToken) {
    await RefreshToken.updateOne({ tokenHash: hashToken(incomingToken) }, { revoked: true });
  }
  res.clearCookie('refreshToken', refreshCookieOptions());
  res.json({ message: 'Logged out successfully' });
};
```

Earlier framings of JWT logout note that the *access* token can't be individually revoked — it's stateless and self-verifying, so it simply remains valid until it naturally expires (which is exactly why its lifespan is kept to 15 minutes). That's still true here. But the `RefreshToken` collection from Section 8 changes the picture for everything downstream of logout: marking the current refresh token `revoked` means it can never be used again, even if a copy of the cookie exists somewhere — and Section 8.4's reuse-detection check means presenting it again doesn't just fail quietly, it actively revokes every other session for that user too.

---

## 10. Password Reset & Email Verification

Two flows every real app needs that a bare login/register system doesn't give you: letting a user recover access after forgetting their password, and confirming that the email address they registered with actually belongs to them. Both follow the same underlying pattern — generate a random, single-use, time-limited token; store only a **hashed** version of it; email the **raw** version to the user; verify by re-hashing whatever they send back and comparing it against the stored hash.

### 10.1 Extending the User Schema

```js
// models/User.js — additional fields
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String, select: false },
    verificationTokenExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true }
);
```

`select: false` on every token field (the same pattern as `password` itself) keeps them out of normal query results — these are just as sensitive as the password, since anyone holding a valid raw token can take over the account.

### 10.2 Why Hash the Token Before Storing It?

Storing the **raw** token in the database means that if your database ever leaks (an exposed backup, an injection attack), every currently-unused reset/verification token leaks with it — each one a live, working account-takeover credential until it naturally expires. Hashing it instead (a plain SHA-256 hash is sufficient here — these tokens are already long and random, unlike passwords, so they don't need bcrypt's deliberate slowness) means a database leak alone isn't enough to use them; the raw token, which only ever went out over email, is still required.

```js
// utils/generateToken.js
import crypto from 'node:crypto';

export const generateToken = () => {
  const rawToken = crypto.randomBytes(32).toString('hex'); // emailed to the user, never stored
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex'); // stored in the DB
  return { rawToken, hashedToken };
};
```

### 10.3 Sending Email — `nodemailer`

```bash
npm install nodemailer
```

```js
// utils/sendEmail.js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
};
```

`nodemailer` works with any SMTP provider. For development, a sandbox service like Mailtrap catches emails without really sending them, which is useful for testing this flow safely. In production, transactional-email providers (SendGrid, Resend, Postmark, AWS SES) all issue SMTP credentials that plug directly into this same setup — no code changes, just different `.env` values.

### 10.4 Forgot Password → Reset Password Flow

```js
// controllers/authController.js
import crypto from 'node:crypto';
import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';
import { sendEmail } from '../utils/sendEmail.js';
import catchAsync from '../utils/catchAsync.js'; // built properly in Part 5 — eliminates repeated try/catch, previewed here

export const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // Respond identically whether the user exists or not — otherwise this endpoint becomes
  // a way to check which emails are registered, the same principle as Section 5's login errors
  if (!user) {
    return res.json({ message: 'If that email is registered, a reset link has been sent' });
  }

  const { rawToken, hashedToken } = generateToken();
  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15-minute window
  await user.save();

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;
  await sendEmail({
    to: user.email,
    subject: 'Password Reset Request',
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 15 minutes.</p>`,
  });

  res.json({ message: 'If that email is registered, a reset link has been sent' });
});

export const resetPassword = catchAsync(async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }, // must not be expired
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    return res.status(400).json({ error: 'Token is invalid or has expired' });
  }

  user.password = newPassword; // re-hashed automatically by the pre('save') hook (Part 3, Section 12)
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  res.json({ message: 'Password reset successful. Please log in.' });
});
```

Two details worth internalizing:
- **The response is identical whether the email exists or not.** Same principle as Section 5's login errors — an attacker probing `/forgot-password` with random emails shouldn't be able to tell which ones belong to real accounts.
- **The token is looked up, not decrypted.** Because it's a hash, there's no way to reverse it — you hash whatever the user submits and query for a matching stored hash, conceptually identical to `bcrypt.compare`, just with a cheaper hash function appropriate for random tokens rather than human-chosen passwords.

### 10.5 Email Verification, Same Pattern

```js
export const sendVerificationEmail = catchAsync(async (req, res) => {
  const dbUser = await User.findById(req.user.userId); // req.user comes from the `protect` middleware

  const { rawToken, hashedToken } = generateToken();
  dbUser.verificationToken = hashedToken;
  dbUser.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24-hour window
  await dbUser.save();

  const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${rawToken}`;
  await sendEmail({
    to: dbUser.email,
    subject: 'Verify your email',
    html: `<p>Click <a href="${verifyUrl}">here</a> to verify your email address.</p>`,
  });

  res.json({ message: 'Verification email sent' });
});

export const verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.params;
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    verificationToken: hashedToken,
    verificationTokenExpires: { $gt: Date.now() },
  }).select('+verificationToken +verificationTokenExpires');

  if (!user) {
    return res.status(400).json({ error: 'Token is invalid or has expired' });
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpires = undefined;
  await user.save();

  res.json({ message: 'Email verified successfully' });
});
```

```js
// routes/authRoutes.js — additions
router.post('/forgot-password', forgotPassword);
router.patch('/reset-password/:token', resetPassword);
router.post('/send-verification', protect, sendVerificationEmail);
router.patch('/verify-email/:token', verifyEmail);
```

Whether to *require* `isVerified: true` before granting full app access (checked inside `protect`, or as a separate `requireVerified` middleware) is a product decision — some apps block unverified users entirely, others just show a "please verify your email" banner and let them use the app in the meantime. Either way, the schema fields and the flow to set them are now in place.

---

## 11. CSRF Protection

**CSRF (Cross-Site Request Forgery)** exploits a specific browser behavior: cookies are attached to a request automatically by the browser, regardless of which site's page triggered that request. If a malicious site gets a logged-in user's browser to submit a form or fetch request to your API, the browser happily attaches your cookies — including the refresh-token cookie from Section 8 — making the malicious request look legitimate to your server.

### 11.1 Why This System Is Already Partly Protected

It's worth being precise about *where* the actual exposure is, rather than treating "add CSRF protection" as one blanket instruction applied everywhere:

- **Your access token** (Section 6) is sent via a manually-set `Authorization` header, not a cookie. A malicious site's JavaScript **cannot** read your app's in-memory access token or attach an `Authorization` header to a cross-site request on your behalf. Every route protected by `protect` alone is already structurally immune to classic CSRF.
- **Your refresh token** (Section 8) *is* a cookie, and cookies **are** attached automatically cross-site — this is the actual exposure surface. In local development, it's narrowed by `sameSite: 'lax'` (Section 7.1's `refreshCookieOptions()`), which blocks the cookie from being sent on most cross-site requests. **In a cross-domain production deployment, that same helper switches to `sameSite: 'none'`** — which sends the cookie on cross-site requests by design, since your frontend and backend are, from the browser's point of view, different sites. This is exactly why the origin-check middleware below isn't optional once you're deployed cross-domain: it's the thing actually doing the CSRF-blocking work that `sameSite` was doing for you in development.

### 11.2 Defense in Depth — An Origin-Checking Middleware

`sameSite` is enforced by the browser, not your server — reliable in development, but no longer doing any CSRF-blocking work at all once it's `'none'` in a cross-domain production deployment (Section 7.1). A server-side check is what actually closes that gap:

```js
// middleware/csrfProtection.js
export const verifyOrigin = (req, res, next) => {
  // Only state-changing methods matter for CSRF — a GET request shouldn't change anything anyway
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin || req.headers.referer;

  if (!origin || !origin.startsWith(process.env.CLIENT_URL)) {
    return res.status(403).json({ error: 'Request origin could not be verified' });
  }

  next();
};
```

```js
// routes/authRoutes.js
import { verifyOrigin } from '../middleware/csrfProtection.js';

router.post('/refresh', verifyOrigin, refresh); // the routes that actually read the cookie
router.post('/logout', verifyOrigin, logout);
```

This checks that the request's declared `Origin` (falling back to `Referer`, since some requests omit `Origin`) actually matches your own frontend's URL. A cross-site attacker's page has a different origin, and — critically — the browser sets this header itself, so the attacker's JavaScript cannot fake or override it.

### 11.3 If You Need the Classic Double-Submit-Cookie Pattern

The once-standard `csurf` npm package is now deprecated and unmaintained. If a specific project requirement calls for the traditional double-submit pattern (a CSRF token embedded in the page and echoed back in a request header, matched against a second cookie-stored copy), use a currently-maintained library such as `csrf-csrf` rather than `csurf`. For most JWT-based APIs like this one — where the only cookie in play is the narrowly-scoped refresh token, not a general session cookie — the origin-check middleware above, layered on top of whatever `sameSite` protection the deployment topology allows (Section 7.1), is proportionate protection without adding a whole separate token-echo system.

---

## 12. Role-Based and Ownership-Based Authorization

**Authentication** answers "who are you?" **Authorization** answers "are you allowed to do this?" — recall Part 1, Section 13.3's `401` vs. `403` distinction; this section is where `403` finally gets used.

### 12.1 Role-Based Authorization

```js
// middleware/authMiddleware.js (continued)
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }
    next();
  };
};
```

This is a **middleware factory** — `authorize(...)` is a function that *returns* a middleware function, letting you configure which roles are allowed per-route:

```js
// routes/userRoutes.js
import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { getAllUsers, deleteUser } from '../controllers/userController.js';

const router = Router();

// Any logged-in user can view the list
router.get('/', protect, getAllUsers);

// Only logged-in users with role 'admin' can delete
router.delete('/:id', protect, authorize('admin'), deleteUser);

export default router;
```

`protect` must run **before** `authorize` — `authorize` depends on `req.user` already being set by `protect`. Middleware order (Part 2, Section 5.3) matters just as much here as anywhere else.

### 12.2 Ownership-Based Authorization

Role-based checks answer "what *kind* of user are you" — but a huge share of real authorization bugs live in a different question entirely: **is this specifically *your* resource?** `authorize('admin')` says nothing about whether a plain `user` role should be allowed to edit their own post but not someone else's. Without an explicit check, a logged-in `user` can call `DELETE /api/posts/507f...` with *any* valid post ID — including one belonging to a different user — and the request succeeds, because `protect` only confirms *a* valid user is logged in, not that they own the specific document being touched.

```js
// middleware/authMiddleware.js (continued)
export const requireOwnership = (Model, paramName = 'id') => {
  return async (req, res, next) => {
    const resource = await Model.findById(req.params[paramName]);

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    if (req.user.role === 'admin') {
      req.resource = resource; // admins bypass the ownership check entirely
      return next();
    }

    if (resource.user.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'You do not have permission to modify this resource' });
    }

    req.resource = resource; // stash it — avoids a second identical DB fetch inside the controller
    next();
  };
};
```

```js
// routes/postRoutes.js
import { Router } from 'express';
import { protect, requireOwnership } from '../middleware/authMiddleware.js';
import Post from '../models/Post.js';
import { updatePost, deletePost } from '../controllers/postController.js';

const router = Router();

router.put('/:id', protect, requireOwnership(Post), updatePost);
router.delete('/:id', protect, requireOwnership(Post), deletePost);

export default router;
```

This is a **middleware factory** just like `authorize`, but parameterized by *which Mongoose model* owns the resource, so the same function covers blog posts, comments, uploaded files, or any other resource shaped like `{ user: ObjectId, ... }` (Part 3, Section 11.1 — and Part 3, Section 14's `Post` model is exactly this shape). Because it fetches the document and attaches it to `req.resource`, the controller itself doesn't need to query for it again:

```js
// controllers/postController.js
export const deletePost = async (req, res) => {
  await req.resource.deleteOne(); // req.resource was already fetched and ownership-checked by the middleware
  res.status(204).send();
};
```

Note the ordering in the route: `protect` first (so `req.user` exists), then `requireOwnership` (which needs `req.user.userId` to compare against). This is exactly the same "middleware order matters" principle as `authorize`, just with a data-dependent check rather than a static role list.

---

## 13. Account Lockout After Repeated Failed Logins

Part 5's rate limiter (Section 7.2) caps login attempts *per IP address* — effective against a single attacker hammering `/login` from one machine, but it does nothing against a distributed attack (many IPs, each trying a handful of times) or a slow, patient attacker spacing attempts out to stay under the rate-limit window. **Account lockout** is a complementary, orthogonal defense: it tracks failed attempts *per account*, regardless of which IP they came from.

### 13.1 Extending the User Schema

```js
// models/User.js — additional fields
const userSchema = new mongoose.Schema(
  {
    // ...existing fields...
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);
```

### 13.2 Checking and Updating Lock State on Login

```js
// controllers/authController.js
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password +failedLoginAttempts +lockUntil');

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.lockUntil && user.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({ error: `Account locked. Try again in ${minutesLeft} minute(s).` });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      user.failedLoginAttempts += 1;

      if (user.failedLoginAttempts >= MAX_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        user.failedLoginAttempts = 0; // reset the counter for whenever the lock expires
      }

      await user.save();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Successful login — clear any prior failed attempts
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // ...proceed with issuing tokens exactly as in Section 8.3...
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
};
```

`423 Locked` is the semantically precise status code here — less commonly used than the core four from Part 1, Section 13.3, but exactly meant for "the resource is locked and the request can't proceed until it's unlocked."

### 13.3 A Worthwhile Honesty Note

Once an account is locked, the response necessarily reveals that the email belongs to a real, registered account — a narrower version of the exact leak Section 5 was careful to avoid for ordinary wrong-password attempts. This is a deliberate, accepted tradeoff: by the time 5 consecutive wrong passwords have been submitted for one email, the attempt pattern itself has already effectively confirmed the account might exist, and the security value of telling a legitimate locked-out user *why* they can't log in outweighs the marginal information already leaked. Worth recognizing this tradeoff exists rather than treating it as an oversight.

### 13.4 A Note on Race Conditions

The read-then-write pattern above (`findOne`, then later `.save()`) has a small race-condition window under truly concurrent requests — two failed attempts arriving at nearly the same instant could both read `failedLoginAttempts: 4` before either writes back `5`, undercounting by one. For login attempts, this is a minor, acceptable imprecision rather than a correctness-critical figure — but Mongoose's `$inc` operator performs the increment atomically at the database level if this ever needs to be exact:

```js
await User.updateOne({ _id: user._id }, { $inc: { failedLoginAttempts: 1 } });
```

---

## 14. Session Management — Active Devices & "Log Out Everywhere"

Section 9's `RefreshToken` collection already records one document per active login session — it just isn't exposed to the user yet. A small extension turns it into a real "manage your devices" feature, a common and expected capability in real account settings pages.

### 14.1 Capturing Device Metadata

```js
// models/RefreshToken.js — additional fields
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
    userAgent: { type: String },  // e.g. "Mozilla/5.0 (Macintosh...) Chrome/125..."
    ipAddress: { type: String },
  },
  { timestamps: true }
);
```

```js
// controllers/authController.js — login, capturing where the session came from
await RefreshToken.create({
  user: user._id,
  tokenHash: hashToken(refreshToken),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  userAgent: req.headers['user-agent'],
  ipAddress: req.ip,
});
```

### 14.2 Listing Active Sessions

```js
// controllers/sessionController.js
import RefreshToken from '../models/RefreshToken.js';

export const listSessions = async (req, res) => {
  const sessions = await RefreshToken.find({
    user: req.user.userId,
    revoked: false,
    expiresAt: { $gt: new Date() },
  }).select('userAgent ipAddress createdAt'); // never expose tokenHash

  res.json(sessions);
};
```

### 14.3 Revoking a Single Session

```js
export const revokeSession = async (req, res) => {
  const session = await RefreshToken.findOne({ _id: req.params.id, user: req.user.userId });

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.revoked = true;
  await session.save();
  res.json({ message: 'Session revoked' });
};
```

Note the filter includes `user: req.user.userId` directly in the query, rather than fetching by ID alone and checking ownership afterward — a compact, equally valid alternative to Section 12.2's `requireOwnership` middleware pattern, appropriate here since there's only one route that needs this exact check.

### 14.4 "Log Out Everywhere"

```js
export const logoutAllSessions = async (req, res) => {
  await RefreshToken.updateMany({ user: req.user.userId, revoked: false }, { revoked: true });
  res.clearCookie('refreshToken', refreshCookieOptions());
  res.json({ message: 'Logged out of all sessions' });
};
```

```js
// routes/sessionRoutes.js
import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { listSessions, revokeSession, logoutAllSessions } from '../controllers/sessionController.js';

const router = Router();

router.get('/', protect, listSessions);
router.delete('/:id', protect, revokeSession);
router.post('/logout-all', protect, logoutAllSessions);

export default router;
```

This is exactly the feature behind "sign out of all devices" in a real account settings page — valuable specifically because a stolen device or a forgotten public-computer login can be shut down remotely, without needing to know or reset the account's password at all.

---

## 15. Multi-Factor Authentication (TOTP)

Password-only login means anyone who obtains the password — through a data breach elsewhere, a phishing page, or a keylogger — has full access. **TOTP (Time-based One-Time Password)** adds a second factor: a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password) that changes every 30 seconds, generated from a secret shared once during setup and never transmitted again afterward.

```bash
npm install otplib qrcode
```

### 15.1 How TOTP Actually Works

At enrollment, the server generates a random secret and shows it to the user as a QR code. The authenticator app scans it once and stores the secret locally. From that point on, both the server and the app independently compute the same 6-digit code using an HMAC-based algorithm fed by the shared secret and the current time (rounded to a 30-second window) — no network communication between the app and the server is needed for this to work, which is exactly why it still functions with the phone in airplane mode.

### 15.2 Extending the User Schema

```js
// models/User.js — additional fields
const userSchema = new mongoose.Schema(
  {
    // ...existing fields...
    mfaSecret: { type: String, select: false },
    mfaEnabled: { type: Boolean, default: false },
    mfaBackupCodes: { type: [String], select: false }, // hashed, single-use recovery codes
  },
  { timestamps: true }
);
```

### 15.3 Enrollment

```js
// controllers/mfaController.js
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';

export const setupMfa = catchAsync(async (req, res) => {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(req.user.email, 'YourAppName', secret);

  const user = await User.findById(req.user.userId);
  user.mfaSecret = secret; // NOT enabled yet — enabled only after the user confirms a real code (15.4)
  await user.save();

  const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl); // a base64 image the frontend can render directly
  res.json({ qrCode: qrCodeDataUrl });
});
```

### 15.4 Confirming Enrollment and Generating Backup Codes

Enabling MFA only after a successful verification confirms the user's authenticator app is actually configured correctly — otherwise a user could lock themselves out immediately by mistyping the secret during setup.

```js
import crypto from 'node:crypto';
import { hashToken } from '../utils/hashToken.js';

export const confirmMfa = catchAsync(async (req, res) => {
  const { totpCode } = req.body;
  const user = await User.findById(req.user.userId).select('+mfaSecret');

  const isValid = authenticator.verify({ token: totpCode, secret: user.mfaSecret });
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid code' });
  }

  // Generate one-time backup codes for account recovery if the device is ever lost
  const rawBackupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString('hex'));
  user.mfaBackupCodes = rawBackupCodes.map(hashToken); // store hashed, same principle as Section 10.2
  user.mfaEnabled = true;
  await user.save();

  res.json({
    message: 'MFA enabled',
    backupCodes: rawBackupCodes, // shown to the user EXACTLY ONCE — the server never displays these again
  });
});
```

### 15.5 Requiring the Code at Login

```js
// controllers/authController.js — login, extended for MFA
export const login = async (req, res) => {
  try {
    const { email, password, totpCode } = req.body;
    const user = await User.findOne({ email }).select('+password +mfaSecret +mfaEnabled +mfaBackupCodes');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.mfaEnabled) {
      const isValidTotp = totpCode && authenticator.verify({ token: totpCode, secret: user.mfaSecret });
      const backupCodeIndex = totpCode ? user.mfaBackupCodes.indexOf(hashToken(totpCode)) : -1;

      if (!isValidTotp && backupCodeIndex === -1) {
        // No tokens are issued at all until MFA passes — password alone is never sufficient once enabled
        return res.status(401).json({ mfaRequired: true, error: 'A valid authentication code is required' });
      }

      if (backupCodeIndex !== -1) {
        user.mfaBackupCodes.splice(backupCodeIndex, 1); // single-use — remove it immediately after consuming it
        await user.save();
      }
    }

    // ...proceed with issuing access/refresh tokens exactly as in Section 8.3...
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
};
```

The frontend flow: submit email + password first; if the response comes back `{ mfaRequired: true }`, prompt for the 6-digit code (or a backup code, for a lost device) and resubmit the same `login` call with `totpCode` included. No intermediate token is ever issued for a password-only, pre-MFA state — a partially-authenticated user has no valid credential at all until the second factor succeeds.

---

## 16. OAuth / Social Login

"Sign in with Google" (or GitHub, or any other provider) delegates authentication entirely to that provider — your app never sees or stores the user's Google password, and users get to skip creating yet another password for yet another service. Implementing the underlying **OAuth 2.0 authorization code flow correctly** (a `state` parameter to prevent CSRF on the redirect, PKCE, secure token exchange) is genuinely easy to get subtly wrong by hand; unlike most of this series, this is an area where reaching for a mature, maintained library is the right call rather than a shortcut.

```bash
npm install passport passport-google-oauth20
```

### 16.1 The Flow, Conceptually

1. User clicks "Sign in with Google" → your server redirects them to Google's own login/consent screen.
2. Google authenticates the user and asks them to approve sharing profile/email with your app.
3. Google redirects back to a callback URL **you registered in advance** with Google, including a one-time authorization code.
4. Your server exchanges that code for Google's access token and the user's profile (this exchange happens server-to-server, never exposed to the browser).
5. Your server finds-or-creates a local `User` record linked to that Google account, then issues **your own** access/refresh token pair exactly as in every earlier section of this part — from this point on, Google's tokens are irrelevant, and your app's session is managed exactly like a normal login.

### 16.2 Extending the User Schema

```js
// models/User.js — additional field, and password becomes conditional
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: {
      type: String,
      select: false,
      required: function () { return !this.googleId; }, // not required for OAuth-only accounts
    },
    googleId: { type: String, select: false, sparse: true }, // sparse: allows many docs with no googleId at all
    // ...other existing fields...
  },
  { timestamps: true }
);
```

### 16.3 Configuring the Strategy

```js
// config/passport.js
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          user = await User.create({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
          });
        }

        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

export default passport;
```

### 16.4 The Routes

```js
// routes/authRoutes.js — additions
import passport from '../config/passport.js';
import { googleCallback, exchangeOAuthCode } from '../controllers/authController.js';

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  googleCallback
);

router.post('/oauth/exchange', exchangeOAuthCode);
```

`session: false` matters here — Passport defaults to session-based auth (Section 1's other approach), but this series is JWT-based throughout, so Passport's role is narrowed to just the OAuth handshake itself, not managing ongoing sessions.

### 16.5 Handing Off to Your Own Tokens

Once Passport's callback confirms the Google identity and attaches the local `user` to `req.user`, issue your own tokens exactly as in a normal login — but avoid putting a long-lived token directly in a redirect URL, since URLs end up in browser history and server access logs. A short-lived, single-use handoff code (reusing the Redis instance from Part 5, Section 7.5, if already provisioned) keeps this clean:

```js
// controllers/authController.js
import crypto from 'node:crypto';
import { redisClient } from '../config/redis.js';

export const googleCallback = async (req, res) => {
  const handoffCode = crypto.randomBytes(24).toString('hex');
  await redisClient.set(`oauth-handoff:${handoffCode}`, req.user._id.toString(), 'EX', 60); // expires in 60 seconds

  res.redirect(`${process.env.CLIENT_URL}/oauth/callback?code=${handoffCode}`);
};

export const exchangeOAuthCode = async (req, res) => {
  const { code } = req.body;
  const userId = await redisClient.get(`oauth-handoff:${code}`);

  if (!userId) {
    return res.status(400).json({ error: 'Invalid or expired code' });
  }

  await redisClient.del(`oauth-handoff:${code}`); // single-use — delete immediately after reading

  const user = await User.findById(userId);
  const accessToken = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  // ...create and store the refresh token, set the cookie, exactly as in Section 8.3...

  res.json({ accessToken, user: { id: user._id, name: user.name, email: user.email } });
};
```

The frontend's `/oauth/callback` page immediately `POST`s the `code` query param to `/api/auth/oauth/exchange` on page load and discards the code from the URL — the actual access token only ever appears in a JSON response body, never in a URL, matching the same care given to every other token in this series.

---

## 17. Full Auth System, Assembled

```js
// models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: {
      type: String,
      select: false,
      required: function () { return !this.googleId; }, // not required for OAuth-only accounts (Section 16)
    },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String, select: false },
    verificationTokenExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    failedLoginAttempts: { type: Number, default: 0, select: false },   // Section 13
    lockUntil: { type: Date, default: null, select: false },             // Section 13
    mfaSecret: { type: String, select: false },                         // Section 15
    mfaEnabled: { type: Boolean, default: false },                      // Section 15
    mfaBackupCodes: { type: [String], select: false },                  // Section 15
    googleId: { type: String, select: false, sparse: true },            // Section 16
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
```

```js
// models/RefreshToken.js
import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
    userAgent: { type: String },   // Section 14 — session management metadata
    ipAddress: { type: String },   // Section 14
  },
  { timestamps: true }
);

export default mongoose.model('RefreshToken', refreshTokenSchema);
```

```js
// utils/cookieOptions.js
export const refreshCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
};
```

```js
// middleware/authMiddleware.js
import jwt from 'jsonwebtoken';

export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  next();
};

export const requireOwnership = (Model, paramName = 'id') => async (req, res, next) => {
  const resource = await Model.findById(req.params[paramName]);
  if (!resource) return res.status(404).json({ error: 'Resource not found' });
  if (req.user.role === 'admin') {
    req.resource = resource;
    return next();
  }
  if (resource.user.toString() !== req.user.userId) {
    return res.status(403).json({ error: 'You do not have permission to modify this resource' });
  }
  req.resource = resource;
  next();
};
```

```js
// middleware/csrfProtection.js
export const verifyOrigin = (req, res, next) => {
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!stateChangingMethods.includes(req.method)) return next();

  const origin = req.headers.origin || req.headers.referer;
  if (!origin || !origin.startsWith(process.env.CLIENT_URL)) {
    return res.status(403).json({ error: 'Request origin could not be verified' });
  }
  next();
};
```

```js
// routes/authRoutes.js
import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { verifyOrigin } from '../middleware/csrfProtection.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', verifyOrigin, refresh);
router.post('/logout', verifyOrigin, logout);
router.post('/forgot-password', forgotPassword);
router.patch('/reset-password/:token', resetPassword);
router.post('/send-verification', protect, sendVerificationEmail);
router.patch('/verify-email/:token', verifyEmail);

export default router;
```

```js
// routes/postRoutes.js — an example of role AND ownership authorization working together,
// using a generic resource rather than any particular app's domain model
import { Router } from 'express';
import { protect, requireOwnership } from '../middleware/authMiddleware.js';
import Post from '../models/Post.js';
import { getPosts, createPost, updatePost, deletePost } from '../controllers/postController.js';

const router = Router();

router.get('/', protect, getPosts);
router.post('/', protect, createPost);
router.put('/:id', protect, requireOwnership(Post), updatePost);
router.delete('/:id', protect, requireOwnership(Post), deletePost);

export default router;
```

```js
// routes/mfaRoutes.js
import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { setupMfa, confirmMfa } from '../controllers/mfaController.js';

const router = Router();

router.post('/setup', protect, setupMfa);
router.post('/confirm', protect, confirmMfa);

export default router;
```

```js
// index.js
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import passport from './config/passport.js';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import postRoutes from './routes/postRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import mfaRoutes from './routes/mfaRoutes.js';

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/mfa', mfaRoutes);

connectDB().then(() => {
  app.listen(process.env.PORT || 3000, () => console.log('Server running'));
});
```

```
# .env
MONGO_URI=mongodb+srv://...
JWT_ACCESS_SECRET=some-long-random-string-for-access-tokens
JWT_REFRESH_SECRET=a-different-long-random-string-for-refresh-tokens
CLIENT_URL=http://localhost:5173
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-user
SMTP_PASS=your-mailtrap-pass
EMAIL_FROM=no-reply@example.com
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
REDIS_URL=redis://default:password@your-redis-host:6379
PORT=3000
NODE_ENV=development
```

---

## 18. Common Auth Mistakes to Avoid

- **Returning different error messages for "wrong email" vs. "wrong password."** As shown in Section 5, always return the same generic `"Invalid credentials"` for both — a distinct error lets attackers enumerate which emails are registered in your system. The same principle applies to `forgotPassword` (Section 10.4) — identical response whether the email exists or not.
- **Storing the access token in `localStorage`.** Any injected script (XSS) can read `localStorage` freely. Keep the access token in memory (React state/context) and rely on the `httpOnly` refresh-token cookie for persistence across page reloads.
- **Using one shared secret for both access and refresh tokens.** Use two distinct secrets (Section 9.3), so compromising one doesn't compromise the other.
- **Forgetting `runValidators: true` on updates** (Part 3, Section 9.1) — without it, a `findByIdAndUpdate` can silently bypass your schema's validation rules (like the `enum: ['user', 'admin']` role restriction).
- **Putting sensitive data in the JWT payload.** The payload is Base64-*encoded*, not encrypted — anyone with the token can decode and read it (try pasting any JWT into [jwt.io](https://jwt.io) to see this directly). Only put non-sensitive identifiers (`userId`, `role`) in there, never passwords or personal data you wouldn't want exposed.
- **Long-lived access tokens "for convenience."** This defeats the entire point of the two-token system — keep access tokens short (minutes), and let the refresh flow handle staying logged in.
- **Storing raw reset/verification tokens instead of hashing them first.** A leaked database backup shouldn't hand out working account-takeover links — always store the SHA-256 hash (Section 10.2), never the raw token that went out over email.
- **Reset/verification tokens with no expiry, or an overly generous one.** A password-reset link that works forever is a standing vulnerability. Keep the window tight — 15 minutes for password resets, up to 24 hours for email verification is reasonable.
- **Leaving `/forgot-password` rate-unlimited.** Without rate limiting (covered fully in Part 5, Section 7.2), this endpoint can be hammered to spam a user's inbox or brute-force-probe which emails are registered. Apply the same kind of strict, per-IP limiter used on `/login`.
- **Relying on only one of `sameSite` or the origin-check middleware.** Section 11 treats these as complementary — the browser-enforced cookie attribute and the server-side check cover different failure modes; skipping either one narrows your protection to a single layer.
- **Using `sameSite: 'strict'` (or leaving the default) when frontend and backend are deployed to different domains.** As Section 7.1 covers, this silently drops the refresh cookie on every cross-domain request — login looks fine, but users get logged out every 15 minutes with no error anywhere. Test the refresh flow against your actual deployed domains, not just `localhost`, before considering auth "done."
- **Trusting a refresh token's signature alone, with no server-side record.** Without rotation and a tracked `RefreshToken` collection (Section 9), a leaked refresh token stays fully valid for its entire lifetime with no way to detect or stop it. A signature check alone answers "was this issued by us," not "should this specific copy still work."
- **Checking role but not ownership.** `authorize('admin')` says nothing about whether a plain `user` should be allowed to touch a specific document that isn't theirs. Section 12.2's `requireOwnership` is a distinct check from role-based authorization, and skipping it is one of the most common real-world authorization bugs — it's easy to test "does a non-admin get blocked" and forget to test "does user A get blocked from user B's data."
- **Only rate-limiting by IP, with no per-account lockout.** Section 13's account lockout catches distributed or slow-and-patient brute-force attempts that never trip a single-IP rate limiter at all — the two defenses catch genuinely different attack shapes, not the same one twice.
- **Enabling MFA without ever generating backup codes.** Section 15.4's backup codes exist specifically for a lost or wiped authenticator device. Without them, a user who loses their phone is permanently locked out of their own account with no self-service recovery path at all — only a manual, ID-verified support process can help at that point.
- **Putting a real access or refresh token directly in an OAuth redirect URL.** URLs are logged by browsers, proxies, and servers along the way. Section 16.5's short-lived, single-use handoff code exists specifically to avoid a real credential ever appearing in a URL.
- **Building session management (Section 14) without ownership-scoping every query to the current user.** `RefreshToken.findOne({ _id: req.params.id })` with no `user: req.user.userId` filter would let any logged-in user revoke *any other user's* session just by guessing or enumerating IDs — the exact same class of bug as Section 12.2's ownership gap, applied to a different collection.

---

## 19. Part 4 Recap & What's Next

- ✅ Sessions vs. JWT, and why JWT fits a decoupled API with a separate frontend
- ✅ Password hashing with `bcrypt` — hash, salt, compare, and the `select: false` pattern
- ✅ A secure registration flow
- ✅ JWT structure (header.payload.signature) and why the payload is readable but tamper-proof
- ✅ A login flow that verifies credentials and issues a signed token
- ✅ Auth middleware (`protect`) that verifies tokens and attaches `req.user`
- ✅ The access-token/refresh-token pattern, and why refresh tokens belong in `httpOnly` cookies
- ✅ A correctness fix for cross-domain deployments: why `sameSite: 'strict'` silently breaks once frontend and backend live on different domains, and a shared cookie helper that adapts by environment
- ✅ Refresh token rotation with reuse detection — a tracked `RefreshToken` collection, single-use tokens, and automatic revocation of every session when a stolen token gets replayed
- ✅ A full refresh endpoint and a logout flow that now genuinely revokes server-side, not just clears a cookie
- ✅ Password reset and email verification — hashed, time-limited, single-use tokens delivered by email via `nodemailer`
- ✅ CSRF — precisely where this system is already immune (the header-based access token) vs. where the real exposure sits (the refresh-token cookie), including how that exposure changes once deployed cross-domain
- ✅ Role-based authorization (`authorize('admin')`) — finally giving the `role` field real teeth, and putting `403` to use
- ✅ Ownership-based authorization (`requireOwnership`) — the distinct, commonly-missed check that a user can only modify their *own* resources, not just any resource by any authenticated user
- ✅ Account lockout after repeated failed logins — a defense that catches distributed/patient brute-force attempts an IP-based rate limiter misses entirely
- ✅ Session management — listing active devices, revoking one, and "log out everywhere," built directly on top of the rotation table
- ✅ Multi-factor authentication with TOTP — enrollment, QR-code setup, verification at login, and single-use backup codes for account recovery
- ✅ OAuth/social login (Google) via Passport, including a secure, URL-free handoff back to this system's own JWTs
- ✅ A full, assembled auth system end-to-end, including rotation, ownership, lockout, sessions, MFA, OAuth, reset/verification, and CSRF
- ✅ Common real-world auth mistakes and how to avoid each one

**Part 5**, the final part of this series, covers the production-readiness concerns that make the difference between "works on my machine" and a genuinely deployable API: centralized error handling (replacing all those repeated try/catch blocks with a single async-error wrapper and one error-handling middleware), startup validation that fails loudly if a secret like `JWT_ACCESS_SECRET` is missing rather than crashing confusingly later, input validation with a schema library (Zod) extended to params and query strings as well as request bodies, a health-check endpoint, deeper testing, and deploying your Express + MongoDB app to a real host.

Ready for Part 5?
