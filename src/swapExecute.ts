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

// Configuration du wallet (remplacez par votre clé privée)
const PRIVATE_KEY = 'VOTRE_CLÉ_PRIVÉE_ICI'; // À sécuriser (env var ou fichier séparé)
const walletEuropa = new ethers.Wallet(PRIVATE_KEY, providerEuropa);
const walletNebula = new ethers.Wallet(PRIVATE_KEY, providerNebula);

interface SwapDetails {
  token0Price: number; // Prix brut du token0 en token1
  token1Price: number; // Prix brut du token1 en token0
}

interface PriceData {
  flagUsd: number;
  rethUsd: number;
  sklUsd: number;
  usdcUsd: number;
}

// Décimales des tokens
const TOKEN_DECIMALS = {
  USDC: 6,
  SKL: 18,
  FLAG: 18,
  rETH: 18
};

// ABI simplifiée du SwapRouter Uniswap V3
const SWAP_ROUTER_ABI = [
  'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
];

/**
 * Calcule les détails de swap sans ajustement des décimales
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

  const token0Price = parseFloat(pool.token0Price.toSignificant(6));
  const token1Price = parseFloat(pool.token1Price.toSignificant(6));

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
    return await response.json();
  } catch (error) {
    console.error('Erreur lors de la récupération des prix CoinGecko:', error);
    return null;
  }
}

/**
 * Exécute un swap via le SwapRouter Uniswap V3
 */
async function executeSwap(
  swapRouterAddress: string,
  tokenIn: string,
  tokenOut: string,
  fee: number,
  amountIn: ethers.BigNumber,
  wallet: ethers.Wallet,
  slippageTolerance: number = 0.01 // 1% de tolérance
): Promise<void> {
  const swapRouter = new ethers.Contract(swapRouterAddress, SWAP_ROUTER_ABI, wallet);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

  const params = {
    tokenIn,
    tokenOut,
    fee,
    recipient: wallet.address,
    deadline,
    amountIn,
    amountOutMinimum: 0, // À ajuster avec un oracle ou calcul pour slippage
    sqrtPriceLimitX96: 0
  };

  const tx = await swapRouter.exactInputSingle(params, { gasLimit: 300000 });
  console.log(`Transaction envoyée: ${tx.hash}`);
  await tx.wait();
  console.log(`Swap exécuté: ${tx.hash}`);
}

/**
 * Analyse et exécute les opportunités d'arbitrage
 */
async function analyzeAndExecuteArbitrage() {
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
    const decimalsAdjustUsdcSkl = 10 ** (TOKEN_DECIMALS.SKL - TOKEN_DECIMALS.USDC); // 10^12
    const usdcSklRate = usdcSklSwap.token0Price / decimalsAdjustUsdcSkl;
    const sklUsdcRate = usdcSklSwap.token1Price * decimalsAdjustUsdcSkl;
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
    const decimalsAdjustFlagSkl = 10 ** (TOKEN_DECIMALS.SKL - TOKEN_DECIMALS.FLAG); // 1
    const flagSklRate = flagSklSwap.token0Price / decimalsAdjustFlagSkl;
    const sklFlagRate = flagSklSwap.token1Price * decimalsAdjustFlagSkl;
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
    const decimalsAdjustFlagReth = 10 ** (TOKEN_DECIMALS.rETH - TOKEN_DECIMALS.FLAG); // 1
    const flagRethRate = flagRethSwap.token0Price / decimalsAdjustFlagReth;
    const rethFlagRate = flagRethSwap.token1Price * decimalsAdjustFlagReth;
    const rethUsdViaFlag = rethFlagRate * flagUsdViaSkl;

    console.log('\n=== Pool Nebula (FLAG/rETH) ===');
    console.log(`1 FLAG = ${flagRethRate.toFixed(12)} rETH`);
    console.log(`1 rETH = ${rethFlagRate.toFixed(2)} FLAG ($${rethUsdViaFlag.toFixed(6)})`);
    console.log(`Attendu (CoinGecko): 1 rETH ≈ ${(coinGeckoData.rethUsd / coinGeckoData.flagUsd).toFixed(2)} FLAG`);

    // Simulation d'arbitrage
    const initialUsdc = 100; // Montant initial en USDC
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

    // Exécution des swaps si profitables
    const profitThreshold = 10;
    if (profitForward > profitThreshold) {
      console.log('\n=== Exécution Arbitrage Aller ===');
      // USDC → SKL (Europa)
      const usdcAmountIn = ethers.utils.parseUnits(initialUsdc.toString(), TOKEN_DECIMALS.USDC);
      await executeSwap(
        swapRouter_Europa,
        USDC_EUROPA_ADDRESS,
        SKL_EUROPA_ADDRESS,
        3000, // Fee tier (0.3%, ajustez selon le pool)
        usdcAmountIn,
        walletEuropa
      );

      // SKL → FLAG (Europa)
      const sklAmountIn = ethers.utils.parseUnits(sklFromUsdc.toFixed(0), TOKEN_DECIMALS.SKL);
      await executeSwap(
        swapRouter_Europa,
        SKL_EUROPA_ADDRESS,
        FLAG_EUROPA_ADDRESS,
        3000,
        sklAmountIn,
        walletEuropa
      );

      // FLAG → rETH (Nebula)
      const flagAmountIn = ethers.utils.parseUnits(flagFromSkl.toFixed(0), TOKEN_DECIMALS.FLAG);
      await executeSwap(
        swapRouter_Nebula,
        FLAG_NEBULA_ADDRESS,
        rETH_NEBULA_ADDRESS,
        3000,
        flagAmountIn,
        walletNebula
      );

      console.log('Arbitrage aller exécuté avec succès !');
    } else if (profitReverse > profitThreshold) {
      console.log('\n=== Exécution Arbitrage Retour ===');
      // USDC → rETH (assumé sur Mainnet ou Nebula, à ajuster)
      const usdcAmountIn = ethers.utils.parseUnits(initialUsdc.toString(), TOKEN_DECIMALS.USDC);
      await executeSwap(
        swapRouter_Nebula, // À ajuster si Mainnet
        USDC_EUROPA_ADDRESS,
        rETH_NEBULA_ADDRESS,
        3000,
        usdcAmountIn,
        walletNebula
      );

      // rETH → FLAG (Nebula)
      const rethAmountIn = ethers.utils.parseUnits(rethFromUsdc.toFixed(0), TOKEN_DECIMALS.rETH);
      await executeSwap(
        swapRouter_Nebula,
        rETH_NEBULA_ADDRESS,
        FLAG_NEBULA_ADDRESS,
        3000,
        rethAmountIn,
        walletNebula
      );

      // FLAG → SKL (Europa)
      const flagAmountIn = ethers.utils.parseUnits(flagFromReth.toFixed(0), TOKEN_DECIMALS.FLAG);
      await executeSwap(
        swapRouter_Europa,
        FLAG_EUROPA_ADDRESS,
        SKL_EUROPA_ADDRESS,
        3000,
        flagAmountIn,
        walletEuropa
      );

      console.log('Arbitrage retour exécuté avec succès !');
    } else {
      console.log('\n=== Recommandation ===');
      console.log('→ Pas d’opportunité d’arbitrage rentable détectée après frais estimés');
    }

  } catch (error) {
    console.error('Erreur lors de l’analyse ou exécution:', error);
  }
}

// Exécution
analyzeAndExecuteArbitrage();