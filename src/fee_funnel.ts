import {
    createProgramConnection as createProgramLimitless,
    getAllMarkets,
    transferFees,
} from 'limitless-api-ts'
import * as spl from '@solana/spl-token';
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as anchor from '@project-serum/anchor';
import * as fs from 'fs'
async function run() {
    console.log("Running fee funnel..");
    let rpcUrl = "https://devnet.genesysgo.net";
    var kpJson = JSON.parse(fs.readFileSync("/home/limitlessdev/.config/solana/id.json").toString());
    var kp = Keypair.fromSecretKey(new Uint8Array(kpJson));
    let anchorWallet = new anchor.Wallet(kp);
    let confirmOpts = { commitment: "confirmed" } as anchor.web3.ConfirmOptions;
    console.log("Creating program connection..");
    let limitlessProgram = await createProgramLimitless(rpcUrl, anchorWallet, confirmOpts);
    const markets = await getAllMarkets(limitlessProgram, confirmOpts.commitment);
    for (let index = 0; index < markets.length; index++) {
        const market = markets[index];
        console.log(`Transfering platform fee from ${String.fromCharCode(...market.id).trim()}`)
        try {
            let transferRes = await transferFees(String.fromCharCode(...market.id).trim(), limitlessProgram, "confirmed")
            console.log("Transfer tx: ", transferRes)
        } catch (error) {
            console.log(error)
        }
    }
}

run();