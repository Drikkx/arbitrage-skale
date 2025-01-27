import { ethers } from 'ethers';
import { FeeAmount, Pool } from '@uniswap/v3-sdk';
import { Token } from '@uniswap/sdk-core';
import { FLAG_EUROPA_ADDRESS, FLAG_NEBULA_ADDRESS, POOL_EUROPA, POOL_NEBULA, rETH_NEBULA_ADDRESS, SKL_EUROPA_ADDRESS } from './index';

const providerNebula = new ethers.providers.JsonRpcProvider('https://mainnet.skalenodes.com/v1/green-giddy-denebola');
const providerEuropa = new ethers.providers.JsonRpcProvider('https://mainnet.skalenodes.com/v1/elated-tan-skat');

interface SwapDetails {
  token0Price: string;
  token1Price: string;
}

// Modifiez votre fonction calculateSwapDetails pour utiliser le CustomTickDataProvider
async function calculateSwapDetails(poolAddress: string, tokenFeesAddress: string, tokenFlagAddress: string, provider: ethers.providers.JsonRpcProvider): Promise<SwapDetails> {
  const tokenFees = new Token(1, tokenFeesAddress, 18);
  const tokenFlag = new Token(1, tokenFlagAddress, 18);

  const poolContract = new ethers.Contract(poolAddress, [
    'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function liquidity() external view returns (uint128)',
    'function fee() external view returns (uint24)',
    'function tickSpacing() external view returns (int24)',
  ], provider);

  const [sqrtPriceX96, tick] = await poolContract.slot0();
  const liquidity = await poolContract.liquidity();
  const fee = await poolContract.fee();

  const pool = new Pool(
    tokenFees,
    tokenFlag,
    fee as FeeAmount,
    sqrtPriceX96.toString(),
    liquidity.toString(),
    tick
  );

  const token0Price = pool.token0Price.toSignificant(6);
  const token1Price = pool.token1Price.toSignificant(6);

  return {
    token0Price,
    token1Price
  };
}


function calculatePercentageDifference(a: number, b: number): number {
  return ((a - b) / b) * 100;
}

async function main() {
  try {
    const coinGeckoData = await getCoinGeckoPrices();
    if (!coinGeckoData) {
      console.error("Failed to get CoinGecko data");
      return;
    }

    const flagUsd = coinGeckoData['for-loot-and-glory'].usd;
    console.log('FLAG/USD : ', flagUsd)
    const rethUsd = coinGeckoData['rocket-pool-eth'].usd;
    console.log('rETH/USD : ', rethUsd)
    const sklUsd = coinGeckoData['skale'].usd;
    console.log('SKL/USD : ', sklUsd)

    // FLAG/rETH
    const resultNebula = await calculateSwapDetails(POOL_NEBULA, FLAG_NEBULA_ADDRESS, rETH_NEBULA_ADDRESS, providerNebula);
    const flagRethUniswap = parseFloat(resultNebula.token0Price);
    const rETHflagUniswap = parseFloat(resultNebula.token1Price);
    const flagUsdNebula = flagRethUniswap * rethUsd
    const rETHUsdNebula = rETHflagUniswap * flagUsd
    console.log('FLAG : ', flagRethUniswap, ' rETH', ' FLAG/USD : ', flagUsdNebula, '$')
    console.log('rETH : ', rETHflagUniswap, ' FLAG', 'rETH/USD :', rETHUsdNebula, '$')

    // FLAG/SKL
    const resultEuropa = await calculateSwapDetails(POOL_EUROPA, FLAG_EUROPA_ADDRESS, SKL_EUROPA_ADDRESS, providerEuropa);
    const flagSklUniswap = parseFloat(resultEuropa.token0Price);
    const sklFlagUniswap = parseFloat(resultEuropa.token1Price);
    const flagUsdEuropa = flagSklUniswap * sklUsd;
    const sklUsdEuropa = sklFlagUniswap * flagUsd;
    console.log('FLAG : ', flagSklUniswap, ' SKL', ' FLAG/USD : ', flagUsdEuropa, '$')
    console.log('SKL : ', sklFlagUniswap, ' FLAG', ' FLAG', 'SKL/USD :', sklUsdEuropa, '$')
    const flagEcart = calculatePercentageDifference(flagUsdNebula, flagUsdEuropa).toFixed(2)
    const sklEcart = calculatePercentageDifference(sklUsd, sklUsdEuropa).toFixed(2)
    const rETHEcart = calculatePercentageDifference(rethUsd, rETHUsdNebula).toFixed(2)
    console.log('Écart FLAG entre pools (%):', flagEcart);
    console.log('Écart SKL entre pools (%):', sklEcart);
    console.log('Écart rETH entre pools (%):', rETHEcart);
    if (Number(flagEcart) > 5) {
      console.log('FLAG est moins cher sur Europa, donc achetez sur Europa et vendez sur Nebula')
    }

    if (Number(flagEcart) < -5) {
      console.log('FLAG est moins cher sur Nebula, donc achetez sur Nebula et vendez sur Europa')
    }

    if (Number(rETHEcart) > 5) {
      console.log('rETH est moins cher sur Nebula donc achetez sur Nebula et vendez sur Mainnet')
    }

    if (Number(rETHEcart) < -5) {
      console.log('rETH est plus cher sur Nebula donc acheter sur Mainnet et vendez sur Nebula')
    }

    if (Number(sklEcart) > 5) {
      console.log(' SKL est moins cher sur Mainnet donc acheter sur Mainnet et vendez sur Europa')
    }

    if (Number(sklEcart) < -5) {
      console.log('SKL est moins cher sur Europa donc acheter sur Europa et vendez sur Mainnet')
    }

  } catch (error) {
    console.error('An error occurred:', error);
  }
}

async function getCoinGeckoPrices() {
  const coins = ['for-loot-and-glory', 'rocket-pool-eth', 'skale'];
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins.join(',')}&vs_currencies=usd`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('There was a problem fetching the price:', error);
    return null;
  }
}

// Appel de la fonction pour voir les résultats
main();