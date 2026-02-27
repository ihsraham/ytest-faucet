import {
  type Address,
  createPublicClient,
  createWalletClient,
  formatUnits,
  getAddress,
  http,
  isAddressEqual,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  CHAIN,
  DRIP_AMOUNT_BASE_UNITS,
  TOKEN_ABI,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  ZERO_ADDRESS,
} from '@/lib/constants';

const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://sepolia.drpc.org';

export class FaucetConfigurationError extends Error {}
export class FaucetDryError extends Error {}
export class FaucetRecipientError extends Error {}

let txQueue = Promise.resolve();

function withTxMutex<T>(fn: () => Promise<T>): Promise<T> {
  const current = txQueue;
  let release: () => void = () => undefined;
  txQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  return current
    .then(fn)
    .finally(() => {
      release();
    });
}

function getPrivateKey() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new FaucetConfigurationError('PRIVATE_KEY is not configured');
  }
  if (!privateKey.startsWith('0x')) {
    throw new FaucetConfigurationError('PRIVATE_KEY must start with 0x');
  }
  return privateKey as `0x${string}`;
}

function getClients() {
  const account = privateKeyToAccount(getPrivateKey());
  const publicClient = createPublicClient({
    chain: CHAIN,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: CHAIN,
    transport: http(rpcUrl),
  });

  return {
    account,
    publicClient,
    walletClient,
  };
}

export function getFaucetAddress() {
  const { account } = getClients();
  return account.address;
}

export async function isContractAddress(address: Address): Promise<boolean> {
  const { publicClient } = getClients();
  const bytecode = await publicClient.getBytecode({ address });
  return Boolean(bytecode && bytecode !== '0x');
}

export function normalizeAddress(address: string): Address {
  const normalized = getAddress(address);
  if (isAddressEqual(normalized, ZERO_ADDRESS)) {
    throw new FaucetRecipientError('Zero address cannot receive faucet funds');
  }
  return normalized;
}

export async function getTokenBalance(address: Address): Promise<bigint> {
  const { publicClient } = getClients();
  return publicClient.readContract({
    address: TOKEN_ADDRESS,
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address],
  });
}

export async function getFormattedTokenBalance(address: Address): Promise<string> {
  const balance = await getTokenBalance(address);
  return formatUnits(balance, TOKEN_DECIMALS);
}

export async function sendDripTransaction(to: Address): Promise<{ txHash: `0x${string}` }> {
  return withTxMutex(async () => {
    const { account, publicClient, walletClient } = getClients();

    const faucetTokenBalance = await getTokenBalance(account.address);
    if (faucetTokenBalance < DRIP_AMOUNT_BASE_UNITS) {
      throw new FaucetDryError('Faucet token balance is insufficient');
    }

    const nonce = await publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'pending',
    });

    const txHash = await walletClient.writeContract({
      account,
      chain: CHAIN,
      address: TOKEN_ADDRESS,
      abi: TOKEN_ABI,
      functionName: 'transfer',
      args: [to, DRIP_AMOUNT_BASE_UNITS],
      nonce,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      throw new Error('Token transfer transaction reverted');
    }

    return { txHash };
  });
}
