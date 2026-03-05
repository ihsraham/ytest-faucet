import {
  type Address,
  BaseError,
  ContractFunctionRevertedError,
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
  FAUCET_ABI,
  FAUCET_CONTRACT_ADDRESS,
  TOKEN_ABI,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  ZERO_ADDRESS,
} from '@/lib/constants';

const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://sepolia.drpc.org';

export class FaucetConfigurationError extends Error {}
export class FaucetDryError extends Error {}
export class FaucetCooldownError extends Error {
  constructor(public readonly remainingSeconds: number) {
    super(`Cooldown active: ${remainingSeconds}s remaining`);
  }
}
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

export async function getFaucetContractBalance(): Promise<bigint> {
  return getTokenBalance(FAUCET_CONTRACT_ADDRESS);
}

export async function getFormattedFaucetContractBalance(): Promise<string> {
  const balance = await getFaucetContractBalance();
  return formatUnits(balance, TOKEN_DECIMALS);
}

export async function getOnChainDripAmount(): Promise<bigint> {
  const { publicClient } = getClients();
  return publicClient.readContract({
    address: FAUCET_CONTRACT_ADDRESS,
    abi: FAUCET_ABI,
    functionName: 'dripAmount',
  });
}

export async function getOnChainCooldown(): Promise<bigint> {
  const { publicClient } = getClients();
  return publicClient.readContract({
    address: FAUCET_CONTRACT_ADDRESS,
    abi: FAUCET_ABI,
    functionName: 'cooldown',
  });
}

export async function getOnChainCooldownRemaining(recipient: Address): Promise<number> {
  const { publicClient } = getClients();

  const [lastDripTimestamp, cooldownPeriod] = await Promise.all([
    publicClient.readContract({
      address: FAUCET_CONTRACT_ADDRESS,
      abi: FAUCET_ABI,
      functionName: 'lastDrip',
      args: [recipient],
    }),
    getOnChainCooldown(),
  ]);

  if (lastDripTimestamp === 0n) {
    return 0;
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const unlockAt = lastDripTimestamp + cooldownPeriod;

  if (now >= unlockAt) {
    return 0;
  }

  return Number(unlockAt - now);
}

export async function sendDripTransaction(to: Address): Promise<{ txHash: `0x${string}` }> {
  return withTxMutex(async () => {
    const { account, publicClient, walletClient } = getClients();

    const nonce = await publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'pending',
    });

    try {
      const txHash = await walletClient.writeContract({
        account,
        chain: CHAIN,
        address: FAUCET_CONTRACT_ADDRESS,
        abi: FAUCET_ABI,
        functionName: 'dripTo',
        args: [to],
        nonce,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 120_000,
        pollingInterval: 4_000,
      });
      if (receipt.status !== 'success') {
        throw new Error('Faucet dripTo transaction reverted');
      }

      return { txHash };
    } catch (error) {
      if (error instanceof BaseError) {
        const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
        if (revert instanceof ContractFunctionRevertedError) {
          const reason = revert.data?.errorName ?? revert.message;
          if (reason.includes('cooldown')) {
            const remaining = await getOnChainCooldownRemaining(to);
            throw new FaucetCooldownError(remaining || 3600);
          }
          if (reason.includes('insufficient balance')) {
            throw new FaucetDryError('Faucet contract token balance is insufficient');
          }
        }
      }
      throw error;
    }
  });
}
