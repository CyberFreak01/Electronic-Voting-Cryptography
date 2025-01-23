const axios = require('axios');

// const trustedAuthorityServer = 'http://localhost:3000';
// const server = 'http://localhost:5000';

const trustedAuthorityServer = 'http://192.168.214.253:3000';
const server = 'http://192.168.214.128:5000';

async function fetchSystemData() {
  try {
      const pubKeyResponse = await axios.get(`${trustedAuthorityServer}/pubkey`);
      const alphabetResponse = await axios.get(`${trustedAuthorityServer}/alphabet`);
      
      const pubKey = pubKeyResponse.data.publicKey;
      const alphabet = alphabetResponse.data.alphabet;

      return { pubKey, alphabet };
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

function toAlpha(x, alphabet) {
  var y, p, l, n;
  if (x === 0) {
      return "!!!!";
  }
  y = [];
  n = 4;
  n = Math.ceil(n);
  while (n--) {
      p = Math.pow(alphabet.length, n);
      l = Math.floor(x / p);
      y.push(alphabet[l]);
      x -= l * p;
  }
  y = y.join("");
  return y;
}

function encrypt(key, d, alphabet) {
  var k, a;
  k = Math.ceil(Math.sqrt(Math.random() * Math.random()) * 1E10);
  d = alphabet.indexOf(d) + 2;
  a = [];
  a[0] = modPow(key[1], k, key[0]);
  a[1] = (d * modPow(key[2], k, key[0])) % key[0];
  return a;
}

function f(message, key, alphabet) {
  var n, x, y, w;
  y = [];
  message = message.split("");
  n = message.length;
  while (n--) {
      x = encrypt(key, message[n], alphabet);
      y.push(toAlpha(x[0], alphabet));
      y.push(toAlpha(x[1], alphabet));
  }
  y = y.join("");
  return y;
}

async function castVote(vote) {
  const voteString = String(vote);

  const systemData = await fetchSystemData();
  if (!systemData) {
      console.error("Failed to retrieve system data from the server");
      return;
  }
  
  const { pubKey, alphabet } = systemData;
  // const encryptedVote = System.encrypt(voteString, System.pubKey); 
  const encryptedVote = f(voteString, pubKey, alphabet); 

  console.log(encryptedVote)
  try {
      const response = await axios.post(`${server}/vote`, { encryptedVote });
      console.log(response.data.message);
  } catch (error) {
      console.error('Failed to cast vote:', error.response?.data || error.message);
  }
}

(async () => {
  await castVote(1);
  await castVote(-1);
  await castVote(-1);
  await castVote(-1);
})();

