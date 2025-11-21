const express = require('express');
const path = require('path');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();

//Middleware allows cross-origin requests
app.use(cors()); 

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

//API middleware route /api/add?a=2&b=3
app.get('/api/add', (req,res) =>{
    const { a, b } = req.query;

    //check both parameters exist
    if (a === undefined || b === undefined) {
        return  res.status(400).json({
            error: 'Both query parameters "a" and "b" are required',
        });
    }
    //convert to numbers
    const numA = Number(a);
    const numB = Number(b);

    //validate they are valid numbers
    if (Number.isNaN(numA) || Number.isNaN(numB)) {
        return res.status(400).json({
            error: '"a" and "b" must be valid numbers.',
        });
    }

    //compute result
    const result = numA + numB;

    //send JSON response
    return res.json({ result });

});

// Create HTTP server from Express app
const server = http.createServer(app);

// Attach WebSocket server to the same HTTP server
const wss = new WebSocket.Server({ server });

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');

    // Send a welcome message to the client
    ws.send('Server: WebSocket connection established');

    // When the server receives a message from the client
    ws.on('message', (message) => {
        const text = message.toString();
        console.log('Received from client:', text);

        // Echo it back with a prefix
        ws.send('Server echo: ' + text);
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

// Start both HTTP + WebSocket on port 3000
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server with WebSocket running at http://localhost:${PORT}`);
});
