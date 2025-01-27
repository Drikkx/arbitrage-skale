async function getCoinGeckoPrices() {
    const coins = ['for-loot-and-glory', 'rocket-pool-eth', 'skale'];
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins.join(',')}&vs_currencies=usd`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Affichage des prix en USD
        console.log('For Loot And Glory (USD):', data['for-loot-and-glory'].usd);
        console.log('Rocket Pool ETH (USD):', data['rocket-pool-eth'].usd);
        console.log('SKALE (USD):', data['skale'].usd);

        return data; // Retourne l'objet JSON complet si besoin
    } catch (error) {
        console.error('There was a problem fetching the price:', error);
    }
}

// Appel de la fonction pour voir les résultats
getCoinGeckoPrices();