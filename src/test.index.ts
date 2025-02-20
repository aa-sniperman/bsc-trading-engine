import { parseEther, Wallet } from "ethers";
import { env } from "./configs";
import { NATIVE, PROVIDER } from "./constants";
import { Keys } from "./keys";
import { FundDistribution } from "./fund-distribution";
import { Token } from "./token";
import { PancakeMixTrade } from "./pancake/mix-trade";
import { FourMemeSwapper } from "./four.meme/swap";
import { PancakeSniper } from "./pancake/sniper";
import { MemeSniper } from "./four.meme/sniper";

async function main() {
    const pk = env.keys.pk;
    const wallet = new Wallet(pk, PROVIDER);
    const sniperKeys = require('src/secrets/test/sniper-keys.json') as Keys.WalletKey[];
    const middleKeys = require('src/secrets/test/middle-keys.json') as Keys.WalletKey[];
    const sniperKeys1 = require('src/secrets/test/sniper-keys-1.json') as Keys.WalletKey[];


    const allKeys = sniperKeys.concat(middleKeys).concat(sniperKeys1);
    // await Token.batchFastTransferETH(
    //     wallet,
    //     sniperKeys1.map(a => parseEther('0.01')),
    //     sniperKeys1.map(a => a.address)
    // )
    // await FundDistribution.distribute({
    //     index: 0,
    //     address: wallet.address,
    //     privateKey: pk
    // }, NATIVE, middleKeys.slice(0, 5), sniperKeys.slice(0, 5), sniperKeys.map((k: any) => parseEther('0.001')));

    const balances = await Token.getBalances(
        allKeys.map((k: any) => k.address),
        [NATIVE],
        ['BNB']
    );
    console.log(balances);

    // await PancakeMixTrade.mixSwapMultiWallets(
    //     sniperKeys.map(k => k.privateKey),
    //     3
    // )

    const dexSniper = new PancakeSniper.Sniper([], []);
    const pumpSniper = new MemeSniper.Sniper(
        Keys.walletKeysToWallets(allKeys),
        allKeys.map(k => parseEther('0.0005')),
        '0xEB5491C015b73C3B86F4B4a7E8982d97eC4628ff',
        dexSniper);
    // await pumpSniper.precalculateNonces();
    // await pumpSniper.batchBuy('0xc2be8dc299053a125f2cb7687b5b4e194b48ebf8')
    await pumpSniper.batchRug('0xc2be8dc299053a125f2cb7687b5b4e194b48ebf8');
}

main().then();