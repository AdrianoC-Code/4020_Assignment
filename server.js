const express = require('express');
const path = require('path');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const { MongoClient, ObjectId } = require('mongodb');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: ""});

// ==== MongoDB Atlas setup ====
const dbURI = 'mongodb+srv://adricelluc';
const client = new MongoClient(dbURI);
let db;

async function connectDB() {
    if (!db) {
        await client.connect();
        db = client.db();
        console.log("Connected to MongoDB Atlas");
    }
    return db;
}

const app = express();

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ===== ROUTES =====
app.get('/questions/:domain', async (req, res) => {
    try {
        await connectDB();
        const domain = req.params.domain;
        const questions = await db.collection(domain).find({}).toArray();
        res.json({ domain, total: questions.length, questions });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
});

app.get('/questions/:domain/random', async (req, res) => {
    try {
        await connectDB();
        const domain = req.params.domain;
        const collection = db.collection(domain);
        const count = await collection.countDocuments();
        const randomIndex = Math.floor(Math.random() * count);
        const question = await collection.find().limit(1).skip(randomIndex).next();
        res.json(question);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch random question' });
    }
});

app.post('/questions/:domain/:id/answer', async (req, res) => {
    try {
        await connectDB();
        const { domain, id } = req.params;
        const { chatgpt_response } = req.body;
        const result = await db.collection(domain).updateOne(
            { _id: new ObjectId(id) },
            { $set: { chatgpt_response } }
        );
        res.json({ modifiedCount: result.modifiedCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update answer' });
    }
});

app.post('/api/evaluate/:domain/:id', async (req, res) => {
    try {
        await connectDB();
        const { domain, id } = req.params;
        const questionDoc = await db.collection(domain).findOne({ _id: new ObjectId(id) });
        if (!questionDoc) return res.status(404).json({ error: "Question not found" });

        const startTime = Date.now();
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are an expert in " + domain },
                { role: "user", content: questionDoc.question }
            ]
        });

        const chatgpt_response = completion.choices[0].message.content;
        const responseTimeMs = Date.now() - startTime;

        await db.collection(domain).updateOne(
            { _id: new ObjectId(id) },
            { $set: { chatgpt_response, responseTimeMs, isCorrect: chatgpt_response.trim().toLowerCase() === questionDoc.expected_answer.trim().toLowerCase() } }
        );

        res.json({ chatgpt_response, responseTimeMs });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to evaluate question" });
    }
});

// ===== VALIDATE DOMAIN =====
function validateDomain(req, res, next) {
    const validDomains = ["Computer_Security", "History", "Social_Science"];
    if (!validDomains.includes(req.params.domain)) {
        return res.status(400).json({ error: "Invalid domain" });
    }
    next();
}

app.use('/api/evaluate/:domain/:id', validateDomain);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/test-db', async (req, res) => {
    try {
        await connectDB();
        const collections = await db.listCollections().toArray();
        res.json({ ok: true, collections: collections.map(c => c.name) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: 'DB test failed' });
    }
});

// ===== RESULTS ROUTE (fixed avgTime & accuracy) =====
app.get('/api/results', async (req, res) => {
    try {
        await connectDB();
        const domains = ["Computer_Security", "History", "Social_Science"];
        const results = {};

        for (const domain of domains) {
            const questions = await db.collection(domain).find({}).toArray();
            const total = questions.length;
            const answeredQuestions = questions.filter(q => q.chatgpt_response && q.chatgpt_response.trim() !== "");
            const answered = answeredQuestions.length;

            const avgResponseTimeMs = answered > 0
                ? answeredQuestions.reduce((sum, q) => sum + (q.responseTimeMs || 0), 0) / answered
                : 0;

            const accuracyPercent = answered > 0
                ? answeredQuestions.filter(q => q.isCorrect).length / answered * 100
                : 0;

            results[domain] = {
                total,
                answered,
                avgResponseTimeMs: Number(avgResponseTimeMs.toFixed(2)),
                accuracyPercent: Number(accuracyPercent.toFixed(2))
            };
        }

        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to get results" });
    }
});

// ===== WEBSOCKET SETUP (keep exactly as OG) =====
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');

    ws.on('message', async (message) => {
        try {
            const { domain } = JSON.parse(message);
            await connectDB();
            const questions = await db.collection(domain).find({ chatgpt_response: "" }).toArray();

            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                const start = Date.now();

                const completion = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: q.question }]
                });

                const chatgpt_response = completion.choices[0].message.content;
                const responseTimeMs = Date.now() - start;
                const isCorrect = chatgpt_response.trim().toLowerCase() === q.expected_answer.trim().toLowerCase();

                await db.collection(domain).updateOne(
                    { _id: q._id },
                    { $set: { chatgpt_response, responseTimeMs, isCorrect } }
                );

                ws.send(JSON.stringify({ current: i + 1, total: questions.length, questionId: q._id }));
            }

            ws.send(JSON.stringify({ status: "done" }));
        } catch (err) {
            console.error('WebSocket error:', err);
            ws.send(JSON.stringify({ status: "error", message: err.message }));
        }
    });

    ws.on('close', () => console.log('WebSocket client disconnected'));
});

// ===== START SERVER =====
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server with WebSocket running at http://localhost:${PORT}`);
});
