# Secure E-Voting System

![E-Voting System](https://static.scientificamerican.com/sciam/cache/file/CF393A78-1DF6-4D70-BF862AC7CA0ACC02_source.jpg)  

This repository contains the implementation of a **Secure Electronic Voting System** leveraging advanced cryptographic techniques to ensure privacy, security, and transparency. The system is based on a multi-authority election scheme and incorporates features such as **homomorphic encryption**, **digital signatures**, and **threshold decryption** for a robust voting process.

---

## Features

### 1. **Homomorphic Encryption**
- Each voter encrypts their choice (e.g., Yes/No) using a **homomorphic encryption algorithm**.
- The encryption guarantees that the tally of votes can be computed **without decrypting individual votes**, ensuring vote secrecy.

![Homomorphic Encryption](https://www.collidu.com/media/catalog/product/img/0/1/01e118345635520609a7d48b3d7f64b4446ecd2031f9352eb1bd8200e7d5d8f3/homomorphic-encryption-slide1.png)  

### 2. **Digital Signatures**
- Voters sign the cryptogram (encrypted vote) using digital signatures.
- This signature proves that the vote originates from an authorized voter, maintaining the system's integrity.

![Digital Signature](https://www.digitalsignaturemart.com/wp-content/uploads/2019/03/Digital-Signature-1688x844.png)

### 3. **Multi-Authority Setup**
- To mitigate risks of vote decryption by a dishonest authority, the decryption key is distributed across **multiple parties** using a **Shamir (t, n)-threshold scheme**.
- At least `t` out of `n` parties must collaborate to reveal the vote tally, ensuring no single authority can compromise the system.

![Shamir's Threshold Scheme](https://slideplayer.com/slide/17207435/99/images/21/Shamir%E2%80%99s%2BThreshold%2BScheme%2Bset%2Bup.jpg)

### 4. **Trusted Setup and Decentralization**
- Initially, a **trusted center** is assumed to set up the system by choosing necessary cryptographic parameters (e.g., primes `p` and `q`).
- However, the system can also operate without a trusted center by employing a secure communication protocol executed by the parties involved.

### 5. **Public-Key Infrastructure**
- A **public-key infrastructure (PKI)** is used to authenticate messages and guarantee the origin of all posted data.
- This ensures that only legitimate participants can interact with the system.

![Public Key Infrastructure](https://certera.com/blog/wp-content/uploads/2023/04/how-pki-public-key-infrastructure-works-jpg.webp)

---

## Communication Model

- The system uses a **bulletin board** as a shared, publicly accessible memory for posting encrypted votes and related cryptographic data.
- The bulletin board allows transparency and verifiability:
  - Every member has a designated section to post messages.
  - No one can delete or modify any information once posted.
  - The complete board is viewable by all members, including external observers.

---

## Workflow

1. **Voter Registration**  
   Each voter receives a cryptographic key pair for encryption and digital signatures.  

2. **Vote Casting**  
   - The voter encrypts their choice using homomorphic encryption.
   - The encrypted vote is signed and posted to the bulletin board.

3. **Vote Collection**  
   - All encrypted votes are stored on the bulletin board.
   - Votes remain confidential as they are not decrypted during this stage.

4. **Tallying**  
   - The authorities compute the tally directly on the encrypted votes.
   - Decryption is performed collaboratively by at least `t` out of `n` authorities, ensuring security.

---

## Advantages

- **Privacy**: Individual votes remain confidential throughout the process.  
- **Security**: Threshold decryption prevents any single authority from compromising the system.  
- **Transparency**: The bulletin board model allows public verifiability of the election process.  
- **Efficiency**: The system is optimized for low time and communication complexity.  

---

## Technologies and Concepts Used

- **Cryptography**: Homomorphic Encryption, Digital Signatures, Shamir Threshold Scheme.  
- **Public-Key Infrastructure (PKI)**: For message authentication.  
- **Distributed Systems**: Multi-authority setup for decentralized decryption.  

---

## Future Enhancements

- Replace the trusted center with a decentralized protocol for setting up cryptographic parameters.  
- Optimize the communication model for larger-scale elections.  
- Implement advanced user interfaces for ease of use by voters and authorities.  

---

## References

This system is based on the theoretical framework introduced in the research paper by **[CraGenSch97]**, which outlines the secure multi-authority election scheme.

---

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
