// HTTP SERVET
const server = http.createServer((req, res) => {
    if (req.url === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Welcome');
    } else if (req.url === '/about' && req.method === 'GET') {
      // ...
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

// INSTALLING 
// mkdir express-app && cd express-app
// npm init -y
// npm install express

// things you need to change and run
// {
//     "name": "express-app",
//     "version": "1.0.0",
//     "type": "module",
//     "scripts": {
//       "dev": "nodemon index.js",
//       "start": "node index.js"
//     }
//   }
//   npm install -D nodemon

// EXPRESS SIMPLE SETUP
// index.js
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Welcome to the homepage');
});

app.get('/about', (req, res) => {
  res.send('About page');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

//npm run dev