<p align="center">

<img src="https://img.shields.io/badge/Blockchain-Hyperledger%20Fabric-2F3134?style=for-the-badge&logo=hyperledger&logoColor=white"/>
<img src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black"/>
<img src="https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?style=for-the-badge&logo=node.js&logoColor=white"/>
<img src="https://img.shields.io/badge/Database-PostgreSQL%2016-4169E1?style=for-the-badge&logo=postgresql&logoColor=white"/>
<img src="https://img.shields.io/badge/AI-Fraud%20Detection-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white"/>
<img src="https://img.shields.io/badge/Biometric-Face%2B%2B-00C853?style=for-the-badge"/>

</p>

<h1 align="center">🗳️ LokSetu — AI Powered Blockchain E-Voting Platform</h1>

<p align="center">

Secure • Transparent • Inclusive

</p>

<p align="center">
LokSetu is a **next-generation digital voting platform** designed for India's democratic ecosystem.  
It combines **Blockchain, AI Fraud Detection, and Biometric Authentication** to build a **tamper-proof and transparent election infrastructure**.
</p>

---

# 🚨 Problem Statement

India’s election system faces several issues:

| Problem               | Impact                                    |
| --------------------- | ----------------------------------------- |
| Election Fraud        | Vote manipulation & booth capturing       |
| Voter Impersonation   | Weak identity verification                |
| Lack of Transparency  | Voters cannot verify vote integrity       |
| Manual Infrastructure | Slow and costly elections                 |
| Migrant Voting Issues | Millions cannot vote in home constituency |

**Goal:** Build a secure, scalable and verifiable digital voting system.

---

# 💡 Solution — LokSetu

LokSetu introduces a **multi-layer election security architecture**:

Biometric Identity → Secure Authentication → Blockchain Vote Recording → AI Fraud Monitoring → Transparent Result System

### Core Components

• **Blockchain Ledger** – Hyperledger Fabric stores immutable vote records
• **AI Fraud Detection** – 7 independent engines monitor suspicious behavior
• **Biometric Authentication** – Face++ verifies voter identity
• **Kafka Event System** – scalable real-time vote streaming
• **Admin Monitoring Dashboard** – real-time election analytics

---

# ✨ Key Features

## 👤 Voter Portal

• Biometric Face Authentication
• Secure Blockchain Voting
• One-time Ballot Tokens
• Behavioral Fraud Tracking
• Session Timeout Protection

---

## 🛠️ Admin Dashboard

• Real-time Election Monitoring
• AI Fraud Alerts
• Voter Registration
• Live Result Analytics
• System Logs & Audit Trail
• AI Assistant for Election Monitoring

---

## 🌐 Platform Capabilities

• 13 Indian Languages
• Dark / Light Mode
• Blockchain Verification
• AES-256 Encryption
• Real-Time Updates

---

# 🏗️ System Architecture

```
Voter Portal (React)
        │
        ▼
Backend API (Node + Express)
        │
        ├── PostgreSQL Database
        │
        ├── AI Fraud Detection Engine
        │
        ├── Kafka Event Stream
        │
        ▼
Hyperledger Fabric Blockchain
```

Every vote flows through **secure identity verification → fraud detection → blockchain commit → audit logging**.

---

# 🛠️ Tech Stack

### Frontend

React 19
Vite
TailwindCSS
Recharts
React Router
i18next

---

### Backend

Node.js
Express.js
TypeScript
JWT Authentication
Helmet Security

---

### Database

PostgreSQL 16

---

### Blockchain

Hyperledger Fabric

---

### AI & Fraud Detection

Behavioral Analysis
Graph Network Detection
Bot Detection
IP Cluster Monitoring

---

### Infrastructure

Kafka
Docker
Face++ API

---

# 📁 Project Structure

```
loksetu-platform/

client-admin/
    admin dashboard UI

client-voter/
    voter voting interface

server-core/
    backend API + fraud engine

loksetu-chaincode/
    Hyperledger smart contracts

docker-compose.yml
    infrastructure stack
```

---

# 🚀 Installation

### Clone Repository

```
git clone https://github.com/your-repo/loksetu.git
cd loksetu
```

---

### Install Dependencies

```
npm install
```

---

### Start Infrastructure

```
docker-compose up
```

---

### Start Backend

```
cd server-core
npm run dev
```

---

### Start Admin Dashboard

```
cd client-admin
npm run dev
```

---

### Start Voter Portal

```
cd client-voter
npm run dev
```

---



# 🤖 AI Fraud Detection Engines

LokSetu runs **7 independent AI engines**

| Engine                 | Purpose                         |
| ---------------------- | ------------------------------- |
| Duplicate Detection    | Same voter multiple attempts    |
| Velocity Check         | Vote too fast after login       |
| IP Cluster Detection   | Many votes from same IP         |
| Bot Detection          | Script-based voting             |
| Device Fingerprint     | Same device patterns            |
| Graph Network Analysis | Coordinated fraud               |
| Behavioral AI          | Suspicious mouse/click activity |

---

# 🗄️ Database Tables

| Table               | Purpose                |
| ------------------- | ---------------------- |
| states              | Indian states          |
| constituencies      | election districts     |
| candidates          | election candidates    |
| voters              | registered voters      |
| fraud_alerts        | fraud detection alerts |
| vote_transactions   | blockchain vote logs   |
| ip_tracking         | request monitoring     |
| chatbot_logs        | AI assistant logs      |
| analytics_snapshots | election analytics     |
| system_logs         | audit logs             |

---

# 🔒 Security Features

• Blockchain Immutable Ledger
• AES-256 Encryption
• JWT Authentication
• Rate Limiting
• Behavioral Fraud Detection
• Complete Audit Trail

---

# 🌐 Language Support

LokSetu supports **13 Indian languages**

English
Hindi
Bengali
Tamil
Telugu
Marathi
Gujarati
Kannada
Malayalam
Punjabi
Urdu
Odia
Assamese

---

# 🔮 Future Improvements

• Mobile Voting App
• National-scale deployment
• Zero-Knowledge Proof Voting
• Advanced AI Fraud Detection
• Integration with Election Commission of India

---

# 📄 License

Apache License 2.0

---

<p align="center">

Built for India's Democracy 🇮🇳

</p>
