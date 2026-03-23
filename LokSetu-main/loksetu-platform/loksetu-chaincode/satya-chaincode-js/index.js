'use strict';

const { Contract } = require('fabric-contract-api');

class VoterContract extends Contract {

    async InitLedger(ctx) {
        console.info('============= START : Initialize Ledger ===========');
        // Initial setup remains the same
        const voters = [
            {
                voterID: 'V001',
                biometricHash: 'dummy_hash_123',
                homeState: 'Delhi',
                home_constituency_id: '1',
                currentStatus: 'ACTIVE',
                hasVoted: false,
                docType: 'voter'
            }
        ];

        for (const voter of voters) {
            await ctx.stub.putState(voter.voterID, Buffer.from(JSON.stringify(voter)));
        }
        console.info('============= END : Initialize Ledger ===========');
    }

    // --- HELPER: GET DETERMINISTIC TIMESTAMP ---
    _getTxTimestamp(ctx) {
        // This ensures every peer gets the EXACT same time for this transaction
        const timestamp = ctx.stub.getTxTimestamp();
        return new Date(timestamp.seconds.low * 1000).toISOString();
    }

    async getVoteTokenKey(ctx, electionId, voterID) {
        return ctx.stub.createCompositeKey('VOTE_TOKEN', [electionId, voterID]);
    }

    async MintVoteToken(ctx, electionId, voterID) {
        const voterExists = await this.VoterExists(ctx, voterID);
        if (!voterExists) {
            throw new Error(`Cannot mint token: Voter ${voterID} does not exist.`);
        }

        const tokenKey = await this.getVoteTokenKey(ctx, electionId, voterID);
        const tokenBytes = await ctx.stub.getState(tokenKey);
        if (tokenBytes && tokenBytes.length > 0) {
            throw new Error(`Token already exists for Voter ${voterID}`);
        }

        const token = {
            docType: 'voteToken',
            electionId: electionId,
            voterID: voterID,
            isUsed: false,
            // 🛑 FIX: Use deterministic timestamp
            issuedAt: this._getTxTimestamp(ctx) 
        };

        await ctx.stub.putState(tokenKey, Buffer.from(JSON.stringify(token)));
        return JSON.stringify(token);
    }

    async CastVote(ctx, electionId, voterID, candidateID, candidateState, boothLocation) {
        // 1. Get Voter
        const voterJSON = await ctx.stub.getState(voterID);
        if (!voterJSON || voterJSON.length === 0) {
            throw new Error(`Voter ${voterID} is not registered.`);
        }
        const voter = JSON.parse(voterJSON.toString());

        // 2. Get Token
        const tokenKey = await this.getVoteTokenKey(ctx, electionId, voterID);
        const tokenBytes = await ctx.stub.getState(tokenKey);
        
        if (!tokenBytes || tokenBytes.length === 0) {
            throw new Error(`SECURITY VIOLATION: No valid Vote Token found for ${voterID}.`);
        }

        const token = JSON.parse(tokenBytes.toString());

        if (token.isUsed === true) {
            throw new Error(`SECURITY ALERT: Double Voting Attempt Detected!`);
        }

        if (voter.homeState !== candidateState) {
            throw new Error(`Invalid Ballot: State Mismatch.`);
        }

        // 🛑 FIX: Use deterministic timestamp
        const txTime = this._getTxTimestamp(ctx);

        // 3. Burn Token (Atomic Update)
        token.isUsed = true;
        token.usedAt = txTime; // Safe now
        token.burnLocation = boothLocation;

        voter.hasVoted = true;

        const voteRecord = {
            docType: 'ballot',
            electionId: electionId,
            candidateID: candidateID,
            constituency: voter.home_constituency_id,
            state: voter.homeState,
            castAt: boothLocation,
            timestamp: txTime // Safe now
        };

        await ctx.stub.putState(tokenKey, Buffer.from(JSON.stringify(token))); 
        await ctx.stub.putState(voterID, Buffer.from(JSON.stringify(voter)));  
        
        const txId = ctx.stub.getTxID();
        await ctx.stub.putState(`BALLOT_${txId}`, Buffer.from(JSON.stringify(voteRecord)));

        console.info(`✅ Vote Cast Successfully. Reference: ${txId}`);
        return txId;
    }

    async CreateVoter(ctx, voterID, biometricHash, homeState) {
        const voter = {
            voterID: voterID,
            biometricHash: biometricHash,
            homeState: homeState,
            currentStatus: 'ACTIVE',
            hasVoted: false,
            docType: 'voter'
        };
        await ctx.stub.putState(voterID, Buffer.from(JSON.stringify(voter)));
        return JSON.stringify(voter);
    }

    async ReadVoter(ctx, voterID) {
        const voterJSON = await ctx.stub.getState(voterID);
        if (!voterJSON || voterJSON.length === 0) {
            throw new Error(`The voter ${voterID} does not exist`);
        }
        return voterJSON.toString();
    }

    async VoterExists(ctx, voterID) {
        const voterJSON = await ctx.stub.getState(voterID);
        return voterJSON && voterJSON.length > 0;
    }

    async TransferVoter(ctx, voterID, newState, home_constituency_id) {
        const voterJSON = await ctx.stub.getState(voterID);
        if (!voterJSON || voterJSON.length === 0) {
            throw new Error(`Voter ${voterID} does not exist.`);
        }
        const voter = JSON.parse(voterJSON.toString());

        if (voter.hasVoted) {
            throw new Error(`SECURITY ALERT: Voter ${voterID} has already voted. Transfer denied.`);
        }

        voter.homeState = newState;
        voter.home_constituency_id = home_constituency_id; 
        
        await ctx.stub.putState(voterID, Buffer.from(JSON.stringify(voter)));
        return `Success: Voter moved to ${newState}`;
    }

    async BulkRegisterVoters(ctx, votersDataJSON) {
        const voters = JSON.parse(votersDataJSON); 
        for (const voter of voters) {
            const exists = await this.VoterExists(ctx, voter.voterID);
            if (!exists) {
                const voterRecord = {
                    voterID: voter.voterID,
                    biometricHash: voter.biometricHash,
                    homeState: voter.homeState,
                    currentStatus: 'ACTIVE',
                    hasVoted: false,
                    docType: 'voter'
                };
                await ctx.stub.putState(voter.voterID, Buffer.from(JSON.stringify(voterRecord)));
            }
        }
    }

    async GetAllAssets(ctx) {
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            allResults.push({ Key: result.value.key, Record: record });
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }
}

module.exports.VoterContract = VoterContract;
module.exports.contracts = [ VoterContract ];