const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const csvParser = require('csv-parser');

// MongoDB Atlas connection
const dbURI = 'mongodb+srv://adricelluc_db_user:HTeuHZga9YAB3tMB@4020cluster.tcfhk0l.mongodb.net/ChatGPT_Evaluation?appName=4020Cluster';
const client = new MongoClient(dbURI);

// Map collection names to CSV files
const collectionsToFiles = {
    Computer_Security: 'computer_security_test.csv',  // Make sure this file exists
    History: 'prehistory_test.csv',                   // Make sure this file exists
    Social_Science: 'sociology_test.csv'             // Make sure this file exists
};

// Function to populate a single collection
async function populateCollection(collectionName, csvFile) {
    await client.connect();
    const db = client.db();
    const collection = db.collection(collectionName);

    // Clear existing data
    await collection.deleteMany({});

    return new Promise((resolve, reject) => {
        const records = [];

        fs.createReadStream(csvFile)
            .pipe(csvParser({ headers: false })) // CSV has no headers
            .on('data', (row) => {
                const values = Object.values(row);
                const questionText = values[0];
                const options = values.slice(1, values.length - 1); // all but first and last
                const answer = values[values.length - 1];

                records.push({
                    question: questionText,
                    options,
                    expected_answer: answer,
                    chatgpt_response: "",
                    domain: collectionName
                });
            })
            .on('end', async () => {
                if (records.length > 0) {
                    await collection.insertMany(records);
                    console.log(`Inserted ${records.length} rows into ${collectionName}`);
                } else {
                    console.log(`No rows found in ${csvFile}`);
                }
                resolve();
            })
            .on('error', (err) => {
                reject(err);
            });
    });
}

// Main function to populate all collections sequentially
(async () => {
    try {
        for (const [collection, file] of Object.entries(collectionsToFiles)) {
            await populateCollection(collection, path.join(__dirname, file));
        }
        console.log('All collections populated successfully.');
    } catch (err) {
        console.error('Error populating collections:', err);
    } finally {
        await client.close();
    }
})();
