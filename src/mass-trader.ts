import {
    createProgramConnection as createProgramLimitless,
    deNormalize,
    getMarket,
    getAllMarkets,
    buy,
    sell,
    calculateQuantityFromBuyCost,
    calculateTotalSellProceeds,
} from 'limitless-api-ts'
import * as spl from '@solana/spl-token';
import { Keypair, LAMPORTS_PER_SOL, Connection } from "@solana/web3.js";
import * as anchor from '@project-serum/anchor';
import { mintFromFaucet, getRandomInt } from './utils'

async function run() {
    //create program connection
    let rpcUrl = "https://devnet.genesysgo.net";
    //var kpJson = JSON.parse(fs.readFileSync("/home/your-home-dir/.config/solana/id.json").toString());
    //var kp = Keypair.fromSecretKey(new Uint8Array(kpJson));
    console.log("Generating keypair..");
    var kp = Keypair.generate();
    let anchorWallet = new anchor.Wallet(kp);
    let confirmOpts = { commitment: "processed" } as anchor.web3.ConfirmOptions;
    console.log("Creating program connection..");
    let limitlessProgram = await createProgramLimitless(rpcUrl, anchorWallet, confirmOpts);
    console.log("Requesting SOL airdrop..");
    let airdropConn = new Connection("https://api.devnet.solana.com")
    const fromAirDropSignature = await airdropConn.requestAirdrop(
        anchorWallet.publicKey,
        2.0 * LAMPORTS_PER_SOL
    );
    await limitlessProgram.provider.connection.confirmTransaction(fromAirDropSignature);
    while (true) {
        try {
            const markets = await getAllMarkets(limitlessProgram, confirmOpts.commitment);
            for (let index = 0; index < markets.length; index++) {
                const market = markets[index];
                console.log(`Trading on market ${String.fromCharCode(...market.id).trim()}`)

                let baseAddress = await spl.getOrCreateAssociatedTokenAccount(
                    limitlessProgram.provider.connection,
                    anchorWallet.payer,
                    market.baseMintAddress,
                    limitlessProgram.provider.publicKey
                );
                let quoteAddress = await spl.getOrCreateAssociatedTokenAccount(
                    limitlessProgram.provider.connection,
                    anchorWallet.payer,
                    market.quoteMintAddress,
                    limitlessProgram.provider.publicKey,
                );
                let faucetMint = await mintFromFaucet(anchorWallet, quoteAddress.address, rpcUrl, { commitment: "processed" })
                let baseBal = 0;
                let baseUser = await spl.getAccount(
                    limitlessProgram.provider.connection,
                    baseAddress.address,
                    "processed"
                )
                baseBal = Number(baseUser.amount);
                let quoteBal = 0;
                let quoteUser = await spl.getAccount(
                    limitlessProgram.provider.connection,
                    quoteAddress.address,
                    "processed"
                )
                quoteBal = Number(quoteUser.amount)
                let isBuy = Math.random() < 0.5;
                if (isBuy) {
                    let costNorm = getRandomInt(1_000_000, quoteBal)
                    let cost = deNormalize(costNorm, market.quoteDecimals);
                    let [buyQtyNormalized, totalCost] = calculateQuantityFromBuyCost(cost, 1, market);
                    console.log(`Buying ${deNormalize(buyQtyNormalized, market.quoteDecimals)} base tokens for maximum ${deNormalize(totalCost, market.quoteDecimals)} quote tokens`);
                    try {
                        let buyRes = await buy({
                            marketName: String.fromCharCode(...market.id).trim(),
                            quantity: buyQtyNormalized,
                            maxCost: totalCost,
                            userBaseToken: baseAddress.address,
                            userQuoteToken: quoteAddress.address,
                            program: limitlessProgram,
                            confirmOpts: { commitment: "processed" },
                            execResponse: false
                        });
                        console.log(`Tx: ${buyRes.txSig}`);
                    } catch (error) {
                        console.log(error)
                    }
                } else if (!isBuy && baseBal > market.minSize.toNumber()) {
                    let maxS = baseBal * 0.1;
                    if (maxS < market.minSize) maxS = market.minSize;
                    let quantityNorm = getRandomInt(market.minSize, maxS)
                    let newQ = market.cqd.toNumber() - quantityNorm;
                    let q_available = ((market.floorPoolSize.toNumber() * (Math.pow(10, market.quoteDecimals))) / market.floorPrice.toNumber());
                    console.log("qavail", q_available)
                    console.log("qNorm", quantityNorm)
                    console.log("newQ", newQ)
                    console.log("highestQ", market.highestFloorQuantity.toNumber())
                    if (newQ < market.highestFloorQuantity.toNumber()) {
                        //if the sell order goes below the floor price, the order will skip all the liquidity in the quote pool
                        //there is a chance that the floor pool does not have enough liquidity to fill your order, thus we will reduce the size of our order.
                        if (quantityNorm > q_available) {
                            quantityNorm = q_available;
                            console.log("Selling remaining available amount")
                        }
                    }
                    console.log("sQ", market.startQ.toNumber())
                    if (newQ > market.startQ.toNumber()) {
                        let sellQty = deNormalize(quantityNorm, market.quoteDecimals);
                        let [sellQtyNormalized, totalProceeds] = calculateTotalSellProceeds(sellQty, 1, market);
                        console.log(`Selling ${deNormalize(sellQtyNormalized, market.quoteDecimals)} base tokens for minimum ${deNormalize(totalProceeds, market.quoteDecimals)} quote tokens`);
                        try {
                            let sellRes = await sell({
                                marketName: String.fromCharCode(...market.id).trim(),
                                quantity: sellQtyNormalized,
                                minProceeds: totalProceeds,
                                userBaseToken: baseAddress.address,
                                userQuoteToken: quoteAddress.address,
                                program: limitlessProgram,
                                confirmOpts: { commitment: "processed" },
                                execResponse: false
                            });
                            console.log(`Tx: ${sellRes.txSig}`);

                        } catch (error) {
                            //todo - log error
                            console.log(error)
                        }
                    }
                }
            }
        } catch (error) {
            console.log(`${error}`)
            await new Promise(r => setTimeout(r, 2000));
        }
    }

}

run()
//todo - mass sell off test