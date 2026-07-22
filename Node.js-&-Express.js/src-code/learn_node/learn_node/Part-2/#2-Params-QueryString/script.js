// ========= PARAMS ====== //

//  Route Params — for identifying a specific resource
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