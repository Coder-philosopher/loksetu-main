const { Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const path = require('path');

async function main() {
    const ccp = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'connection-org1.json'), 'utf8'));
    const ca = new FabricCAServices(ccp.certificateAuthorities['ca.org1.example.com'].url);
    const wallet = await Wallets.newFileSystemWallet(path.join(process.cwd(), 'wallet'));

    const adminIdentity = await wallet.get('admin');
    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
    const adminUser = await provider.getUserContext(adminIdentity, 'admin');

    // Register appUserV2 to solve Authentication errors
    const secret = await ca.register({
        enrollmentID: 'appUserV2',
        enrollmentSecret: 'password123',
        role: 'client'
    }, adminUser);

    const enrollment = await ca.enroll({ enrollmentID: 'appUserV2', enrollmentSecret: secret });
    await wallet.put('appUserV2', {
        credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() },
        mspId: 'Org1MSP', type: 'X.509'
    });
    console.log('✅ appUserV2 ready');
}
main();