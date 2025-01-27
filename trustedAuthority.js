const express = require('express')
const crypto = require('crypto');
const readline = require('readline');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const bigInt = require('bigint-crypto-utils');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const app = express();
const port = 3000;

app.use(express.json());
app.use(fileUpload());

//Paillier Homomorphic algorithm constants (public parameters)
const p = 142085650542201486229346284919624539627568599397558892862761894704203444419272092353007222014818212298207911410337146065188544469924808126653084522524403213299151828829137647515833884357401298763585758564694022796831547035687004473670697035340248844612010197481116840317602951108858059772484235981140918839753n;
const q = 123842808930577550873636447090552448779516604965150522698416324559144118717816687590556980744618958880051331763142817203834001734848205308423584567204674817975663917327949091147318683158301551637736926583738938579931011549518244815482726508415020952534762264544854620702674173886866508457160439456790030508169n;

const generateKeys = function (bitLength = 2048) {
    const n = p * q;
    const lambda = bigInt.lcm(p - 1n, q - 1n); // LCM of (p-1) and (q-1)
    const nSquared = n ** 2n; // n^2
    const g = n + 1n; // Generator (default choice)

    // Compute μ = (L(g^λ mod n^2))^-1 mod n
    const l = (x) => (x - 1n) / n; // L function
    const mu = bigInt.modInv(l(bigInt.modPow(g, lambda, nSquared)), n);

    return {
        publicKey: { n, g, nSquared },
        privateKey: { lambda, mu, n },
    };
}

const { publicKey, privateKey } = generateKeys();

//t-shamir secret sharing
function getRandomBigInt(max) {
    const byteLength = Math.ceil(max.toString(16).length / 2);
    const randomBytes = crypto.randomBytes(byteLength);
    return BigInt(`0x${randomBytes.toString('hex')}`) % max;
}

function generateShares(secret, n, k, prime) {
    if (k > n) throw new Error('Threshold cannot be greater than total shares');
    if (secret >= prime) throw new Error('Secret must be less than prime');

    const coefficients = [secret];
    for (let i = 1; i < k; i++) {
        coefficients.push(getRandomBigInt(prime - 1n));
    }

    const shares = [];
    for (let i = 1; i <= n; i++) {
        const x = BigInt(i);
        let y = 0n;

        for (let j = coefficients.length - 1; j >= 0; j--) {
            y = (y * x + coefficients[j]) % prime;
        }

        shares.push({ x, y });
    }

    return shares;
}

function modInv(a, m) {
    return bigInt.modInv(a, m);
}

// Reconstruct Secret using Lagrange Interpolation
function reconstructSecret(shares, prime) {
    if (shares.length < 2) throw new Error('At least two shares required');

    let secret = 0n;
    for (let i = 0; i < shares.length; i++) {
        const { x: xi, y: yi } = shares[i];

        // Compute Lagrange basis polynomial
        let numerator = 1n;
        let denominator = 1n;

        for (let j = 0; j < shares.length; j++) {
            if (i !== j) {
                const { x: xj } = shares[j];
                numerator = (numerator * (-xj + prime)) % prime;
                denominator = (denominator * (xi - xj + prime)) % prime;
            }
        }

        // Compute and add the Lagrange term
        const lagrangeTerm = (yi * numerator * modInv(denominator, prime)) % prime;
        secret = (secret + lagrangeTerm + prime) % prime;
    }

    return secret;
}

const prime = 17596286071874671252264809512716894795844031870579261353227708355380208193593072415489720159573217084493631837337179196810940630251782257974264432687685924774129357610602047247586947743765349709039165099037200611213454934826690881191069549652877915832063743450661387596017493377714992013939780240995290913607254142465171119448468476963310935213465281437013026945378927755270520038272074627623273653835470431078847209684799677329459660875373632079235536924236250916623119770829176294330979192779991935487759048009257643369389878257229529712904552203260238794194515925681887422873239562291575044833596905737648468444981n;
const totalShares = 5;
const threshold = 3;

const secret = {
    lambda: privateKey.lambda,
    mu: privateKey.mu
};

const shares = {
    lambda: generateShares(secret.lambda, totalShares, threshold, prime),
    mu: generateShares(secret.mu, totalShares, threshold, prime)
};

const System = {
    pubKey: publicKey,
};

app.get("/pubkey", (req, res) => {
    const publicKeyAsStrings = {
        n: System.pubKey.n.toString(),
        g: System.pubKey.g.toString(),
        nSquared: System.pubKey.nSquared.toString(),
    };

    res.json({ publicKey: publicKeyAsStrings });
});

app.post("/prikey", async (req, res) => {
    const newRequestId = crypto.randomUUID();
    let activeVotes = { [newRequestId]: { approvals: 0, rejections: 0 } };

    for (let i = 1; i <= totalShares; i++) {
        console.log(`Participant ${i} Share (lambda):`, shares.lambda[i - 1]);
        console.log(`Participant ${i} Share (mu):`, shares.mu[i - 1]);
        await new Promise((resolve) => {
            rl.question(`Participant ${i}: Do you approve the private key request? (yes/no): `, (answer) => {
                if (answer.trim().toLowerCase() === 'yes') {
                    activeVotes[newRequestId].approvals++;
                } else {
                    activeVotes[newRequestId].rejections++;
                }
                resolve();
            });
        });
    }

    if (activeVotes[newRequestId].approvals >= threshold) {
        const selectedLambdaShares = shares.lambda.slice(0, threshold);
        const selectedMuShares = shares.mu.slice(0, threshold);

        // Reconstruct the lambda and mu
        const reconstructedLambda = reconstructSecret(selectedLambdaShares, prime);
        const reconstructedMu = reconstructSecret(selectedMuShares, prime);

        res.json({
            success: true,
            privateKey: {
                lambda: reconstructedLambda.toString(),
                mu: reconstructedMu.toString(),
                n: privateKey.n.toString()
            },
            message: "Private key successfully reconstructed.",
        });
    } else {
        res.json({
            success: false,
            message: "Not enough approvals. Returning a random private key.",
        });
    }
});

//sign certificate 
const CERT_DIR = 'cert';

if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR);
}

// Route to handle CSR signing
app.post('/sign', async (req, res) => {
    const csrPath = path.join(CERT_DIR, 'server.csr');
    const cakeypath = path.join(CERT_DIR, 'ca-key.pem');
    const certPath = path.join(CERT_DIR, 'server-cert.pem');
    const cacert = path.join(CERT_DIR, 'ca-cert.pem');

    const opensslConfPath = 'E:\\electronic_voting_2\\electronic_voting\\cert\\open_ssl.cnf';

    const csrFile = req.files?.csr;

    if (!csrFile) {
        return res.status(400).json({ message: "CSR files are required" });
    }

    try {
        console.log("Generating CA private key...");
        await execCommand(`openssl genpkey -algorithm RSA -out ${cakeypath}`);

        await execCommand(`set OPENSSL_CONF=${opensslConfPath}`);

        if (!fs.existsSync(opensslConfPath)) {
            console.error("OpenSSL configuration file not found!");
            return res.status(500).json({ message: "OpenSSL configuration file not found" });
        }

        console.log("Creating self-signed certificate for CA...");
        await execCommand(`openssl req -new -x509 -key ${cakeypath} -out ${cacert} -config ${opensslConfPath}`);

        console.log("Saving CSR and key received from Server 1...");
        fs.writeFileSync(csrPath, csrFile.data);

        console.log("Signing the CSR...");
        exec(`openssl x509 -req -days 365 -in ${csrPath} -CA ${cacert} -CAkey ${cakeypath} -CAcreateserial -out ${certPath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error signing CSR: ${error.message}`);
                return res.status(500).json({ message: `Error signing CSR and generating certificate: ${error.message}` });
            }

            const certData = fs.readFileSync(certPath);
            console.log("Returning signed certificate to Server 1...");
            res.status(200).send(certData);
        });
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

app.listen(port, () => {
    console.log(`Trusted Authority Server is running on http://localhost:${port}`);
});