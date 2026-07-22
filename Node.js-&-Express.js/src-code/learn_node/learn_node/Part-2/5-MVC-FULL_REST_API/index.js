import express from 'express'
import userRoutes from './userRoutes.js'

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json())
app.use('/api/users', userRoutes)

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found'})
})      

app.listen(PORT, ()=>{
    console.log(`Server running on the http://localhost:${PORT}`)
})