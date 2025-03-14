import { formatEther, parseAbiItem, Log, createPublicClient, http } from "viem";
import { skaleNebula } from "viem/chains";
import fs from 'fs';
import path from 'path';

const BarrelERC20Address = '0xc17117aE156ff482b7ef96e6fC3c1F71d10bc97C'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const DATA_FILE = path.join(__dirname, '../data/burn_data.json');
const CHUNK_SIZE = 2000n; // Number of blocks to scan at once
const DEPLOYMENT_BLOCK = 22221193; // Block where the contract was deployed

interface TransferEvent {
  value: bigint;
}

interface TransferLog extends Log {
  args: {
    from: string;
    to: string;
    value: bigint;
  };
}

interface StoredData {
  lastScannedBlock: number;
  totalBurned: string;
}

// ERC20 Transfer event
const transferEventAbi = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

// Create a public client for fetching logs
const publicClient = createPublicClient({
  chain: skaleNebula,
  transport: http('https://green-giddy-denebola-indexer.skalenodes.com:10136/')
});

function loadStoredData(): StoredData {
  try {
    if (!fs.existsSync(path.dirname(DATA_FILE))) {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    }
    
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return {
        lastScannedBlock: data.lastScannedBlock,
        totalBurned: data.totalBurned
      };
    }
  } catch (error) {
    console.error('Error loading stored data:', error);
  }
  
  return {
    lastScannedBlock: DEPLOYMENT_BLOCK,
    totalBurned: "0"
  };
}

function saveStoredData(data: StoredData): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

export async function getBurnEvents(
  contractAddress: `0x${string}`, 
  fromBlock: bigint,
  toBlock: bigint
): Promise<TransferEvent[]> {
  try {
    const logs = await publicClient.getLogs({
      address: contractAddress,
      event: transferEventAbi,
      args: {
        to: ZERO_ADDRESS as `0x${string}`
      },
      fromBlock,
      toBlock
    }) as TransferLog[];

    return logs.map((log: TransferLog) => ({
      value: log.args.value
    }));
  } catch (error) {
    console.error('Error fetching burn events:', error);
    return [];
  }
}

async function scanBlocks(contractAddress: `0x${string}`, startBlock: bigint): Promise<void> {
  try {
    const currentBlock = await publicClient.getBlockNumber();
    let fromBlock = startBlock;
    let storedData = loadStoredData();
    let totalBurnedBigInt = BigInt(storedData.totalBurned);
    
    while (fromBlock <= currentBlock) {
      const toBlock = fromBlock + CHUNK_SIZE > currentBlock ? currentBlock : fromBlock + CHUNK_SIZE;
      console.log(`Scanning blocks ${fromBlock} to ${toBlock}...`);
      
      const events = await getBurnEvents(contractAddress, fromBlock, toBlock);
      
      if (events.length > 0) {
        // Update total burned
        totalBurnedBigInt += events.reduce((acc, event) => acc + event.value, 0n);
        storedData.totalBurned = totalBurnedBigInt.toString();
        
        // Update last scanned block
        storedData.lastScannedBlock = Number(toBlock);
        
        // Save updated data
        saveStoredData(storedData);
        
        console.log(`Found ${events.length} burn events`);
        console.log(`Total burned: ${formatEther(totalBurnedBigInt)} tokens`);
      } else {
        // Even if no events found, update the last scanned block
        storedData.lastScannedBlock = Number(toBlock);
        saveStoredData(storedData);
      }
      
      fromBlock = toBlock + 1n;
    }
  } catch (error) {
    console.error('Error during block scanning:', error);
  }
}

// Main execution when running the script directly
if (require.main === module) {
  (async () => {
    try {
      const storedData = loadStoredData();
      // Use deployment block if no blocks have been scanned yet
      const startBlock = storedData.lastScannedBlock === 0 ? BigInt(DEPLOYMENT_BLOCK) : BigInt(storedData.lastScannedBlock);
      console.log(`Starting scan from block ${startBlock}...`);
      await scanBlocks(BarrelERC20Address as `0x${string}`, startBlock);
    } catch (error) {
      console.error('Error in main execution:', error);
    }
  })();
}