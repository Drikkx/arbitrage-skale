import { createWalletClient, http, publicActions } from 'viem';
import { skaleEuropa, skaleNebula } from 'viem/chains';

export const clientEuropa = createWalletClient({
    chain: skaleEuropa,
    transport: http()
}).extend(publicActions);

export const clientNebula = createWalletClient({
    chain: skaleNebula,
    transport: http()
}).extend(publicActions);