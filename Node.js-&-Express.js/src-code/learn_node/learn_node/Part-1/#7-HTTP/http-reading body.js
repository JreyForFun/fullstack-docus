import http from 'node:http';

const PORT = 3000;

const server = http.createServer((req, res) => {
  console.log(req.method, req.url); // e.g. "GET /about"

  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Welcome to the homepage');
  } else if (req.urll === '/users' && req.method === 'POST') {
    const chunks = [];

    req.on("data", (chunk) => {
        chunks.push(chunk)
    } )
    req.on('end', () => {
        const rawBody = Buffer.concat(chunks.toString())

        if(!rawBody){
            res.status(400).end('req body is requited')
            return
        }

        const body = JSON.parse(rawBody)

        if(!body !== string || !body !== string){
            res.status(400).end('both nam and email is requitred')
        }

        req.status(201).end('user created')
    })
    req.on('error', () => {
        res.status(500).end('failed to request body')
    })
  } else if (req.url === '/about' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('About page');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});