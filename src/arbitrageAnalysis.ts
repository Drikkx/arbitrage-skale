import { promises as fs } from 'fs';
import { POOL_NEBULA, POOL_EUROPA } from './index';

async function loadLiquidityData(poolAddress: string): Promise<any[]> {
  const filePath = `./liquidityData/${poolAddress}.json`;
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file for ${poolAddress}:`, error);
    return []; 
  }
}

async function main() {
  try {
    const nebulaTicks = await loadLiquidityData(POOL_NEBULA);
    const europaTicks = await loadLiquidityData(POOL_EUROPA);

    // Ici, vous pouvez utiliser nebulaTicks et europaTicks pour votre analyse d'arbitrage
    console.log('Nebula Ticks:', nebulaTicks);
    console.log('Europa Ticks:', europaTicks);

    // Ajoutez ici le reste de votre logique d'analyse d'arbitrage
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

main();