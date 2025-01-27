const express = require("express");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const axios = require("axios");
const crypto = require("crypto");
const bigInt = require("bigint-crypto-utils");
const { exec } = require("child_process");
const FormData = require('form-data');

const trustedAuthorityServer = "http://localhost:3000";
const server = "http://localhost:5000";

const app = express();
const PORT = 80;
const CERT_DIR = "cert";

app.use(bodyParser.json());
app.use(express.static("public"));

class VoterAuthenticationSystem {
    constructor() {
        this.voterRegistry = new Map();
    }
    async registerVoter(voterId, publicKey) {
        if (this.voterRegistry.has(voterId)) {
            throw new Error("Voter already registered");
        }

        const payload = {
            voterId,
            publicKey,
        };

        return axios
            .post(`${server}/registerVoter`, payload)
            .then((response) => {
                this.voterRegistry.set(voterId, publicKey);
                console.log(
                    "Voter registered successfully on the server:",
                    response.data
                );
                return true;
            })
            .catch((error) => {
                console.error(
                    "Failed to register voter on the server:",
                    error.response?.data || error.message
                );
                throw new Error("Failed to register voter on the server");
            });
    }

    generateSignature(privateKey, encryptedVote) {
        const signer = crypto.createSign("SHA256");
        signer.update(encryptedVote);
        return signer.sign(privateKey, "base64");
    }

    encrypt(plainText, publicKey) {
        const plainTextBigInt = BigInt(plainText);

        const { n, g, nSquared } = publicKey;
        const nBigInt = BigInt(n);
        const gBigInt = BigInt(g);
        const nSquaredBigInt = BigInt(nSquared);

        const r = bigInt.randBetween(nBigInt); // Random number r where 1 <= r < n
        const c1 = bigInt.modPow(gBigInt, plainTextBigInt, nSquaredBigInt);
        const c2 = bigInt.modPow(r, nBigInt, nSquaredBigInt);

        return (c1 * c2) % nSquaredBigInt; // Encrypted result
    }
}

const voterAuth = new VoterAuthenticationSystem();

async function fetchSystemData() {
    try {
        const pubKeyResponse = await axios.get(`${trustedAuthorityServer}/pubkey`);
        const pubKey = pubKeyResponse.data.publicKey;

        return { pubKey };
    } catch (error) {
        console.error("Failed to fetch system data:", error.message);
        return null;
    }
}

app.post("/registerVoter", async (req, res) => {
    const { voterId } = req.body;
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
    });

    // Here we register Voters

    try {
        await voterAuth.registerVoter(
            voterId,
            publicKey.export({ type: "spki", format: "pem" })
        );

        return res.status(200).json({
            message: "Voter registered successfully",
            publicKey: publicKey.export({ type: "spki", format: "pem" }),
            privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
        });
    } catch (error) {
        console.error("Error registering voter:", error.message);

        if (error.response?.status) {
            return res.status(error.response.status).json({
                message: `Failed to register voter on the external server: ${error.response.data?.message || error.message
                    }`,
            });
        }

        return res.status(400).json({
            message: `Failed to register voter: ${error.message}`,
        });
    }
});

app.post("/castVote", async (req, res) => {
    const { vote, voterId, privateKeyPem } = req.body;

    if (!vote || !voterId || !privateKeyPem) {
        return res
            .status(400)
            .json({ message: "Vote, voterId, and privateKey are required" });
    }

    try {
        const systemData = await fetchSystemData();
        if (!systemData) {
            return res
                .status(500)
                .json({ message: "Failed to retrieve system data" });
        }

        const { pubKey } = systemData;
        const encryptedVote = voterAuth.encrypt(vote, pubKey);

        const encryptedVoteStr = encryptedVote.toString();

        const privateKey = crypto.createPrivateKey(privateKeyPem);
        const signature = voterAuth.generateSignature(privateKey, encryptedVoteStr);

        // Here We Send Encrypted Votes to server along with signature for verification
        const response = await axios.post(`${server}/vote`, {
            encryptedVote: encryptedVoteStr,
            voterId,
            signature,
        });

        return res.status(200).json({ message: response.data.message });
    } catch (error) {
        console.error("Error in casting vote:", error);
        return res.status(500).json({
            message: "Failed to cast vote",
            error: error.response?.data || error.message,
        });
    }
});

if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR);
}

app.get('/generate', async (req, res) => {
    try {
        const response = await axios.get(`${server}/generate`);

        if (response.status === 200) {
            const { privateKey, certificate } = response.data;

            if (!fs.existsSync(CERT_DIR)) {
                fs.mkdirSync(CERT_DIR);
            }

            const serverKeyPath = path.join(CERT_DIR, 'server-key.pem');
            const certPath = path.join(CERT_DIR, 'server-cert.pem');

            fs.writeFileSync(serverKeyPath, privateKey);
            fs.writeFileSync(certPath, certificate);

            console.log('Private key and certificate saved successfully.');

            res.status(200).json({ message: 'SSL key and certificate received and saved successfully!' });
        } else {
            res.status(500).json({ message: `Error receiving SSL key and certificate: ${response.data.message}` });
        }
    } catch (err) {
        console.error(`Unexpected error: ${err.message}`);
        res.status(500).json({ message: `Unexpected error: ${err.message}` });
    }
});

const startServer = () => {
    const certPath = path.join(CERT_DIR, "server-cert.pem");
    const serverKeyPath = path.join(CERT_DIR, "server-key.pem");

    if (fs.existsSync(certPath) && fs.existsSync(serverKeyPath)) {
        https
            .createServer(
                {
                    key: fs.readFileSync(serverKeyPath),
                    cert: fs.readFileSync(certPath),
                },
                app
            )
            .listen(PORT, "0.0.0.0", () => {
                console.log(`HTTPS Server running on https://localhost:${PORT}`);
            });
    } else {
        http.createServer(app).listen(PORT, "0.0.0.0", () => {
            console.log(`HTTP Server running on http://localhost:${PORT}`);
            console.log("Note: Certificate not found. Running in insecure mode.");
        });
    }
};

startServer();
