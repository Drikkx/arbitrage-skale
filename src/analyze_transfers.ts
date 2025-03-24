import fs from 'fs';
import path from 'path';
import { formatEther } from 'viem';

const TARGET_ADDRESS = '0x3b0583e48b5F6b85FcE21bE6df42d437AE78B78d';
const FLAG_TOKEN_ADDRESS = '0x082081c8E607ca6C1c53aC093cAb3847ED59C0b0';
const CSV_FILE = path.join(__dirname, '../data/token_transfers_0x3b0583e48b5F6b85FcE21bE6df42d437AE78B78d_2025-03-01_2025-03-24.csv');

interface Transfer {
  from: string;
  to: string;
  value: bigint;
  blockNumber: number;
  timestamp: string;
  txHash: string;
}

function analyzeTransfers(): void {
  try {
    const fileContent = fs.readFileSync(CSV_FILE, 'utf8');
    if (!fileContent) {
      console.error('No content found in CSV file');
      return;
    }
    
    const lines = fileContent.split('\n');
    
    // Skip header line
    const transfers: Transfer[] = [];
    let totalTransferred = 0n;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      
      const parts = line.split(',');
      if (parts.length < 12) continue; // Skip invalid lines
      
      const [txHash, blockNumber, timestamp, from, to, tokenAddress, type, tokenSymbol, amount] = parts;
      
      // Only process FLAG token transfers TO the target address
      if (to && 
          tokenAddress && 
          to.toLowerCase() === TARGET_ADDRESS.toLowerCase() && 
          tokenAddress.toLowerCase() === FLAG_TOKEN_ADDRESS.toLowerCase() &&
          type === 'IN') {
        const transfer: Transfer = {
          from: from || '',
          to: to || '',
          value: BigInt(amount || '0'),
          blockNumber: parseInt(blockNumber || '0'),
          timestamp: timestamp || '',
          txHash: txHash || ''
        };
        transfers.push(transfer);
        totalTransferred += transfer.value;
      }
    }
    
    console.log(`Total FLAG tokens transferred to ${TARGET_ADDRESS}: ${formatEther(totalTransferred)} FLAG`);
    
  } catch (error) {
    console.error('Error analyzing transfers:', error);
  }
}

// Run the analysis
analyzeTransfers(); 