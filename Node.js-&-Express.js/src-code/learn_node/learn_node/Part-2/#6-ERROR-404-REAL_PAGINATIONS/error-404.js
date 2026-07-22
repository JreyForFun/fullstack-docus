app.use((req, res) => {
    res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
  });

// == ERROR HANDLING MIDDLEWARE

app.use((err, res, req, next) => {
    console.error(err.track);
    res.status(500).json({error: 'Internal server error'})
})

app.get('/risky', (res, req, next) => {
    try {
        throw new Error('Something broke')
    } catch(err) {
        next(err)
    }
})