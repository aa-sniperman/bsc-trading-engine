import { parseEther, Wallet } from "ethers";
import { env } from "./configs";
import { NATIVE, PROVIDER } from "./constants";
import { Keys } from "./keys";
import { FundDistribution } from "./fund-distribution";
import { Token } from "./token";
import { PancakeMixTrade } from "./pancake/mix-trade";

async function main() {
    const pk = env.keys.pk;
    const wallet = new Wallet(pk, PROVIDER);
    const sniperKeys = require('src/secrets/test/sniper-keys.json') as Keys.WalletKey[];
    const middleKeys = require('src/secrets/test/middle-keys.json') as Keys.WalletKey[];

    // await FundDistribution.distribute({
    //     index: 0,
    //     address: wallet.address,
    //     privateKey: pk
    // }, NATIVE, middleKeys.slice(0, 5), sniperKeys.slice(0, 5), sniperKeys.map((k: any) => parseEther('0.001')));

    // const balances = await Token.getBalances(
    //     sniperKeys.map((k: any) => k.address),
    //     [NATIVE],
    //     ['BNB']
    // );
    // console.log(balances);

    await PancakeMixTrade.mixSwapMultiWallets(
        sniperKeys.map(k => k.privateKey),
        3
    )
}

main().then();