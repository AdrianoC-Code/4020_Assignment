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
const dbURI = '';
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

// Map option indices to letters: 0 -> A, 1 -> B, ...
const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * Build a multiple-choice prompt from a question document.
 * Assumes questionDoc.options is an array of option strings,
 * and expected_answer is something like "A", "B", etc.
 */
function buildMCQPrompt(questionDoc, domain) {
  const { question, options } = questionDoc;

  const optionsText = (options || [])
    .map((opt, idx) => `${OPTION_LETTERS[idx]}) ${opt}`)
    .join("\n");

  return `
You are answering a multiple-choice question in the domain: ${domain}.

Question:
${question}

Options:
${optionsText}

Important:
- Choose the SINGLE BEST option.
- Respond with ONLY the LETTER of the option (A, B, C, ...).
- Do NOT include any explanation or extra text.
`.trim();
}

/**
 * Extract the first A-Z letter from the ChatGPT response,
 * to be robust if it ever returns something like "The answer is C."
 */
function extractAnswerLetter(text) {
  if (!text) return null;
  const match = text.toUpperCase().match(/[A-Z]/);
  return match ? match[0] : null;
}


const app = express();

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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
    // Build MCQ-style prompt including options
    const prompt = buildMCQPrompt(questionDoc, domain);

    const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
        { role: "system", content: "You are an expert multiple-choice exam solver. Always answer with only the letter of the correct option." },
        { role: "user", content: prompt }
    ]
});

    const rawResponse = completion.choices[0].message.content || "";
    const responseTimeMs = Date.now() - startTime;

    // Extract just the letter (e.g., "C")
    const answerLetter = extractAnswerLetter(rawResponse);
    const expectedLetter = extractAnswerLetter(questionDoc.expected_answer);

    // Compute correctness using letters only
    const isCorrect = answerLetter && expectedLetter && answerLetter === expectedLetter;

    await db.collection(domain).updateOne(
    { _id: new ObjectId(id) },
    {
        $set: {
        chatgpt_response: rawResponse,
        responseTimeMs,
        isCorrect,
        answerLetter   // optional extra field if you want
        }
    }
);

    res.json({ chatgpt_response: rawResponse, responseTimeMs, answerLetter, isCorrect });


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

  // Optional: welcome message (your original behavior)
  ws.send('Server: WebSocket connection established');

  ws.on('message', async (rawMessage) => {
    const text = rawMessage.toString();
    console.log('WS received:', text);

    // 1) Try to interpret message as JSON (for evaluation commands)
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // 2) Not JSON → treat as simple chat
      ws.send('Server echo: ' + text);
      return;
    }

    // 3) JSON but no recognized type → error
    const { type, domain } = parsed;

    if (type !== 'evaluate') {
      ws.send(JSON.stringify({
        status: 'error',
        message: 'Unknown WebSocket message type'
      }));
      return;
    }

    if (!domain) {
      ws.send(JSON.stringify({
        status: 'error',
        message: 'Missing "domain" in evaluate message'
      }));
      return;
    }

    // 4) From here down is your teammate's evaluation logic, adapted
    try {
      await connectDB();

      const questions = await db.collection(domain)
        .find({ chatgpt_response: "" })
        .toArray();

      console.log(`Evaluating ${questions.length} questions for domain ${domain}`);

    for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const start = Date.now();

    // Build MCQ prompt using question + options
    const prompt = buildMCQPrompt(q, domain);

    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
        { role: "system", content: "You are an expert multiple-choice exam solver. Always answer with only the letter of the correct option." },
        { role: "user", content: prompt }
        ]
    });

    const rawResponse = completion.choices[0].message.content || "";
    const responseTimeMs = Date.now() - start;

    const answerLetter = extractAnswerLetter(rawResponse);
    const expectedLetter = extractAnswerLetter(q.expected_answer);
    const isCorrect = answerLetter && expectedLetter && answerLetter === expectedLetter;

    await db.collection(domain).updateOne(
        { _id: q._id },
        {
        $set: {
            chatgpt_response: rawResponse,
            responseTimeMs,
            isCorrect,
            answerLetter    // optional but handy
        }
    }
);

    // Progress update over WebSocket
    ws.send(JSON.stringify({
        type: 'progress',
        current: i + 1,
        total: questions.length,
        questionId: q._id,
        answerLetter,
        isCorrect
    }));
}


      // Final "done" message
      ws.send(JSON.stringify({ type: 'done', domain }));
    } catch (err) {
      console.error('WebSocket evaluation error:', err);
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});


// ===== START SERVER =====

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server with WebSocket running at http://localhost:${PORT}`);
});
