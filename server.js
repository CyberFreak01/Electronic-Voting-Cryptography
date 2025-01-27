const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const PORT = 5000;

app.use(bodyParser.json());

// certificate generation
const CERT_DIR = 'cert';
const CA_SERVER = 'http://10.0.4.133:3000/sign';
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
    },
    voterId: {
        type: String,
        required: true
    },
    signature: {
        type: String,
        required: true
    }
});

const voterSchema = new mongoose.Schema({
    voterId: {
        type: String,
        required: true,
        unique: true
    },
    publicKey: {
        type: String,
        required: true
    },
    hasVoted: {
        type: Boolean,
        default: false
    }
});

const Vote = mongoose.model('Vote', voteSchema);
const Voter = mongoose.model('Voter', voterSchema);

function verifySignature(publicKey, encryptedVote, signature) {
    try {
        const verifier = crypto.createVerify('SHA256');
        verifier.update(encryptedVote);
        return verifier.verify(publicKey, signature, 'base64');
    } catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
}

app.post('/registerVoter', async (req, res) => {
    const { voterId, publicKey } = req.body;
    console.log("Call for Voter register on DB", voterId, publicKey)
    try {
        const existingVoter = await Voter.findOne({ voterId });
        if (existingVoter) {
            return res.status(400).json({ error: 'Voter already registered' });
        }

        const newVoter = new Voter({
            voterId,
            publicKey
        });

        await newVoter.save();
        res.status(201).json({ message: 'Voter registered successfully' });
    } catch (error) {
        console.error('Error registering voter:', error);
        res.status(500).json({ error: 'Failed to register voter' });
    }
});

app.post('/vote', async (req, res) => {
    const { encryptedVote, voterId, signature } = req.body;
    console.log("Call for Vote on DB with", encryptedVote, voterId)
    if (!encryptedVote || !voterId || !signature) {
        return res.status(400).json({ error: 'Encrypted vote, voter ID, and signature are required.' });
    }

    try {
        const voter = await Voter.findOne({ voterId });
        if (!voter) {
            return res.status(403).json({ error: 'Unauthorized voter' });
        }

        if (voter.hasVoted) {
            return res.status(400).json({ error: 'Voter has already cast a vote' });
        }

        // Verify the signature
        const isValidSignature = verifySignature(voter.publicKey, encryptedVote, signature);
        if (!isValidSignature) {
            return res.status(403).json({ error: 'Invalid vote signature' });
        }

        // Create and save the vote
        const newVote = new Vote({
            encryptedVote,
            voterId,
            signature
        });

        await newVote.save();

        // Mark voter as having voted
        voter.hasVoted = true;
        await voter.save();

        res.status(201).json({ message: 'Vote cast successfully!' });
    } catch (error) {
        console.error('Error casting vote:', error);
        res.status(500).json({ error: 'Failed to cast vote.' });
    }
});

app.get('/votes', async (req, res) => {
    try {
        console.log("Call for All Votes data on DB")
        const votes = await Vote.find();
        res.json(votes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch votes.' });
    }
});

// certificate generation
if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR);
}

app.get('/generate', async (req, res) => {
    const serverkeypath = path.join(CERT_DIR, 'server-key.pem');
    const csrPath = path.join(CERT_DIR, 'server.csr');
    const certPath = path.join(CERT_DIR, 'server-cert.pem');

    try {
        console.log("Generating server private key...");
        await execCommand(`openssl genpkey -algorithm RSA -out ${serverkeypath}`);

        console.log("Generating CSR...");
        await execCommand(`openssl req -new -key ${serverkeypath} -out ${csrPath} -subj "/C=IN/ST=UTTARPRADESH/L=Jaunpur/O=IIITVICD/CN=saurabh/OU=myunit"`);

        console.log("Sending CSR to ca for signing...");
        const formData = new FormData();
        formData.append('csr', fs.createReadStream(csrPath));

        const response = await axios.post(CA_SERVER, formData, {
            headers: formData.getHeaders(),
        });

        if (response.status === 200) {
            console.log("Received signed certificate from ca");
            fs.writeFileSync(certPath, response.data);

            const privateKey = fs.readFileSync(serverkeypath, 'utf-8');
            const certificate = fs.readFileSync(certPath, 'utf-8');
            res.status(200).json({
                message: 'SSL key and certificate successfully generated!',
                privateKey,
                certificate,
            });
        } else {
            res.status(500).json({ message: `Error signing CSR on Server 2: ${response.data}` });
        }
    } catch (err) {
        console.error(`Unexpected error: ${err.message}`);
        res.status(500).json({ message: `Unexpected error: ${err.message}` });
    }
});

const execCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout ? stdout : stderr);
            }
        });
    });
};

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));