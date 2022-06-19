import * as anchor from '@project-serum/anchor';
import { Account, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import {
    createProgramConnection as createProgramFaucet,
    getMintAddress,
    mintToken
} from 'token-faucet-api-ts';

export async function createAccountAndMintFromFaucet(
    anchorWallet: anchor.Wallet,
    rpcUrl: string,
    confirmOpts: anchor.web3.ConfirmOptions
) : Promise<[string, Account]> {
    let faucetProgram = await createProgramFaucet(rpcUrl, anchorWallet, confirmOpts);
    let faucetCreator = new anchor.web3.PublicKey("8hSMZ2FueCnHzdTq3aJ4uyhTTWmcrNfUx9Q74fGiLqnx");
    let faucetId = "NIRV";
    let tokenFaucetMintAddress = await getMintAddress(faucetProgram, faucetCreator, faucetId);
    let quoteAddress = await getOrCreateAssociatedTokenAccount(
        faucetProgram.provider.connection,
        anchorWallet.payer,
        tokenFaucetMintAddress,
        faucetProgram.provider.publicKey,
        null,
        "max"
    );
    let mintTx = await mintToken(faucetProgram, faucetCreator, faucetId, quoteAddress.address, confirmOpts);
    return [mintTx, quoteAddress]
}