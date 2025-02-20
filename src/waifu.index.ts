import { parseEther, Wallet } from "ethers";
import { env } from "./configs";
import { PROVIDER, TokenConfig } from "./constants";
import { PancakeV3Swap } from "./pancake-v3/swapper";

async function main() {
    const pk = env.keys.pk;
    const wallet = new Wallet(pk, PROVIDER);

    const swapHash = await PancakeV3Swap.sellToNative(
        wallet, 
        TokenConfig.WAIFU.address,
        parseEther('1'),
        10000,
    )
    console.log(swapHash);
}

main().then();