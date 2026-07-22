// Why Separate Controllers from Routes? Without MVC, route files bloat with inline logic:

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