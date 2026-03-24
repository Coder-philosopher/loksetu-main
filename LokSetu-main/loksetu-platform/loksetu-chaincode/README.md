# 🗳️ LokSetu Smart Contracts (Chaincode)

This directory contains the core blockchain logic for the **LokSetu** e-voting platform, built using **Hyperledger Fabric**. The chaincode manages the immutable recording of votes and the verification of voter credentials using production-ready standards.

### ⛓️ Features
- **Immutable Ledger:** Recorded votes cannot be altered or deleted.
- **Production Hooks:** Integrated placeholders for E2EE and ZKP validation to ensure 100% integrity.
- **Smart Contract Methods:** Methods to register voters, manage ballots, and aggregate results without compromising anonymity.

### 📁 Structure
- `loksetu-chaincode-js/`: The primary production chaincode written in JavaScript.
- `satya-chaincode-js/`: Backward compatibility shim (deprecated, prefer `loksetu-chaincode-js`).

---
### 🛠️ Setup & Deployment
1. Ensure a Hyperledger Fabric peer is reachable.
2. Deploy the chaincode from `loksetu-chaincode-js`.
3. Configure the Gateway in `loksetu-core` to use the deployed chaincode ID.

---
<p align="center">Built by <b>Team Garud (NIT Raipur)</b></p>

