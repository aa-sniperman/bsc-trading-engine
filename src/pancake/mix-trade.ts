import { getAddress, Wallet } from "ethers";
import { NATIVE, PROVIDER } from "src/constants";
import { Token } from "src/token";
import { getRandomInt, sleep } from "src/utils";
import tokensForTrade from "./tokens-for-mix-trade.json";
import { env } from "src/configs";
import { PancakeSwapper } from "./swap";

export namespace PancakeMixTrade {
    export async function mixSwapOneWallet(privKey: string, baseTokens: string[], rounds: number) {
        const wallet = new Wallet(privKey, PROVIDER);
        for (let i = 0; i < rounds; i++) {
            const tokenIdx = getRandomInt(0, baseTokens.length);
            const baseToken = baseTokens[tokenIdx];
            console.log(`Mix swap for wallet: ${wallet.address}, round: ${i}, chosen token: ${baseToken}...`);
            let attempts = 0;
            let success = false;
            do {
                try {

                    const quoteBalance = await Token.getTokenBalance(wallet.address, NATIVE);
                    const buyAmountPercent = getRandomInt(1, 2);
                    const buyAmount = quoteBalance * BigInt(buyAmountPercent) / 1000n;

                    console.log(`Buying with ${buyAmount}.....`);
                    const buyHash = await PancakeSwapper.buyTokenWithNative(
                        wallet,
                        baseToken,
                        buyAmount
                    )
                    console.log(`Buy tx hash: ` + buyHash);
                    await sleep(getRandomInt(5000, 7000));


                    const baseBalance = await Token.getTokenBalance(wallet.address, baseToken);
                    console.log(`Selling all....`)
                    const sellAmount = baseBalance * 997n / 1000n;
                    const sellHash = await PancakeSwapper.sellTokenToNative(
                        wallet,
                        baseToken,
                        sellAmount,
                    )
                    console.log(`Sell tx hash: ` + sellHash);
                    success = true;
                } catch (err) {
                    console.log(err);
                }

                await sleep(getRandomInt(2000, 3000));
            } while (attempts < 3 && !success);
        }
    }

    export async function mixSwapMultiWallets(
        privKeys: string[],
        rounds: number
    ) {
        const baseTokens = (env.network === 'mainnet' ? tokensForTrade.mainnet : tokensForTrade.testnet)
            .map((t: any) => getAddress(t))
        await Promise.all(privKeys.map(pk =>
            mixSwapOneWallet(pk, baseTokens, rounds)
        ))
    }
}