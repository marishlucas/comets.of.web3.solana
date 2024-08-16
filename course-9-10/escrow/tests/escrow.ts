import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("escrow", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Escrow as Program<Escrow>;

  let maker: Keypair;
  let taker: Keypair;
  let tokenMintA: PublicKey;
  let tokenMintB: PublicKey;
  let makerTokenAccountA: PublicKey;
  let makerTokenAccountB: PublicKey;
  let takerTokenAccountA: PublicKey;
  let takerTokenAccountB: PublicKey;
  let offer: PublicKey;
  let vault: PublicKey;

  const offerId = new anchor.BN(1);
  const tokenAOfferedAmount = new anchor.BN(1000);
  const tokenBWantedAmount = new anchor.BN(500);

  before(async () => {
    maker = Keypair.generate();
    taker = Keypair.generate();

    // Airdrop SOL to maker and taker
    await program.provider.connection.requestAirdrop(
      maker.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await program.provider.connection.requestAirdrop(
      taker.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );

    // Create token mints
    tokenMintA = await createMint(
      program.provider.connection,
      maker,
      maker.publicKey,
      null,
      6
    );
    tokenMintB = await createMint(
      program.provider.connection,
      maker,
      maker.publicKey,
      null,
      6
    );

    // Create associated token accounts and mint tokens
    makerTokenAccountA = await createAssociatedTokenAccount(
      program.provider.connection,
      maker,
      tokenMintA,
      maker.publicKey
    );
    makerTokenAccountB = await createAssociatedTokenAccount(
      program.provider.connection,
      maker,
      tokenMintB,
      maker.publicKey
    );
    takerTokenAccountA = await createAssociatedTokenAccount(
      program.provider.connection,
      taker,
      tokenMintA,
      taker.publicKey
    );
    takerTokenAccountB = await createAssociatedTokenAccount(
      program.provider.connection,
      taker,
      tokenMintB,
      taker.publicKey
    );

    await mintTo(
      program.provider.connection,
      maker,
      tokenMintA,
      makerTokenAccountA,
      maker.publicKey,
      1000000
    );
    await mintTo(
      program.provider.connection,
      maker,
      tokenMintB,
      takerTokenAccountB,
      maker.publicKey,
      1000000
    );

    // Derive PDA for offer account
    [offer] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("offer"),
        maker.publicKey.toBuffer(),
        offerId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // Derive PDA for vault account
    [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), offer.toBuffer()],
      program.programId
    );
  });

  it("Creates an offer", async () => {
    await program.methods
      .makeOffer(offerId, tokenAOfferedAmount, tokenBWantedAmount)
      .accounts({
        maker: maker.publicKey,
        tokenMintA: tokenMintA,
        tokenMintB: tokenMintB,
        //@ts-ignore
        makerTokenAccountA: makerTokenAccountA,
        offer: offer,
        vault: vault,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([maker])
      .rpc();

    // Fetch the created offer account
    const offerAccount = await program.account.offer.fetch(offer);

    // Assert that the offer account has been created with correct data
    assert(offerAccount.maker.equals(maker.publicKey), "Incorrect maker");
    assert(
      offerAccount.tokenMintA.equals(tokenMintA),
      "Incorrect token mint A"
    );
    assert(
      offerAccount.tokenMintB.equals(tokenMintB),
      "Incorrect token mint B"
    );
    assert(
      offerAccount.tokenBWantedAmount.eq(tokenBWantedAmount),
      "Incorrect token B wanted amount"
    );
    assert.equal(
      offerAccount.id.toNumber(),
      offerId.toNumber(),
      "Incorrect offer ID"
    );

    // Check that the vault has received the correct amount of tokens
    const vaultBalance = await getAccount(program.provider.connection, vault);
    assert.equal(
      vaultBalance.amount.toString(),
      tokenAOfferedAmount.toString(),
      "Incorrect vault balance"
    );
  });

  it("Takes an offer", async () => {
    const makerInitialBalanceB = (
      await getAccount(program.provider.connection, makerTokenAccountB)
    ).amount;
    const takerInitialBalanceA = (
      await getAccount(program.provider.connection, takerTokenAccountA)
    ).amount;
    const takerInitialBalanceB = (
      await getAccount(program.provider.connection, takerTokenAccountB)
    ).amount;

    await program.methods
      .takeOffer()
      .accounts({
        taker: taker.publicKey,
        //@ts-ignore
        maker: maker.publicKey,
        tokenMintA: tokenMintA,
        tokenMintB: tokenMintB,
        takerTokenAccountA: takerTokenAccountA,
        takerTokenAccountB: takerTokenAccountB,
        makerTokenAccountB: makerTokenAccountB,
        offer: offer,
        vault: vault,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([taker])
      .rpc();

    // Check that the offer account has been closed
    const offerAccount = await program.account.offer.fetchNullable(offer);
    assert.isNull(offerAccount, "Offer account should be closed");

    // Check that the vault has been closed
    try {
      await getAccount(program.provider.connection, vault);
      assert.fail("Vault account should be closed");
    } catch (error) {
      assert.include(
        error.message,
        "Account does not exist",
        "Incorrect error message"
      );
    }

    // Check that the maker received the wanted tokens
    const makerFinalBalanceB = (
      await getAccount(program.provider.connection, makerTokenAccountB)
    ).amount;
    assert.equal(
      makerFinalBalanceB.toString(),
      //@ts-ignore
      makerInitialBalanceB.add(tokenBWantedAmount).toString(),
      "Maker did not receive the correct amount of token B"
    );

    // Check that the taker received the offered tokens
    const takerFinalBalanceA = (
      await getAccount(program.provider.connection, takerTokenAccountA)
    ).amount;
    assert.equal(
      takerFinalBalanceA.toString(),
      //@ts-ignore
      takerInitialBalanceA.add(tokenAOfferedAmount).toString(),
      "Taker did not receive the correct amount of token A"
    );

    // Check that the taker's token B balance decreased
    const takerFinalBalanceB = (
      await getAccount(program.provider.connection, takerTokenAccountB)
    ).amount;
    assert.equal(
      takerFinalBalanceB.toString(),
      //@ts-ignore
      takerInitialBalanceB.sub(tokenBWantedAmount).toString(),
      "Taker's token B balance did not decrease correctly"
    );
  });
});
