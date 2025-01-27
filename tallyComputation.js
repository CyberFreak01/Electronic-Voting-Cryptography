const axios = require('axios');
const bigInt = require('bigint-crypto-utils');

// const trustedAuthorityServer = 'http://localhost:3000';
// const server = 'http://localhost:5000';

const trustedAuthorityServer = 'http://localhost:3000';
const server = 'http://localhost:5000';

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
        const pubKeyResponse = await axios.get(`${trustedAuthorityServer}/pubkey`);
        const pubKey = pubKeyResponse.data.publicKey;

        return { pubKey };
    } catch (error) {
        console.error('Failed to fetch system data:', error.message);
        return null;
    }
}

function decrypt(cipherText, privateKey) {
    const { lambda, mu, n } = privateKey;
    const nSquared = n ** 2n;

    // L((cipherText^λ mod n^2) - 1) / n
    const l = (x) => (x - 1n) / n;
    const u = bigInt.modPow(cipherText, lambda, nSquared);
    return (l(u) * mu) % n;
}

function add(cipherText1, cipherText2, publicKey) {
    const { nSquared } = publicKey;
    const nSquaredBigInt = BigInt(nSquared);

    let cp1 = cipherText1;
    let cp2 = cipherText2;
    if (typeof cp1 !== 'bigint') {
        cp1 = BigInt(cp1.encryptedVote);
    }

    if (typeof cp2 !== 'bigint') {
        cp2 = BigInt(cp2.encryptedVote);
    }

    return (cp1 * cp2) % nSquaredBigInt;
}


async function computeTally() {
    try {
        const systemData = await fetchSystemData();
        if (!systemData) {
            return res.status(500).json({ message: 'Failed to retrieve system data' });
        }

        const { pubKey } = systemData;
        const response = await axios.get(`${server}/votes`);
        const votes = response.data;
        let encryptedsum = 177994745951696127216181011143719888824770344853315796468312441326024499042532782272050400668696493962652358692943795964805055806915593883760284403647945978451897345804066705710298642045140581603073855993343403707077833680567741064350745370395121225706428373480411932346734367226872866816816929401680382859985281058083990196243886967102657377951096711455402669346439051974027866689304421237632512761462680526830008929465253592794961649720573179059751590018959809333747262283395844010145132140902318014970720687771634601355486890864252334198470912542631744484784327694042561274650253403632857184822131394410610476442207197105391158448413336079700599260281050077375196517058846686760996022883784753654900564554253557185628434395844953306340221726856848593688105382083778396911236604249675934953455009206079039653867087269770119804181118643748325263580087097602439339525995994374770476704166599516952342256471105126794074312827459599526064514983022648458640913450231890684913085811043055682222467962578160726930370473668347551901387613056219043305445108693854994002094457883312456847744425123652373728796599368680422558115755997163566983649204136986875967584896991325417964767332619605745997299579049565310661019419637580270203615515362n;
        for (let vote of votes) {
            encryptedsum = add(encryptedsum, vote, pubKey);
        }

        console.log("Encrypted Tally:", encryptedsum);

        // Request private key approval
        console.log("Requesting private key approval for decryption of tally...");
        const privateKeyRequest = await requestPrivateKey();
        let priKey = privateKeyRequest.privateKey;

        if (!priKey) {
            console.error("Private key reconstruction failed.");
            return;
        }

        priKey.lambda = BigInt(priKey.lambda);
        priKey.mu = BigInt(priKey.mu);
        priKey.n = BigInt(priKey.n);

        const ans = decrypt(encryptedsum, priKey);
        console.log("Decrypted Tally:", ans);

        return ans;

    } catch (error) {
        console.error('Failed to compute tally:', error);
        throw error;
    }
}

computeTally().then((result) => {
    console.log("Final Tally Result:", result);
});
