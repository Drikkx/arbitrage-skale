import { ethers } from 'ethers';
import { promises as fs } from 'fs';
import { POOL_NEBULA, POOL_EUROPA } from './index';
import poolabi from './PoolABI';

const providerNebula = new ethers.providers.JsonRpcProvider('https://mainnet.skalenodes.com/v1/green-giddy-denebola');
const providerEuropa = new ethers.providers.JsonRpcProvider('https://mainnet.skalenodes.com/v1/elated-tan-skat');

const POOL_NEBULA_DEPLOY_BLOCK = 16550636;
const POOL_EUROPA_DEPLOY_BLOCK = 8772530;

interface LiquidityData {
    liquidityDistribution: { tickLower: number; tickUpper: number; liquidityDelta: string; blockNumber: number }[];
    lastProcessedBlock: number;
}

async function fetchAndSaveLiquidityEvents(poolAddress: string, provider: ethers.providers.JsonRpcProvider, deployBlock: number) {
    const poolContract = new ethers.Contract(poolAddress, poolabi, provider);

    let liquidityData: LiquidityData = {
        liquidityDistribution: [],
        lastProcessedBlock: deployBlock - 1
    };

    const filePath = `./liquidityData/${poolAddress}.json`;

    // Check if the file exists before attempting to read it
    try {
        await fs.access(filePath);
        const existingData = await fs.readFile(filePath, 'utf8');
        const parsedData = JSON.parse(existingData);
        if (parsedData && parsedData.liquidityDistribution && parsedData.liquidityDistribution.length > 0) {
            liquidityData = parsedData;
            console.log(`Resuming from block: ${liquidityData.lastProcessedBlock + 1}`);
        }
    } catch (error) {
        console.log('No existing file found, starting fresh.');
    }

    const currentBlock = await provider.getBlockNumber();
    const blockLimit = 200; // Maximum number of blocks to request in one go

    for (let startBlock = liquidityData.lastProcessedBlock + 1; startBlock < currentBlock; startBlock += blockLimit) {
        const endBlock = Math.min(startBlock + blockLimit - 1, currentBlock);
        const mintFilter = poolContract.filters.Mint!();
        console.log('Nebula Mint Filter:', mintFilter);
        try {
            const mintEvents = await poolContract.queryFilter(mintFilter, startBlock, endBlock);
            console.log('Nebula Mint Events:', mintEvents);
        } catch (error) {
            console.error('Error querying Nebula Mint events:', error);
        }
        // Fetch both Mint and Burn events separately
        const mintEvents = await poolContract.queryFilter(poolContract.filters.Mint!(), startBlock, endBlock);
        const burnEvents = await poolContract.queryFilter(poolContract.filters.Burn!(), startBlock, endBlock);
        const events = [...mintEvents, ...burnEvents];  // Combine events

        console.log('startBlock:', startBlock);
        console.log('endBlock:', endBlock);
        console.log('events length:', events.length);

        for (const event of events) {
            console.log('!!!! Oo Liquidity Updated oO !!!!');
            console.log('Event Raw:', event);

            let args: any;

            if (event.event === 'Mint') {
                console.log('Mint');
                args = event.args;
            } else if (event.event === 'Burn') {
                console.log('Burn');
                args = event.args;
            }

            console.log('Decoded Args:', args);

            if (args) {
                const tickLower = args.tickLower;
                const tickUpper = args.tickUpper;
                const liquidityDelta = args.amount.toString();

                liquidityData.liquidityDistribution.push({
                    tickLower: Number(tickLower),
                    tickUpper: Number(tickUpper),
                    liquidityDelta: event.event === 'Mint' ? liquidityDelta : `-${liquidityDelta}`,
                    blockNumber: event.blockNumber
                });
            }
        }

        // Update last processed block
        liquidityData.lastProcessedBlock = endBlock;

        // Save intermediate result to ensure we can resume from here if interrupted
        await fs.writeFile(filePath, JSON.stringify(liquidityData, null, 2));
    }

    console.log(`Liquidity events saved for ${poolAddress}`);
}

async function main() {
    try {
        //await fetchAndSaveLiquidityEvents(POOL_NEBULA, providerNebula, POOL_NEBULA_DEPLOY_BLOCK);
        // Uncomment when ready to process Europa pool
        await fetchAndSaveLiquidityEvents(POOL_EUROPA, providerEuropa, POOL_EUROPA_DEPLOY_BLOCK);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

main();