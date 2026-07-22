import http from 'node:http'

const PORT = 3000

// http.createServer create low level http sercer
// callback is going to run for ever incoming http req
// req -> request object
// method = gt, post ,put,option,delete
// / , /users
// headers - actual metadata sent by the client
// req body -> data post/put

// res - response object
// status code, response headers, response body


const server = http.createServer((req, res, err) => {
    const method = req.method;

    // get - reading data
    // post - create data
    // put - replacing data
    // patch - update partial data
    // delete - delete data

    const url = req.url;
    // in which path the client is actually requesting

    const userAgent = req.headers['user-agent']

    res.statusCode = 200
    // set http status code/
    // 200 - req success
    // 201, 400 ,401 ,429,

    res.setHeader('Content-Type', 'text/plain')
    res.end(`Basic http node server: ${method}: ${url}: ${userAgent}`)
})

server.listen(PORT, () => {
    console.log("Server is running")
})