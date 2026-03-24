<p align="center">

<img src="https://img.shields.io/badge/Blockchain-Hyperledger%20Fabric-2F3134?style=for-the-badge&logo=hyperledger&logoColor=white"/>
<img src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black"/>
<img src="https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?style=for-the-badge&logo=node.js&logoColor=white"/>
<img src="https://img.shields.io/badge/Database-PostgreSQL%2016-4169E1?style=for-the-badge&logo=postgresql&logoColor=white"/>
<img src="https://img.shields.io/badge/AI-Fraud%20Detection-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white"/>
<img src="https://img.shields.io/badge/Biometric-Face%2B%2B-00C853?style=for-the-badge"/>

</p>

<h1 align="center">🗳️ LokSetu — AI-Powered Blockchain E-Voting Platform</h1>

<p align="center">

Secure • Transparent • Inclusive

</p>

<p align="center">
LokSetu is a <strong>next-generation digital voting platform</strong> built for India's democratic infrastructure.  
It combines <strong>Blockchain Security, AI Fraud Detection, and Biometric Authentication</strong> to deliver a transparent and tamper-proof election system.
</p>

---

# 📌 Overview

LokSetu is designed to modernize the electoral process by ensuring:

• Secure identity verification
• Tamper-proof vote storage
• Real-time fraud monitoring
• Transparent result auditing

The platform integrates **Hyperledger Fabric, AI-based anomaly detection, and biometric authentication** to build a trustworthy digital voting ecosystem.

---

# 🚨 Problem Statement

India’s election system faces several structural challenges:

| Problem                   | Impact                                       |
| ------------------------- | -------------------------------------------- |
| Election Fraud            | Booth capturing and vote manipulation        |
| Identity Impersonation    | Fake voters and identity misuse              |
| Lack of Transparency      | Voters cannot verify their vote              |
| Infrastructure Complexity | Costly and time-consuming elections          |
| Migrant Voting Issues     | Millions unable to vote in home constituency |

A modern election platform must be **secure, scalable, transparent, and inclusive**.

---

# 💡 Solution — LokSetu

LokSetu introduces a **multi-layer secure election architecture**:

```
Voter Authentication
        │
        ▼
Biometric Verification (Face++)
        │
        ▼
Secure Vote Casting
        │
        ▼
AI Fraud Detection
        │
        ▼
Blockchain Vote Recording
        │
        ▼
Real-time Monitoring & Analytics
```

This architecture ensures every vote is **verified, immutable, and auditable**.

---

# ✨ Key Features

## 👤 Voter Portal

• Biometric Face Authentication
• Secure Blockchain Vote Casting
• One-time Ballot Token System
• Behavioral Fraud Detection
• Session Security & Timeout

---

## 🛠️ Admin Dashboard

• Real-time Election Monitoring
• AI Fraud Alert System
• Voter Registration Management
• Live Election Results
• Analytics Dashboard
• System Logs & Audit Trail
• AI Assistant for Election Monitoring

---

## 🌐 Platform Capabilities

• 13 Indian Language Support
• Dark / Light Mode
• Blockchain Verification
• Secure Data Encryption
• Real-time system monitoring

---

# 🏗️ System Architecture

```
               ┌─────────────────────┐
               │   Voter Portal      │
               │   React + Vite      │
               └─────────┬───────────┘
                         │
                         ▼
                ┌─────────────────┐
                │ Backend API     │
                │ Node + Express  │
                └───────┬─────────┘
                        │
      ┌─────────────────┼───────────────────┐
      ▼                 ▼                   ▼

 PostgreSQL        Fraud Detection        Kafka
  Database            Engine            Event Queue

                        │
                        ▼
               Hyperledger Fabric
                  Blockchain
```

Each vote is securely processed through **authentication, fraud analysis, and blockchain validation**.

---

# 🛠️ Technology Stack

## Frontend

React 19
Vite
Tailwind CSS
Recharts
React Router
i18next

---

## Backend

Node.js
Express.js
TypeScript
JWT Authentication
Helmet Security Middleware

---

## Database

PostgreSQL 16

---

## Blockchain

Hyperledger Fabric

---

## AI & Fraud Detection

Behavioral Pattern Analysis
Graph Network Detection
Bot Detection Algorithms
IP Cluster Monitoring

---

## Infrastructure

Docker
Kafka
Face++ Biometric API

---

# 📁 Project Structure

```
loksetu-platform/

client-admin/
  Admin dashboard

client-voter/
  Voter voting interface

server-core/
  Backend API + fraud engine

loksetu-chaincode/
  Hyperledger Fabric smart contracts

docker-compose.yml
  Infrastructure services
```

---

# 🚀 Installation Guide

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/Coder-philosopher/loksetu-main.git
cd loksetu-main/LokSetu-main
```

---

## 2️⃣ Install Dependencies

```bash
npm install
```

---

## 3️⃣ Start Infrastructure

```bash
# Ensure Docker is running
docker-compose up -d
```

---

## 4️⃣ Run Backend (Core)

```bash
cd loksetu-platform/loksetu-core
npm install
npm run dev
```

---

## 5️⃣ Run Frontend

### Admin Dashboard
```bash
cd loksetu-platform/client-admin
npm install
npm run dev
```

### Voter Portal
```bash
cd loksetu-platform/client-voter
npm install
npm run dev
```

---

# 🌍 Deployment & Live Access

The platform is configured for global deployment.

| Panel | Live URL |
| --- | --- |
| **Landing Page** | [loksetu.nitrr.in](https://loksetu.nitrr.in) |
| **Voter Panel** | [voter.loksetu.nitrr.in](https://voter.loksetu.nitrr.in) |
| **Admin Panel** | [admin.loksetu.nitrr.in](https://admin.loksetu.nitrr.in) |
| **Backend API** | [backend.loksetu.nitrr.in](https://backend.loksetu.nitrr.in) |

---

# 👥 Team Garud (NIT Raipur)

This project is developed by **Team Garud** at the **National Institute of Technology (NIT), Raipur**.

*   **Rahul Kumar**
*   **Kunwar Singh**
*   **Sachin Upadhyay**
*   **Abdullah Shaikh**

---

# 🤖 AI Fraud Detection

LokSetu uses **7 independent AI engines**:

| Engine                 | Function                          |
| ---------------------- | --------------------------------- |
| Duplicate Detection    | Prevents multiple voting          |
| Velocity Detection     | Detects abnormal voting speed     |
| IP Monitoring          | Identifies suspicious IP clusters |
| Bot Detection          | Prevents automated voting         |
| Device Fingerprinting  | Tracks repeated devices           |
| Graph Network Analysis | Detects coordinated fraud         |
| Behavioral AI          | Detects unusual mouse activity    |

---

# 🗄️ Database Tables

| Table               | Purpose              |
| ------------------- | -------------------- |
| states              | Indian states        |
| constituencies      | election districts   |
| candidates          | election candidates  |
| voters              | registered voters    |
| fraud_alerts        | fraud alerts         |
| vote_transactions   | blockchain vote logs |
| ip_tracking         | request monitoring   |
| chatbot_logs        | AI logs              |
| analytics_snapshots | analytics history    |
| system_logs         | audit logs           |

---

# 🔒 Security Features

• Blockchain immutable ledger
• AES-256 data encryption
• JWT authentication
• Rate limiting protection
• AI fraud detection
• Complete audit trail

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

• Mobile Voting Application
• National-scale election deployment
• Zero-Knowledge Proof Voting
• Advanced AI Fraud Prediction
• Integration with Election Commission of India

---

# 📄 License

Apache License 2.0

---

<p align="center">
  <b>Built by Team "Garud" 🦅 (NIT Raipur)</b><br>
  <i>Empowering India's Democracy 🇮🇳</i><br>
  LokSetu — Secure Digital Voting Infrastructure
</p>
