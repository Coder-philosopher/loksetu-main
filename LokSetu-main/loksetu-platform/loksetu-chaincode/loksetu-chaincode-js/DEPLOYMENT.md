# LokSetu JS Chaincode Deployment Guide

This guide deploys the production JavaScript smart contract from `loksetu-chaincode-js` to a real Hyperledger Fabric network.

## 1) Prerequisites

- Ubuntu 22.04/24.04 on EC2 or Oracle Cloud VM
- Docker + Docker Compose
- Node.js 18+
- `jq`, `curl`, `git`
- Hyperledger Fabric binaries (`peer`, `orderer`, `cryptogen`, `configtxgen`, `osnadmin`, `fabric-ca-client`)

## 2) Prepare Host

```bash
sudo apt update
sudo apt install -y docker.io docker-compose jq curl git
sudo usermod -aG docker $USER
newgrp docker
node -v
npm -v
docker ps
```

## 3) Install Fabric Samples + Binaries

```bash
cd ~
curl -sSL https://bit.ly/2ysbOFE | bash -s
```

This creates `fabric-samples/` with `bin/` and `config/`.

## 4) Bring Up Test Network (or your target Fabric network)

```bash
cd ~/fabric-samples/test-network
./network.sh down
./network.sh up createChannel -c mychannel -ca
```

## 5) Deploy LokSetu Chaincode (JavaScript)

From this repository, the chaincode path is:

- `loksetu-platform/loksetu-chaincode/loksetu-chaincode-js`

Example deployment command from test-network:

```bash
cd ~/fabric-samples/test-network
./network.sh deployCC \
  -ccn LokSetu \
  -ccp /absolute/path/to/loksetu-platform/loksetu-chaincode/loksetu-chaincode-js \
  -ccl javascript \
  -c mychannel
```

If you need to set a sequence/version:

```bash
./network.sh deployCC \
  -ccn LokSetu \
  -ccp /absolute/path/to/loksetu-platform/loksetu-chaincode/loksetu-chaincode-js \
  -ccl javascript \
  -ccv 2.0 \
  -ccs 1 \
  -c mychannel
```

## 6) Verify Contract Works

### Init Ledger

```bash
peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls \
  --cafile "$PWD/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C mychannel -n LokSetu \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles "$PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles "$PWD/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"InitLedger","Args":[]}'
```

### Register + Mint + Cast + Query

```bash
peer chaincode invoke -C mychannel -n LokSetu -c '{"function":"CreateVoter","Args":["EPIC123","bio_hash_x","Delhi","ND-1"]}'
peer chaincode invoke -C mychannel -n LokSetu -c '{"function":"MintVoteToken","Args":["ELECTION_2026_LS","EPIC123"]}'
peer chaincode invoke -C mychannel -n LokSetu -c '{"function":"CastVote","Args":["ELECTION_2026_LS","EPIC123","cand-1","Delhi","Booth-42"]}'
peer chaincode query  -C mychannel -n LokSetu -c '{"function":"GetAllAssets","Args":[]}'
```

## 7) Wire Gateway to Real Fabric

In `loksetu-core/server.js`:

- Ensure `CHAINCODE_NAME = 'LokSetu'`
- Ensure channel is `mychannel` (or your deployed channel)
- Provide real `connection-org1.json`
- Ensure wallet identity `appUserV2` exists

Then start gateway:

```bash
cd /absolute/path/to/loksetu-platform/loksetu-core
npm install
node server.js
```

## 8) Production Notes (EC2/Oracle)

- Set proper security groups/firewall rules for peer/orderer only inside private subnet/VPN.
- Keep CA and MSP material off public paths.
- Use managed reverse proxy + TLS for gateway API.
- Pin chaincode version/sequence in CI pipeline.
- Use CouchDB for rich query analytics and index definitions.
- Enable monitoring for peer/orderer/container health.

## 9) Troubleshooting Quick Checks

- `docker ps` (all peers/orderer up)
- `peer lifecycle chaincode querycommitted --channelID mychannel --name LokSetu`
- check chaincode container logs:

```bash
docker logs -f $(docker ps --format '{{.Names}}' | grep dev-peer | head -1)
```

If deploy fails with Docker build errors, see parent doc:

- `loksetu-chaincode/FIX_CHAINCODE_DEPLOY.md`
