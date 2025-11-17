const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();

//Middleware allows cross-origin requests
app.use(cors()); 

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
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
app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
