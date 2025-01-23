const express = require('express')
const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const app = express();
const port = 3000;

app.use(express.json());

var Alphabet = "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ π®ƒ©∆";
Alphabet = Alphabet.split("");

//ElGamal algorithm
const p = 91744613; 
const gen = 69; 
const C = 123456;
const B = modPow(gen, C, p);

const n = 5;
const k = 3;
let activeVotes = {};

function modInv(gen, mod) {
    var v, d, u, t, c, q;
    v = 1;
    d = gen;
    t = 1;
    c = mod % gen;
    u = Math.floor(mod / gen);
    while (d > 1) {
        q = Math.floor(d / c);
        d = d % c;
        v = v + q * u;
        if (d) {
            q = Math.floor(c / d);
            c = c % d;
            u = u + q * v;
        }
    }
    return d ? v : mod - u;
}

function modPow(base, exp, mod) {
    var c, x;
    if (exp === 0) {
        return 1;
    } else if (exp < 0) {
        exp = -exp;
        base = modInv(base, mod);
    }
    c = 1;
    while (exp > 0) {
        if (exp % 2 === 0) {
            base = (base * base) % mod;
            exp /= 2;
        } else {
            c = (c * base) % mod;
            exp--;
        }
    }
    return c;
}

// t-shamir
function getRandomInt(max) {
    return Math.floor(crypto.randomInt(max));
}

function generateShares(secret, n, k, prime) {
    let coefficients = [secret];
    for (let i = 1; i < k; i++) {
        coefficients.push(getRandomInt(prime));
    }
    
    let shares = [];
    for (let i = 1; i <= n; i++) {
        let x = i;
        let y = coefficients.reduce((sum, coef, exp) => {
            return (sum + (coef * Math.pow(x, exp)) % prime) % prime;
        }, 0);
        shares.push({x, y});
    }
    return shares;
}

function reconstructSecret(shares, prime) {
    let secret = 0;
    for (let i = 0; i < shares.length; i++) {
        let {x: xi, y: yi} = shares[i];
        let product = yi;
        for (let j = 0; j < shares.length; j++) {
            if (i !== j) {
                let {x: xj} = shares[j];
                let num = xj;
                let den = (xi - xj + prime) % prime;
                product = (product * num * modInv(den, prime)) % prime;
            }
        }
        secret = (secret + product) % prime;
    }
    return secret;
}

const shares = generateShares(C, n, k, p);

// console.log('Generated shares:', shares);

// const reconstructedSecret = reconstructSecret(shares.slice(0, k), p);
// console.log('Reconstructed secret:', reconstructedSecret);

const System = {
    pubKey: [p, gen, B],
    priKey: C,
    Alphabet : Alphabet,
    shares: shares,
};

// module.exports = System;
app.get("/pubkey", (req, res) => {
    res.json({ publicKey: System.pubKey });
});

app.post("/prikey", async (req, res) => {
    // res.json({ privateKey: System.priKey });

    const newRequestId = crypto.randomUUID();
    activeVotes[newRequestId] = { approvals: 0, rejections: 0 };

    for (let i = 1; i <= n; i++) {
        console.log(`Participant ${i} Share:`, shares[i-1]);
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

    if (activeVotes[newRequestId].approvals >= k) {
        const selectedShares = shares.slice(0, k);
        const reconstructedSecret = reconstructSecret(selectedShares, p);
        delete activeVotes[newRequestId]; // Clean up votes

        res.json({
            success: true,
            privateKey: reconstructedSecret,
            message: "Private key successfully reconstructed.",
        });
    } else {
        const randomPrivateKey = getRandomInt(p);

        res.json({
            success: false, 
            privateKey: randomPrivateKey,
            message: "Not enough approvals. Returning a random private key.",
        });
    }
});

app.get("/alphabet", (req, res) => {
    res.json({ alphabet: System.Alphabet });
});

app.listen(port, () => {
    console.log(`Trusted Authority Server is running on http://localhost:${port}`);
});