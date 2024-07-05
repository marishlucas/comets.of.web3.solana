import "dotenv/config";
import {
  Connection,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createMemoInstruction } from "@solana/spl-memo";
import {
  airdropIfRequired,
  getKeypairFromEnvironment,
} from "@solana-developers/helpers";

const loadPublicKey = (envVarName: string) => {
  const publicKey = process.env[envVarName];
  if (!publicKey) {
    throw new Error(`Missing ${envVarName} env var!`);
  }

  return new PublicKey(publicKey);
};

const displayBalanceAsync = async (
  connection: Connection,
  publicKey: PublicKey,
) => {
  // You can get SOL from https://faucet.solana.com/
  const balanceInLamports = await connection.getBalance(publicKey);
  const balanceInSol = balanceInLamports / LAMPORTS_PER_SOL;

  console.log(
    `💰 Balance: ${balanceInSol} SOL (${balanceInLamports} lamports)`,
  );
};

const connection = new Connection(clusterApiUrl("devnet"));

console.log("🟢 Connected!");
console.log(`📡 Endpoint: ${connection.rpcEndpoint}`);
console.log();

const sender = getKeypairFromEnvironment("SENDER_PRIVATE_KEY");
await airdropIfRequired(connection, sender.publicKey, 0.01, 0.01);
console.log("📤 Sender:");
await displayBalanceAsync(connection, sender.publicKey);

const receiverPublicKey = loadPublicKey("RECEIVER_PUBLIC_KEY");
console.log("📥 Receiver:");
await displayBalanceAsync(connection, receiverPublicKey);

const transaction = new Transaction();

const transferInstruction = SystemProgram.transfer({
  fromPubkey: sender.publicKey,
  toPubkey: receiverPublicKey,
  lamports: 0.01 * LAMPORTS_PER_SOL,
});

transaction.add(transferInstruction);

const memoInstruction = createMemoInstruction("Mulțumesc pentru bere! 🍻");

transaction.add(memoInstruction);

const signature = await sendAndConfirmTransaction(connection, transaction, [
  sender,
]);

console.log(`🚀 Transaction confirmed. Signature: ${signature}`);

await new Promise((resolve) => setTimeout(resolve, 10e3));

console.log("📤 Sender:");
await displayBalanceAsync(connection, sender.publicKey);

console.log("📥 Receiver:");
await displayBalanceAsync(connection, receiverPublicKey);
