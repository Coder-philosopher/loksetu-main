import axios from 'axios';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

/**
 * Blockchain Service — interfaces with the Hyperledger Fabric gateway.
 * Handles vote recording, voter registration, and transaction queries.
 */
export class BlockchainService {
  private gatewayUrl: string;

  constructor() {
    this.gatewayUrl = GATEWAY_URL;
  }

  /** Register a voter on the blockchain ledger */
  async registerVoter(voterId: string, biometricHash: string, homeState: string): Promise<{ success: boolean; txId?: string }> {
    try {
      const res = await axios.post(`${this.gatewayUrl}/register-voter`, {
        voterId,
        biometricHash,
        homeState,
      });
      return { success: true, txId: res.data.txId };
    } catch (err: any) {
      console.error('[BlockchainService] registerVoter failed:', err.message);
      throw new Error(err.response?.data?.error || 'Blockchain registration failed');
    }
  }

  /** Mint a ballot token for a voter */
  async mintToken(electionId: string, voterID: string): Promise<{ success: boolean; txId?: string }> {
    try {
      const res = await axios.post(`${this.gatewayUrl}/mint-token`, {
        electionId,
        voterID,
      });
      return { success: true, txId: res.data.txId };
    } catch (err: any) {
      if (err.response?.status === 409) {
        return { success: true }; // Token already exists — fine
      }
      console.error('[BlockchainService] mintToken failed:', err.message);
      throw err;
    }
  }

  /** Cast a vote on the blockchain */
  async castVote(params: {
    electionId: string;
    voterID: string;
    candidateID: number;
    candidateState: string;
    boothLocation: string;
  }): Promise<{ success: boolean; txId?: string }> {
    try {
      const res = await axios.post(`${this.gatewayUrl}/cast-vote`, params);
      return { success: true, txId: res.data.txId };
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message;
      if (errMsg.includes('Double Voting')) {
        throw new Error('DOUBLE_VOTE_DETECTED');
      }
      if (errMsg.includes('Vote Token')) {
        throw new Error('INVALID_TOKEN');
      }
      throw new Error(errMsg);
    }
  }

  /** Query a voter from the blockchain */
  async queryVoter(voterId: string): Promise<any> {
    try {
      const res = await axios.get(`${this.gatewayUrl}/query/${voterId}`);
      const rawData = res.data.response || res.data;
      return typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    } catch (err: any) {
      return null;
    }
  }

  /** Transfer voter to new state/constituency */
  async transferVoter(voterId: string, newState: string, newConstituencyId: string): Promise<{ success: boolean; txId?: string }> {
    try {
      const res = await axios.post(`${this.gatewayUrl}/change-state`, {
        voterId,
        newState,
        newConstituencyId,
      });
      return { success: true, txId: res.data.txId };
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Blockchain transfer failed');
    }
  }

  /** Get transaction log from blockchain gateway */
  async getTransactionLog(): Promise<any[]> {
    try {
      const res = await axios.get(`${this.gatewayUrl}/tx-log`);
      return res.data.transactions || [];
    } catch {
      return [];
    }
  }

  /** Check gateway health */
  async checkHealth(): Promise<{ status: string; latencyMs: number }> {
    try {
      const start = Date.now();
      const res = await fetch(`${this.gatewayUrl}/query-all`);
      return { status: res.ok ? 'healthy' : 'degraded', latencyMs: Date.now() - start };
    } catch {
      return { status: 'unhealthy', latencyMs: 0 };
    }
  }
}

export const blockchainService = new BlockchainService();
