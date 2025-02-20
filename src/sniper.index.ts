import { parseEther } from "ethers";
import { MemeSniper } from "./four.meme/sniper";
import { Keys } from "./keys";
import { PancakeSniper } from "./pancake/sniper";

async function main() {
    const sniperKeys = require('src/secrets/test/sniper-keys.json') as Keys.WalletKey[];
    const dexSniper = new PancakeSniper.Sniper([], []);
    const pumpSniper = new MemeSniper.Sniper(
        Keys.walletKeysToWallets(sniperKeys), 
        sniperKeys.map(k => parseEther('0.0005')), 
        '0xEB5491C015b73C3B86F4B4a7E8982d97eC4628ff', 
        dexSniper);
    await pumpSniper.run();
}

main().then();