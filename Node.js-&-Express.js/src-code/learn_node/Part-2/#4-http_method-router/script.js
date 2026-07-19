// == HTTP method in Express
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


// === R O U T E S

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


import express from 'express';
import userRoutes from './routes/userRoutes.js'; // note: .js extension required (ESM rule from Part 1!)

const app = express();
app.use(express.json());

app.use('/users', userRoutes); // mounts the router at /users

app.listen(3000);

// ==== ROUTE MIDDLEWARE LEVEL

// Applies only to routes within this router
router.use((req, res, next) => {
  console.log('Request to a /users route');
  next();
});

router.use((req, res, next) => {
  console.log('Request to /users');
  next(); // allows /users or /users/:id to run
});

router.get('/', (req, res) => res.send('All users'));
router.get('/:id', (req, res) => res.send(`User ${req.params.id}`));
