import {
    createProgramConnection as createProgramLimitless,
    getAllMarkets,
    deNormalize,
    createMarket,
    getMarket,
    getMinimumQuantity,
    buy,
    sell,
    calculateQuantityFromBuyCost,
    calculateQuantityFromSellProceeds,
    calculateTotalBuyCost,
    calculateTotalSellProceeds,
} from 'limitless-api-ts'
import * as spl from '@solana/spl-token';
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as anchor from '@project-serum/anchor';
import { createAccountAndMintFromFaucet } from './utils'

async function run() {

    //create program connection
    let rpcUrl = "https://api.devnet.solana.com";
    //var kpJson = JSON.parse(fs.readFileSync("/home/your-home-dir/.config/solana/id.json").toString());
    //var kp = Keypair.fromSecretKey(new Uint8Array(kpJson));
    console.log("Generating keypair..");
    var kp = Keypair.generate();
    let anchorWallet = new anchor.Wallet(kp);
    let confirmOpts = { commitment: "processed" } as anchor.web3.ConfirmOptions;
    console.log("Creating program connection..");
    let limitlessProgram = await createProgramLimitless(rpcUrl, anchorWallet, confirmOpts);
    console.log("Requesting SOL airdrop..");
    const fromAirDropSignature = await limitlessProgram.provider.connection.requestAirdrop(
        anchorWallet.publicKey,
        0.5 * LAMPORTS_PER_SOL
    );
    await limitlessProgram.provider.connection.confirmTransaction(fromAirDropSignature);

    //get all markets
    const markets = await getAllMarkets(limitlessProgram, confirmOpts.commitment);
    console.log(`${markets.length} total markets found. Printing first 10.`);
    for (let index = 0; index < markets.length; index++) {
        const market = markets[index];
        console.log(
            `Market Name: ${String.fromCharCode(...market.id).trim()} ` +
            `Bid: ${deNormalize(market.bidPrice.toNumber(), market.quoteDecimals)} ` +
            `Ask ${deNormalize(market.askPrice.toNumber(), market.quoteDecimals)} `
        );
        if (index > 10) break;
    }

    //get some tokens from faucet
    console.log("Getting some devnet quote tokens..");
    let [mintTx, quoteAddress] = await createAccountAndMintFromFaucet(anchorWallet, rpcUrl, confirmOpts)
    console.log("Faucet tx:", mintTx);

    //create market
    //Note: The limitless ui will only show markets with all caps names and markets with no premint / continious mint (for now)
    console.log("Creating market..");
    let currentMarketName = "DANKTANK"
    try {
        let minQ = getMinimumQuantity(1000000, 6, 10000);
        let market = await createMarket(
            {
                marketName: currentMarketName,
                startQ: minQ,
                askOffset: 1000,
                minTradeSize: 10000,
                gradient: 1000000,
                preMint: 0,
                contMint: false,
                buyFee: 1,
                sellFee: 1,
                launchDate: Date.now() / 1000,
                feeQuoteTokenAddress: quoteAddress.address,
                userQuoteTokenAddress: quoteAddress.address,
                program: limitlessProgram,
                confirmOpts: {commitment: "finalized"}
            }
        );
        console.log("Created market tx: ", market);
    } catch (error) {
        //incase its already created
        console.log("Market creation failed.. market with that name likely exists.");
    }

    //get market
    let market = await getMarket(currentMarketName, limitlessProgram, "processed");
    console.log("Market bid price: ", deNormalize(market.bidPrice.toNumber(), market.quoteDecimals));

    //create or get base token account
    let baseAddress = await spl.getOrCreateAssociatedTokenAccount(
        limitlessProgram.provider.connection,
        anchorWallet.payer,
        market.baseMintAddress,
        limitlessProgram.provider.publicKey
    );

    //buy
    console.log("Buying 100 tokens..");
    let buyQty = 100;
    let [buyQtyNormalized, totalCost] = calculateTotalBuyCost(buyQty, 1, market);
    console.log(`Buying ${deNormalize(buyQtyNormalized, market.quoteDecimals)} base tokens for maximum ${deNormalize(totalCost, market.quoteDecimals)} quote tokens`);
    let buyRes = await buy({
        marketName: currentMarketName,
        quantity: buyQtyNormalized,
        maxCost: totalCost,
        userBaseToken: baseAddress.address,
        userQuoteToken: quoteAddress.address,
        program: limitlessProgram,
        confirmOpts: { commitment: "finalized" }
    });
    console.log(`Bought ${buyRes.quantity} base tokens for ${buyRes.cost} quote tokens! Tx: ${buyRes.txSig}`);

    //sell
    console.log("Selling 100 tokens..");
    market = await getMarket(currentMarketName, limitlessProgram, "processed");
    let sellQty = 100;
    let [sellQtyNormalized, totalProceeds] = calculateTotalSellProceeds(sellQty, 1, market);
    console.log(`Selling ${deNormalize(sellQtyNormalized, market.quoteDecimals)} base tokens for minimum ${deNormalize(totalProceeds, market.quoteDecimals)} quote tokens`);
    let sellRes = await sell({
        marketName: currentMarketName,
        quantity: sellQtyNormalized,
        minProceeds: totalProceeds,
        userBaseToken: baseAddress.address,
        userQuoteToken: quoteAddress.address,
        program: limitlessProgram,
        confirmOpts: { commitment: "finalized" }
    });
    console.log(`Sold ${sellRes.quantity} base tokens for ${sellRes.proceeds} quote tokens! Tx: ${sellRes.txSig}`);

    //buy in terms of quote token 
    console.log("Buying 10 quote tokens worth of base token..");
    market = await getMarket(currentMarketName, limitlessProgram, "processed");
    let cost = 5;
    let [buyQtyNormalized2, totalCost2] = calculateQuantityFromBuyCost(cost, 1, market);
    console.log(`Buying ${deNormalize(buyQtyNormalized2, market.quoteDecimals)} base tokens for maximum ${deNormalize(totalCost2, market.quoteDecimals)} quote tokens`);
    let buyRes2 = await buy({
        marketName: currentMarketName,
        quantity: buyQtyNormalized2,
        maxCost: totalCost2,
        userBaseToken: baseAddress.address,
        userQuoteToken: quoteAddress.address,
        program: limitlessProgram,
        confirmOpts: { commitment: "finalized" }
    });
    console.log(`Bought ${buyRes2.quantity} base tokens for ${buyRes2.cost} quote tokens! Tx: ${buyRes2.txSig}`);

    //sell in terms of quote token
    console.log("Selling 1 quote tokens worth of base token..");
    market = await getMarket(currentMarketName, limitlessProgram, "processed");
    let proceeds = 1;
    let [sellQtyNormalized2, totalProceeds2] = calculateQuantityFromSellProceeds(proceeds, 1, market);
    console.log(`Selling ${deNormalize(sellQtyNormalized2, market.quoteDecimals)} base tokens for minimum ${deNormalize(totalProceeds2, market.quoteDecimals)} quote tokens`);
    let sellRes2 = await sell({
        marketName: currentMarketName,
        quantity: sellQtyNormalized2,
        minProceeds: totalProceeds2,
        userBaseToken: baseAddress.address,
        userQuoteToken: quoteAddress.address,
        program: limitlessProgram,
        confirmOpts: { commitment: "finalized" }
    });
    console.log(`Sold ${sellRes2.quantity} base tokens for ${sellRes2.proceeds} quote tokens! Tx: ${sellRes2.txSig}`);
}

run()
