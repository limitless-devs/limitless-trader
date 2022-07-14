import * as anchor from '@project-serum/anchor';
import { Account, getOrCreateAssociatedTokenAccount, createAccount } from '@solana/spl-token';
import {
    createProgramConnection as createProgramFaucet,
    getMintAddress,
    mintToken
} from 'token-faucet-api-ts';
export async function createTokenAcoount(
    anchorWallet: anchor.Wallet,
    rpcUrl: string,
    confirmOpts: anchor.web3.ConfirmOptions
) : Promise<anchor.web3.PublicKey> {
    let faucetProgram = await createProgramFaucet(rpcUrl, anchorWallet, confirmOpts);
    let faucetCreator = new anchor.web3.PublicKey("8hSMZ2FueCnHzdTq3aJ4uyhTTWmcrNfUx9Q74fGiLqnx");
    let faucetId = "NIRV";
    let tokenFaucetMintAddress = await getMintAddress(faucetProgram, faucetCreator, faucetId);
    let quoteAddress = await createAccount(
        faucetProgram.provider.connection,
        anchorWallet.payer,
        tokenFaucetMintAddress,
        faucetProgram.provider.publicKey
    )
    return quoteAddress;
}
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
        undefined,
        "max"
    );
    let mintTx = await mintToken(faucetProgram, faucetCreator, faucetId, quoteAddress.address, confirmOpts);
    return [mintTx, quoteAddress]
}
export async function mintFromFaucet(
    anchorWallet: anchor.Wallet,
    quoteAddress: anchor.web3.PublicKey,
    rpcUrl: string,
    confirmOpts: anchor.web3.ConfirmOptions
) : Promise<string> {
    let faucetProgram = await createProgramFaucet(rpcUrl, anchorWallet, confirmOpts);
    let faucetCreator = new anchor.web3.PublicKey("8hSMZ2FueCnHzdTq3aJ4uyhTTWmcrNfUx9Q74fGiLqnx");
    let faucetId = "NIRV";
    let mintTx = await mintToken(faucetProgram, faucetCreator, faucetId, quoteAddress, confirmOpts);
    return mintTx;
}