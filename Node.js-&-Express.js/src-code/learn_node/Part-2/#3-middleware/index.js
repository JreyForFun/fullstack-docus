// It receives the request, the response, and a next function. It can:

// Inspect or modify req/res
// End the request-response cycle (by calling res.send()/res.json()/res.end())
// Call next() to pass control to the next middleware in line
// Call next(error) to skip straight to error-handling middleware
(req, res, next) => {
    // do something with req/res
    next(); // pass control to the NEXT middleware in the chain
  }

// Minimal Custom Middleware 
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


// The order of app.use()

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

  
// SCOPED TO SPECIFIC ROUTES 
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

// Passing Data Between Middleware via req
const attachUser = (req, res, next) => {
    req.user = { id: 1, name: 'InnovaREV' }; // pretend this came from a decoded JWT
    next();
  };
  
  app.get('/profile', attachUser, (req, res) => {
    res.json({ message: `Hello, ${req.user.name}` }); // req.user is available here
  });

// === Built-in and Third-Party Middleware

// express.json() — Parsing JSON Request Bodies
// Without app.use(express.json()), req.body would be undefined for any JSON POST/PUT/PATCH request — this is the single most common "why is my req.body empty" bug.

import express from 'express';
const app = express();

app.use(express.json()); // parses incoming JSON bodies, populates req.body

app.post('/echo', (req, res) => {
  console.log(req.body); // the parsed JSON object, ready to use
  res.json({ youSent: req.body });
});


// express.static() — Serving Static Files
// Any file inside the public folder becomes directly accessible via URL — e.g. public/style.css → http://localhost:3000/style.css. No route needs to be written for each file. Useful for serving a frontend build, images, or downloadable assets alongside your API.
app.use(express.static('public'));


// CORS IN DEPTH 
// npm install cors