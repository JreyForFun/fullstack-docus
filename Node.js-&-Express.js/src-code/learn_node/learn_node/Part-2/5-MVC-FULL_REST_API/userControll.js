import { users } from './users.js'

export const getAllUsers = (req, res) => {
    res.json(users);
}

export const getUserById = (req, res) => {
    const user = users.find((u) => u.id === Number(req.params.id));
    if(!user){
        return res.status(404).json({ error: 'User not found'})
    }
    res.json(user);
}

export const createUser = (req, res) => {
    const newUser = {id: users.length + 1, ...req.body}
    users.push(newUser);
    res.json(newUser)
}

export const updateUser = (req,res) => {
    const user = users.find((u) => u.id === Number(req.params.id))
    if(!user){
        return res.status(404).json({error: 'User not found'})
    }
    Object.assign(user, req.body)
    res.json(user)
}

export const deleteUser = (req, res) => {
    const index = users.findIndex((u) => u.id === Number(req.params.id))
    if(index === -1) return res.status(404).json({error: 'User not found'})
    const [deleted] = users.splice(index, 1);
    res.status(200).json({message: 'Deleted', user: deleted})
}