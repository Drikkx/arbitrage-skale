import { createPublicClient, formatEther, http, parseAbiItem, Log } from 'viem';
import { skaleNebula } from 'viem/chains';

const TARGET_ADDRESS = '0x3b0583e48b5F6b85FcE21bE6df42d437AE78B78d';
const FLAG_TOKEN_ADDRESS = '0x082081c8E607ca6C1c53aC093cAb3847ED59C0b0';
const BlockDeploy = 22218510;
const CHUNK_SIZE = 2000n;

// ERC20 Transfer event
const transferEventAbi = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

// Create a public client for fetching logs
const publicClient = createPublicClient({
  chain: skaleNebula,
  transport: http('https://green-giddy-denebola-indexer.skalenodes.com:10136/')
});

interface TransferLog extends Log {
  args: {
    from: string;
    to: string;
    value: bigint;
  };
}

async function analyzeTransfers(): Promise<void> {
  try {
    const currentBlock = await publicClient.getBlockNumber();
    let fromBlock = BigInt(BlockDeploy);
    let totalTransferred = 0n;
    
    while (fromBlock <= currentBlock) {
      const toBlock = fromBlock + CHUNK_SIZE > currentBlock ? currentBlock : fromBlock + CHUNK_SIZE;
      console.log(`Scanning blocks ${fromBlock} to ${toBlock}...`);
      
      const logs = await publicClient.getLogs({
        address: FLAG_TOKEN_ADDRESS as `0x${string}`,
        event: transferEventAbi,
        args: {
          to: TARGET_ADDRESS as `0x${string}`
        },
        fromBlock,
        toBlock
      }) as TransferLog[];

      if (logs.length > 0) {
        const chunkTotal = logs.reduce((acc, log) => acc + log.args.value, 0n);
        totalTransferred += chunkTotal;
        console.log(`Found ${logs.length} transfers in this chunk`);
      }
      
      fromBlock = toBlock + 1n;
    }
    
    console.log(`\nTotal FLAG tokens transferred to ${TARGET_ADDRESS}: ${formatEther(totalTransferred)} FLAG`);
    
  } catch (error) {
    console.error('Error analyzing transfers:', error);
  }
}

// Run the analysis
analyzeTransfers(); 