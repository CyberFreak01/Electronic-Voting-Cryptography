const axios = require('axios');

// const trustedAuthorityServer = 'http://localhost:3000';
// const server = 'http://localhost:5000';

const trustedAuthorityServer = 'http://192.168.214.253:3000';
const server = 'http://192.168.214.128:5000';

async function requestPrivateKey() {
    try {
        const response = await axios.post(`${trustedAuthorityServer}/prikey`);
        return response.data;
    } catch (error) {
        console.error("Failed to request private key:", error.message);
        throw error;
    }
}

async function fetchSystemData() {
  try {
    //   const privateKeyResonse = await axios.get(`${trustedAuthorityServer}/prikey`);
      const pubKeyResponse = await axios.get(`${trustedAuthorityServer}/pubkey`);
      const alphabetResponse = await axios.get(`${trustedAuthorityServer}/alphabet`);
      
      const pubKey = pubKeyResponse.data.publicKey
    //   const priKey = privateKeyResonse.data.privateKey;
      const alphabet = alphabetResponse.data.alphabet;

    //   return { priKey, alphabet, pubKey };
      return { alphabet, pubKey };
  } catch (error) {
      console.error('Failed to fetch system data:', error.message);
      return null;
  }
}

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

function to10(x, alphabet) {
    var y, p, n;
    y = 0;
    p = 1;
    x = x.split("");
    n = x.length;
    while (n--) {
        y += alphabet.indexOf(x[n]) * p;
        p *= alphabet.length;
    }
    return y;
}

function decrypt(a, key, alphabet, p) {
    var d, x, y;
    x = a[1];
    y = modPow(a[0], -key, p);
    d = (x * y) % p;
    d = Math.round(d) % p;
    d %= alphabet.length;
    return alphabet[d - 2];
}

function g(message, key, alphabet, p) {
    var n, m, d, x;
    m = [];
    n = message.length / 8;
    while (n--) {
        x = message[8 * n + 4];
        x += message[8 * n + 5];
        x += message[8 * n + 6];
        x += message[8 * n + 7];
        m.unshift(x);
        x = message[8 * n];
        x += message[8 * n + 1];
        x += message[8 * n + 2];
        x += message[8 * n + 3];
        m.unshift(x);
    }
    x = [];
    d = [];
    n = m.length / 2;
    while (n--) {
        x[0] = m[2 * n];
        x[1] = m[2 * n + 1];
        x[0] = to10(x[0], alphabet);
        x[1] = to10(x[1], alphabet);
        d.push(decrypt(x, key, alphabet, p));
    }
    message = d.join("");
    return message;
}

async function computeTally() {
    try {
        const systemData = await fetchSystemData();
        if (!systemData) {
            console.error("Failed to retrieve system data.");
            return;
        }

        // const { priKey, pubKey, alphabet } = systemData;
        const { pubKey, alphabet } = systemData;
        const p = pubKey[0];

        const response = await axios.get(`${server}/votes`);
        const votes = response.data;

        // Request private key approval
        const privateKeyRequest = await requestPrivateKey();
        const priKey = privateKeyRequest.privateKey;

        if (!priKey) {
            console.error("Private key reconstruction failed.");
            return;
        }

        let tally = {
            contestant1: 0,
            contestant2: 0,
            contestant3: 0,
        };

        for (let vote of votes) {
            const encryptedVote = vote.encryptedVote;

            const decryptedVote = g(encryptedVote, priKey, alphabet, p);

            if (decryptedVote === '1') {
                tally.contestant1++;
            } else if (decryptedVote === '-1') {
                tally.contestant2++;
            } else if (decryptedVote === '0') {
                tally.contestant3++;
            }
        }

        return tally;

    } catch (error) {
        console.error('Failed to compute tally:', error);
        throw error;
    }
}

computeTally().then((result) => {
    console.log("Final Tally Result:", result);
});
