import { parseEther, Wallet } from "ethers";
import { env } from "./configs";
import { PROVIDER, TokenConfig, WRAPPED_NATIVE } from "./constants";
import { PancakeV3Swap } from "./pancake-v3/swapper";

async function main() {
    const pk = env.keys.pk;
    const wallet = new Wallet(pk, PROVIDER);
    const hash = await PancakeV3Swap.wrap(wallet, parseEther('0.001'));
    console.log(hash);
    const swapHash = await PancakeV3Swap.executeSwap(wallet, WRAPPED_NATIVE,
        TokenConfig.WAIFU.address,
        parseEther('0.001'),
        10000,
    )
    console.log(swapHash);
}

main().then();