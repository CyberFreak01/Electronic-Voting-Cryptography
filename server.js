const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const PORT = 5000;

app.use(bodyParser.json());

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`mongodb+srv://khatarnakpaji12:Saurabh1234@cluster0.v11cu.mongodb.net`);
        console.log(`\n MONGODB CONNECTION SUCCESSFUL!! DB HOST ${connectionInstance.connection.host}`);
    } catch (error) {
        console.error("ERROR IN MONGODB CONNECTION", error);
        process.exit(1);
    }
};

connectDB();

const voteSchema = new mongoose.Schema({
    encryptedVote: {
        type: String,
        required: true
    }
});

const Vote = mongoose.model('Vote', voteSchema);

app.post('/vote', async (req, res) => {
    const { encryptedVote } = req.body;

    if (!encryptedVote) {
        return res.status(400).json({ error: 'Encrypted vote is required.' });
    }
    console.log("request for vote saving in database", encryptedVote);
    const newVote = new Vote({
        encryptedVote
    });

    try {
        await newVote.save();
        res.status(201).json({ message: 'Vote cast successfully!' });
    } catch (error) {
        console.error('Error casting vote:', error);
        res.status(500).json({ error: 'Failed to cast vote.' });
    }
});

app.get('/votes', async (req, res) => {
    try {
        const votes = await Vote.find();
        console.log("request for votes in server");
        res.json(votes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch votes.' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
