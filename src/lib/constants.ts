import { parseAbi, parseUnits } from 'viem';
import { sepolia } from 'viem/chains';

export const CHAIN = sepolia;
export const TOKEN_SYMBOL = 'ytest.USD';
export const TOKEN_DECIMALS = 6;
export const DRIP_AMOUNT = '10';
export const DRIP_AMOUNT_BASE_UNITS = parseUnits(DRIP_AMOUNT, TOKEN_DECIMALS);
export const COOLDOWN_SECONDS = 4 * 60 * 60;
export const IP_LIMIT_PER_HOUR = 3;
export const FINGERPRINT_LIMIT_PER_HOUR = 5;
export const GLOBAL_LIMIT_PER_HOUR = 50;

export const TOKEN_ADDRESS = '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb' as const;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export const TOKEN_ABI = parseAbi([
  'function transfer(address to, uint256 value) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
]);

export const ETHERSCAN_TOKEN_URL = `https://sepolia.etherscan.io/token/${TOKEN_ADDRESS}`;
export const ETHERSCAN_TX_URL = (txHash: string) => `https://sepolia.etherscan.io/tx/${txHash}`;
export const ETHERSCAN_ADDRESS_URL = (address: string) =>
  `https://sepolia.etherscan.io/address/${address}`;
