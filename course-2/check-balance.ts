import "dotenv/config";
import {
  airdropIfRequired,
  getKeypairFromEnvironment,
} from "@solana-developers/helpers";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";

import bs58 from "bs58";

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

console.log("Connection to cluster established:");

const publicKey = new PublicKey("BhAriApw9tSg8SKb3FVbxPR2UAos6GQLfeecKvEygbDT");

await airdropIfRequired(
  connection,
  publicKey,
  2 * LAMPORTS_PER_SOL,
  0.5 * LAMPORTS_PER_SOL,
);

const balanceInLamport = await connection.getBalance(publicKey);
console.log("Balance:", balanceInLamport / LAMPORTS_PER_SOL, "SOL");

const keypair = getKeypairFromEnvironment("SECRET_KEY");

const encodedKeypair = bs58.encode(keypair.secretKey);

console.log(encodedKeypair);
