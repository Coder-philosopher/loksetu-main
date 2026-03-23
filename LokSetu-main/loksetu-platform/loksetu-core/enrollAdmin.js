/*
 * Member C: Guardian of Trust
 * Script: enrollAdmin.js
 * Purpose: Connects to the CA and issues the Admin Certificate
 */

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // 1. Load the connection profile (The Map)
        const ccpPath = path.resolve(__dirname, 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // 2. Connect to the Certificate Authority (CA)
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

        // 3. Create a wallet to store the credentials
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Using wallet path: ${walletPath}`);

        // 4. Check if Admin is already enrolled
        const identity = await wallet.get('admin');
        if (identity) {
            console.log('An identity for the admin user "admin" already exists in the wallet');
            return;
        }

        // 5. Enroll the Admin
        const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        
        await wallet.put('admin', x509Identity);
        console.log('✅ Success: Successfully enrolled admin user "admin" and imported it into the wallet');

    } catch (error) {
        console.error(`❌ Error: Failed to enroll admin user "admin": ${error}`);
    }
}

main();