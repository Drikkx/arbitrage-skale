import { ethers } from 'ethers';
import { FeeAmount, Pool } from '@uniswap/v3-sdk';
import { Token } from '@uniswap/sdk-core';
import {
  FLAG_EUROPA_ADDRESS,
  FLAG_NEBULA_ADDRESS,
  POOL_EUROPA,
  POOL_NEBULA,
  rETH_NEBULA_ADDRESS,
  SKL_EUROPA_ADDRESS,
  USDC_EUROPA_ADDRESS,
  USDC_SKL_POOL_EUROPA,
  swapRouter_Europa,
  swapRouter_Nebula
} from './index';

// Configuration des providers
const providerNebula = new ethers.providers.JsonRpcProvider('https://mainnet.skalenodes.com/v1/green-giddy-denebola');
const providerEuropa = new ethers.providers.JsonRpcProvider('https://mainnet.skalenodes.com/v1/elated-tan-skat');

interface SwapDetails {
  token0Price: number; // Prix ajusté du token0 en token1
  token1Price: number; // Prix ajusté du token1 en token0
}

interface PriceData {
  flagUsd: number;
  rethUsd: number;
  sklUsd: number;
  usdcUsd: number;
}

// Décimales des tokens
const TOKEN_DECIMALS = {
  USDC: 6,  // USDC standard
  SKL: 18,  // SKL standard
  FLAG: 18, // FLAG standard
  rETH: 18  // rETH standard
};

/**
 * Calcule les détails de swap sans ajustement des décimales
 * 
 * Cette fonction calcule les prix et les quantités nécessaires pour effectuer un swap entre deux tokens.
 * Elle ne prend pas en compte les ajustements des décimales, ce qui peut entraîner des erreurs si les prix sont imprecis.
 * 
 * @param {string} poolAddress L'adresse du pool
 * @param {string} token0Address L'adresse du premier token
 * @param {string} token1Address L'adresse du deuxième token
 * @param {number} token0Decimals Le nombre de décimales pour le premier token
 * @param {number} token1Decimals Le nombre de décimales pour le deuxième token
 * @param {ethers.providers.JsonRpcProvider} provider Le fournisseur de données pour l'API ethers.js
 * 
 * @returns {SwapDetails} Les détails du swap, incluant les prix et les quantités nécessaires
 */
async function calculateSwapDetails(
  poolAddress: string,
  token0Address: string,
  token1Address: string,
  token0Decimals: number,
  token1Decimals: number,
  provider: ethers.providers.JsonRpcProvider
): Promise<SwapDetails> {
  const token0 = new Token(1, token0Address, token0Decimals);
  const token1 = new Token(1, token1Address, token1Decimals);

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
    token0,
    token1,
    fee as FeeAmount,
    sqrtPriceX96.toString(),
    liquidity.toString(),
    tick
  );

  // Prix bruts du pool
  const token0PriceRaw = parseFloat(pool.token0Price.toSignificant(6)); // token0 en token1
  const token1PriceRaw = parseFloat(pool.token1Price.toSignificant(6)); // token1 en token0

  // Ajustement correct des décimales
  const decimalsAdjustment = 10 ** (token1Decimals - token0Decimals);
  const token0Price = token0PriceRaw * decimalsAdjustment; // token0 en token1
  const token1Price = token1PriceRaw / decimalsAdjustment; // token1 en token0

  return { token0Price, token1Price };
}

/**
 * Récupère les prix USD depuis CoinGecko
 */
async function getCoinGeckoPrices(): Promise<PriceData | null> {
  const coins = ['for-loot-and-glory', 'rocket-pool-eth', 'skale', 'usd-coin'];
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins.join(',')}&vs_currencies=usd`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return {
      flagUsd: data['for-loot-and-glory'].usd,
      rethUsd: data['rocket-pool-eth'].usd,
      sklUsd: data['skale'].usd,
      usdcUsd: data['usd-coin'].usd
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des prix CoinGecko:', error);
    return null;
  }
}

/**
 * Analyse les opportunités d'arbitrage
 */
async function analyzeArbitrage() {
  try {
    const coinGeckoData = await getCoinGeckoPrices();
    if (!coinGeckoData) throw new Error('Impossible de récupérer les données CoinGecko');

    console.log('\n=== Prix CoinGecko ===');
    console.log(`FLAG/USD: $${coinGeckoData.flagUsd.toFixed(6)}`);
    console.log(`rETH/USD: $${coinGeckoData.rethUsd.toFixed(2)}`);
    console.log(`SKL/USD: $${coinGeckoData.sklUsd.toFixed(6)}`);
    console.log(`USDC/USD: $${coinGeckoData.usdcUsd.toFixed(4)}`);

    // 1. Pool USDC/SKL sur Europa
    const usdcSklSwap = await calculateSwapDetails(
      USDC_SKL_POOL_EUROPA,
      USDC_EUROPA_ADDRESS,
      SKL_EUROPA_ADDRESS,
      TOKEN_DECIMALS.USDC,
      TOKEN_DECIMALS.SKL,
      providerEuropa
    );
    const usdcSklRate = usdcSklSwap.token0Price / 10 ** 12; // USDC -> SKL
    const sklUsdcRate = usdcSklSwap.token1Price * 10 ** 12; // SKL -> USDC
    const sklUsdViaUsdc = sklUsdcRate * coinGeckoData.usdcUsd;

    console.log('\n=== Pool Europa (USDC/SKL) ===');
    console.log(`1 USDC = ${usdcSklRate.toFixed(2)} SKL`);
    console.log(`1 SKL = ${sklUsdcRate.toFixed(6)} USDC ($${sklUsdViaUsdc.toFixed(6)})`);
    console.log(`Attendu (CoinGecko): 1 USDC ≈ ${(1 / coinGeckoData.sklUsd).toFixed(2)} SKL`);

    // 2. Pool FLAG/SKL sur Europa
    const flagSklSwap = await calculateSwapDetails(
      POOL_EUROPA,
      FLAG_EUROPA_ADDRESS,
      SKL_EUROPA_ADDRESS,
      TOKEN_DECIMALS.FLAG,
      TOKEN_DECIMALS.SKL,
      providerEuropa
    );
    const flagSklRate = flagSklSwap.token0Price; // FLAG -> SKL
    const sklFlagRate = flagSklSwap.token1Price; // SKL -> FLAG
    const flagUsdViaSkl = flagSklRate * sklUsdViaUsdc;

    console.log('\n=== Pool Europa (FLAG/SKL) ===');
    console.log(`1 FLAG = ${flagSklRate.toFixed(6)} SKL ($${flagUsdViaSkl.toFixed(6)})`);
    console.log(`1 SKL = ${sklFlagRate.toFixed(6)} FLAG`);
    console.log(`Attendu (CoinGecko): 1 FLAG ≈ ${(coinGeckoData.flagUsd / coinGeckoData.sklUsd).toFixed(2)} SKL`);

    // 3. Pool FLAG/rETH sur Nebula
    const flagRethSwap = await calculateSwapDetails(
      POOL_NEBULA,
      FLAG_NEBULA_ADDRESS,
      rETH_NEBULA_ADDRESS,
      TOKEN_DECIMALS.FLAG,
      TOKEN_DECIMALS.rETH,
      providerNebula
    );
    const flagRethRate = flagRethSwap.token0Price; // FLAG -> rETH
    const rethFlagRate = flagRethSwap.token1Price; // rETH -> FLAG
    const rethUsdViaFlag = rethFlagRate * flagUsdViaSkl;

    console.log('\n=== Pool Nebula (FLAG/rETH) ===');
    console.log(`1 FLAG = ${flagRethRate.toFixed(12)} rETH`);
    console.log(`1 rETH = ${rethFlagRate.toFixed(2)} FLAG ($${rethUsdViaFlag.toFixed(6)})`);
    console.log(`Attendu (CoinGecko): 1 rETH ≈ ${(coinGeckoData.rethUsd / coinGeckoData.flagUsd).toFixed(2)} FLAG`);

    // Simulation d'arbitrage
    const initialUsdc = 100;
    // Chemin aller
    const sklFromUsdc = initialUsdc * usdcSklRate;
    const flagFromSkl = sklFromUsdc * sklFlagRate;
    const rethFromFlag = flagFromSkl * flagRethRate;
    const finalUsdc = rethFromFlag * coinGeckoData.rethUsd;
    const profitForward = finalUsdc - initialUsdc;

    // Chemin retour
    const rethFromUsdc = initialUsdc / coinGeckoData.rethUsd;
    const flagFromReth = rethFromUsdc * rethFlagRate;
    const sklFromFlag = flagFromReth * flagSklRate;
    const finalUsdcReverse = sklFromFlag * sklUsdcRate;
    const profitReverse = finalUsdcReverse - initialUsdc;

    console.log('\n=== Simulation Arbitrage (100 USDC initiaux) ===');
    console.log('Chemin aller (USDC → SKL → FLAG → rETH → USDC):');
    console.log(`Résultat final: $${finalUsdc.toFixed(2)} | Profit: $${profitForward.toFixed(2)}`);
    console.log('Chemin retour (USDC → rETH → FLAG → SKL → USDC):');
    console.log(`Résultat final: $${finalUsdcReverse.toFixed(2)} | Profit: $${profitReverse.toFixed(2)}`);

    // Recommandation avec seuil
    console.log('\n=== Recommandation ===');
    const profitThreshold = 10; // Seuil minimal pour couvrir les frais
    if (profitForward > profitThreshold) {
      console.log('→ Arbitrage profitable dans le sens aller');
      console.log('   USDC → SKL (Europa) → FLAG (Europa) → rETH (Nebula) → USDC (Mainnet)');
    } else if (profitReverse > profitThreshold) {
      console.log('→ Arbitrage profitable dans le sens retour');
      console.log('   USDC (Mainnet) → rETH → FLAG (Nebula) → SKL (Europa) → USDC (Europa)');
    } else {
      console.log('→ Pas d’opportunité d’arbitrage rentable détectée après frais estimés');
    }

  } catch (error) {
    console.error('Erreur lors de l’analyse:', error);
  }
}

// Exécution
analyzeArbitrage();