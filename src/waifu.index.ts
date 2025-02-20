import { parseEther, Wallet } from "ethers";
import { env } from "./configs";
import { PROVIDER, TokenConfig, WRAPPED_NATIVE } from "./constants";
import { PancakeV3Swap } from "./pancake-v3/swapper";
import { Token } from "./token";

async function main() {
    const pk = env.keys.pk;
    const wallet = new Wallet(pk, PROVIDER);

    const swapHash = await PancakeV3Swap.buyWithNative(wallet, TokenConfig.WAIFU.address,
        parseEther('0.0005'),
        10000,
    )
    console.log(swapHash);
}

main().then();