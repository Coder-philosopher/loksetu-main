'use strict';

const { Contract } = require('fabric-contract-api');

class LokSetuVotingContract extends Contract {

    async InitLedger(ctx) {
        console.info('============= START : Initialize LokSetu Ledger ===========');

        const bootstrapVoters = [
            {
                voterID: 'V001',
                biometricHash: 'dummy_hash_123',
                homeState: 'Delhi',
                home_constituency_id: '1',
                did: null,
                currentStatus: 'ACTIVE',
                hasVoted: false,
                docType: 'voter',
                createdAt: this._getTxTimestamp(ctx),
                updatedAt: this._getTxTimestamp(ctx),
            },
        ];

        for (const voter of bootstrapVoters) {
            const voterKey = this._voterKey(voter.voterID);
            const exists = await this._stateExists(ctx, voterKey);
            if (!exists) {
                await ctx.stub.putState(voterKey, Buffer.from(JSON.stringify(voter)));
            }
        }

        console.info('============= END : Initialize LokSetu Ledger ===========');
    }

    _getTxTimestamp(ctx) {
        const txTimestamp = ctx.stub.getTxTimestamp();
        const seconds = Number(txTimestamp.seconds && txTimestamp.seconds.low !== undefined
            ? txTimestamp.seconds.low
            : txTimestamp.seconds || 0);
        return new Date(seconds * 1000).toISOString();
    }

    _requireString(value, fieldName) {
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new Error(`${fieldName} is required.`);
        }
        return value.trim();
    }

    _normalizeState(state) {
        return String(state || '').trim().toLowerCase();
    }

    _voterKey(voterID) {
        return `VOTER_${voterID}`;
    }

    _legacyVoterKey(voterID) {
        return voterID;
    }

    _ballotKey(txId) {
        return `BALLOT_${txId}`;
    }

    async _stateExists(ctx, key) {
        const bytes = await ctx.stub.getState(key);
        return bytes && bytes.length > 0;
    }

    async _readStateJSON(ctx, key, notFoundMessage) {
        const bytes = await ctx.stub.getState(key);
        if (!bytes || bytes.length === 0) {
            throw new Error(notFoundMessage);
        }
        return JSON.parse(bytes.toString());
    }

    async _readVoterCompat(ctx, voterID) {
        const prefixedKey = this._voterKey(voterID);
        const prefixedBytes = await ctx.stub.getState(prefixedKey);
        if (prefixedBytes && prefixedBytes.length > 0) {
            return { voterKey: prefixedKey, voter: JSON.parse(prefixedBytes.toString()) };
        }

        const legacyKey = this._legacyVoterKey(voterID);
        const legacyBytes = await ctx.stub.getState(legacyKey);
        if (legacyBytes && legacyBytes.length > 0) {
            return { voterKey: legacyKey, voter: JSON.parse(legacyBytes.toString()) };
        }

        throw new Error(`Voter ${voterID} does not exist.`);
    }

    async getVoteTokenKey(ctx, electionId, voterID) {
        return ctx.stub.createCompositeKey('VOTE_TOKEN', [electionId, voterID]);
    }

    async getDidKey(ctx, did) {
        return ctx.stub.createCompositeKey('DID', [did]);
    }

    async CreateVoter(ctx, voterID, biometricHash, homeState, homeConstituencyId = '', did = '') {
        const cleanVoterID = this._requireString(voterID, 'voterID');
        const cleanBiometricHash = this._requireString(biometricHash, 'biometricHash');
        const cleanState = this._requireString(homeState, 'homeState');

        const voterKey = this._voterKey(cleanVoterID);
        const alreadyExists = await this._stateExists(ctx, voterKey);
        if (alreadyExists) {
            throw new Error(`Voter ${cleanVoterID} already exists.`);
        }

        const now = this._getTxTimestamp(ctx);
        const voter = {
            voterID: cleanVoterID,
            biometricHash: cleanBiometricHash,
            homeState: cleanState,
            home_constituency_id: homeConstituencyId ? String(homeConstituencyId).trim() : '',
            did: did ? String(did).trim() : null,
            currentStatus: 'ACTIVE',
            hasVoted: false,
            docType: 'voter',
            createdAt: now,
            updatedAt: now,
        };

        await ctx.stub.putState(voterKey, Buffer.from(JSON.stringify(voter)));
        return JSON.stringify(voter);
    }

    async ReadVoter(ctx, voterID) {
        const cleanVoterID = this._requireString(voterID, 'voterID');
        const { voter } = await this._readVoterCompat(ctx, cleanVoterID);
        return JSON.stringify(voter);
    }

    async VoterExists(ctx, voterID) {
        const cleanVoterID = this._requireString(voterID, 'voterID');
        const prefixedExists = await this._stateExists(ctx, this._voterKey(cleanVoterID));
        if (prefixedExists) return true;
        return this._stateExists(ctx, this._legacyVoterKey(cleanVoterID));
    }

    async RegisterDID(ctx, did, didDocumentHash) {
        const cleanDid = this._requireString(did, 'did');
        const cleanDidHash = this._requireString(didDocumentHash, 'didDocumentHash');

        const didKey = await this.getDidKey(ctx, cleanDid);
        const existing = await ctx.stub.getState(didKey);
        if (existing && existing.length > 0) {
            throw new Error(`DID ${cleanDid} is already registered.`);
        }

        const didRecord = {
            docType: 'did',
            did: cleanDid,
            didDocumentHash: cleanDidHash,
            status: 'ACTIVE',
            createdAt: this._getTxTimestamp(ctx),
        };

        await ctx.stub.putState(didKey, Buffer.from(JSON.stringify(didRecord)));
        return JSON.stringify(didRecord);
    }

    async LinkVoterDID(ctx, voterID, did) {
        const cleanVoterID = this._requireString(voterID, 'voterID');
        const cleanDid = this._requireString(did, 'did');

        const { voterKey, voter } = await this._readVoterCompat(ctx, cleanVoterID);
        const didKey = await this.getDidKey(ctx, cleanDid);
        const didRecord = await this._readStateJSON(ctx, didKey, `DID ${cleanDid} does not exist.`);

        if (didRecord.status !== 'ACTIVE') {
            throw new Error(`DID ${cleanDid} is not active.`);
        }

        voter.did = cleanDid;
        voter.updatedAt = this._getTxTimestamp(ctx);

        await ctx.stub.putState(voterKey, Buffer.from(JSON.stringify(voter)));
        return JSON.stringify(voter);
    }

    async MintVoteToken(ctx, electionId, voterID, zkEligibilityCommitment = '') {
        const cleanElectionId = this._requireString(electionId, 'electionId');
        const cleanVoterID = this._requireString(voterID, 'voterID');

        const { voter } = await this._readVoterCompat(ctx, cleanVoterID);
        if (voter.currentStatus !== 'ACTIVE') {
            throw new Error(`Cannot mint token: Voter ${cleanVoterID} is not ACTIVE.`);
        }

        const tokenKey = await this.getVoteTokenKey(ctx, cleanElectionId, cleanVoterID);
        const tokenBytes = await ctx.stub.getState(tokenKey);
        if (tokenBytes && tokenBytes.length > 0) {
            const existingToken = JSON.parse(tokenBytes.toString());
            if (existingToken.isUsed === false) {
                throw new Error(`Token already exists for Voter ${cleanVoterID}`);
            }
        }

        const token = {
            docType: 'voteToken',
            electionId: cleanElectionId,
            voterID: cleanVoterID,
            isUsed: false,
            zkEligibilityCommitment: zkEligibilityCommitment ? String(zkEligibilityCommitment).trim() : null,
            issuedAt: this._getTxTimestamp(ctx),
            issuedBy: ctx.clientIdentity.getID(),
        };

        await ctx.stub.putState(tokenKey, Buffer.from(JSON.stringify(token)));
        return JSON.stringify(token);
    }

    async ReadVoteToken(ctx, electionId, voterID) {
        const cleanElectionId = this._requireString(electionId, 'electionId');
        const cleanVoterID = this._requireString(voterID, 'voterID');
        const tokenKey = await this.getVoteTokenKey(ctx, cleanElectionId, cleanVoterID);
        const token = await this._readStateJSON(ctx, tokenKey, `Vote token for voter ${cleanVoterID} and election ${cleanElectionId} not found.`);
        return JSON.stringify(token);
    }

    async CastVote(ctx, electionId, voterID, candidateID, candidateState, boothLocation, encryptedVotePayload = '', zkProof = '') {
        const cleanElectionId = this._requireString(electionId, 'electionId');
        const cleanVoterID = this._requireString(voterID, 'voterID');
        const cleanCandidateID = this._requireString(candidateID, 'candidateID');
        const cleanCandidateState = this._requireString(candidateState, 'candidateState');
        const cleanBoothLocation = String(boothLocation || '').trim() || 'UNKNOWN';

        const { voterKey, voter } = await this._readVoterCompat(ctx, cleanVoterID);

        if (voter.currentStatus !== 'ACTIVE') {
            throw new Error(`Voter ${cleanVoterID} is not ACTIVE.`);
        }

        const tokenKey = await this.getVoteTokenKey(ctx, cleanElectionId, cleanVoterID);
        const tokenBytes = await ctx.stub.getState(tokenKey);
        if (!tokenBytes || tokenBytes.length === 0) {
            throw new Error(`SECURITY VIOLATION: No valid Vote Token found for ${cleanVoterID}.`);
        }

        const token = JSON.parse(tokenBytes.toString());
        if (token.isUsed === true) {
            throw new Error('SECURITY ALERT: Double Voting Attempt Detected!');
        }

        if (token.electionId !== cleanElectionId || token.voterID !== cleanVoterID) {
            throw new Error('SECURITY VIOLATION: Vote token does not match voter/election.');
        }

        if (token.zkEligibilityCommitment && zkProof) {
            const cleanProof = String(zkProof).trim();
            if (cleanProof !== token.zkEligibilityCommitment) {
                throw new Error('SECURITY VIOLATION: Invalid ZK proof commitment.');
            }
        }

        if (this._normalizeState(voter.homeState) !== this._normalizeState(cleanCandidateState)) {
            throw new Error('Invalid Ballot: State Mismatch.');
        }

        const txTime = this._getTxTimestamp(ctx);

        token.isUsed = true;
        token.usedAt = txTime;
        token.burnLocation = cleanBoothLocation;

        // Keep this legacy flag for compatibility with existing off-chain checks.
        voter.hasVoted = true;
        voter.updatedAt = txTime;

        const voteRecord = {
            docType: 'ballot',
            electionId: cleanElectionId,
            candidateID: cleanCandidateID,
            constituency: voter.home_constituency_id || '',
            state: voter.homeState,
            castAt: cleanBoothLocation,
            timestamp: txTime,
            encryptedVotePayload: encryptedVotePayload ? String(encryptedVotePayload).trim() : null,
            zkProof: zkProof ? String(zkProof).trim() : null,
            did: voter.did || null,
        };

        await ctx.stub.putState(tokenKey, Buffer.from(JSON.stringify(token)));
        await ctx.stub.putState(voterKey, Buffer.from(JSON.stringify(voter)));

        const txId = ctx.stub.getTxID();
        await ctx.stub.putState(this._ballotKey(txId), Buffer.from(JSON.stringify(voteRecord)));

        return txId;
    }

    async CastEncryptedVote(ctx, electionId, voterID, encryptedVotePayload, ballotCommitment, candidateState, boothLocation, zkProof = '') {
        const cleanEncryptedPayload = this._requireString(encryptedVotePayload, 'encryptedVotePayload');
        const cleanCommitment = this._requireString(ballotCommitment, 'ballotCommitment');

        // For encrypted-only ballots, store commitment in candidateID field to preserve existing analytics schema shape.
        return this.CastVote(
            ctx,
            electionId,
            voterID,
            cleanCommitment,
            candidateState,
            boothLocation,
            cleanEncryptedPayload,
            zkProof
        );
    }

    async TransferVoter(ctx, voterID, newState, homeConstituencyId) {
        const cleanVoterID = this._requireString(voterID, 'voterID');
        const cleanState = this._requireString(newState, 'newState');

        const { voterKey, voter } = await this._readVoterCompat(ctx, cleanVoterID);

        voter.homeState = cleanState;
        voter.home_constituency_id = homeConstituencyId ? String(homeConstituencyId).trim() : '';
        voter.updatedAt = this._getTxTimestamp(ctx);

        await ctx.stub.putState(voterKey, Buffer.from(JSON.stringify(voter)));
        return `Success: Voter moved to ${cleanState}`;
    }

    async BulkRegisterVoters(ctx, votersDataJSON) {
        const voters = JSON.parse(this._requireString(votersDataJSON, 'votersDataJSON'));
        if (!Array.isArray(voters)) {
            throw new Error('votersDataJSON must be a JSON array.');
        }

        const now = this._getTxTimestamp(ctx);
        let created = 0;
        let updated = 0;

        for (const voter of voters) {
            if (!voter || !voter.voterID || !voter.biometricHash || !voter.homeState) {
                continue;
            }

            const voterID = String(voter.voterID).trim();
            const voterKey = this._voterKey(voterID);
            const exists = await this.VoterExists(ctx, voterID);

            if (!exists) {
                const voterRecord = {
                    voterID,
                    biometricHash: String(voter.biometricHash).trim(),
                    homeState: String(voter.homeState).trim(),
                    home_constituency_id: voter.home_constituency_id ? String(voter.home_constituency_id).trim() : '',
                    did: voter.did ? String(voter.did).trim() : null,
                    currentStatus: 'ACTIVE',
                    hasVoted: false,
                    docType: 'voter',
                    createdAt: now,
                    updatedAt: now,
                };
                await ctx.stub.putState(voterKey, Buffer.from(JSON.stringify(voterRecord)));
                created += 1;
                continue;
            }

            const { voterKey: existingVoterKey, voter: existing } = await this._readVoterCompat(ctx, voterID);
            existing.biometricHash = String(voter.biometricHash).trim();
            existing.homeState = String(voter.homeState).trim();
            if (voter.home_constituency_id !== undefined) {
                existing.home_constituency_id = String(voter.home_constituency_id || '').trim();
            }
            if (voter.did !== undefined) {
                existing.did = voter.did ? String(voter.did).trim() : null;
            }
            existing.updatedAt = now;
            await ctx.stub.putState(existingVoterKey, Buffer.from(JSON.stringify(existing)));
            updated += 1;
        }

        return JSON.stringify({ created, updated, total: voters.length });
    }

    async ReadBallot(ctx, txId) {
        const cleanTxId = this._requireString(txId, 'txId');
        const ballot = await this._readStateJSON(ctx, this._ballotKey(cleanTxId), `Ballot ${cleanTxId} not found.`);
        return JSON.stringify(ballot);
    }

    async QueryElectionBallots(ctx, electionId) {
        const cleanElectionId = this._requireString(electionId, 'electionId');
        const all = JSON.parse(await this.GetAllAssets(ctx));
        const ballots = all.filter((item) => item.Record && item.Record.docType === 'ballot' && item.Record.electionId === cleanElectionId);
        return JSON.stringify(ballots);
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
            } catch (error) {
                record = strValue;
            }
            allResults.push({ Key: result.value.key, Record: record });
            result = await iterator.next();
        }

        await iterator.close();
        return JSON.stringify(allResults);
    }

    async GetLedgerStats(ctx) {
        const all = JSON.parse(await this.GetAllAssets(ctx));

        let voters = 0;
        let ballots = 0;
        let activeTokens = 0;
        let usedTokens = 0;

        for (const item of all) {
            if (!item.Record || typeof item.Record !== 'object') continue;
            if (item.Record.docType === 'voter') voters += 1;
            if (item.Record.docType === 'ballot') ballots += 1;
            if (item.Record.docType === 'voteToken') {
                if (item.Record.isUsed) usedTokens += 1;
                else activeTokens += 1;
            }
        }

        return JSON.stringify({
            voters,
            ballots,
            activeTokens,
            usedTokens,
            generatedAt: this._getTxTimestamp(ctx),
        });
    }
}

module.exports.LokSetuVotingContract = LokSetuVotingContract;
module.exports.VoterContract = LokSetuVotingContract;
module.exports.contracts = [LokSetuVotingContract];
