import { Wallet } from "ethers";
import { Keys } from "src/keys";
import { PancakeSwapper } from "src/pancake/swap";
import { sleep } from "src/utils";

export namespace BoostHoldersViaSwap {
    export async function boostHoldersViaSwaps(
        wallet: Wallet,
        dstKeys: Keys.WalletKey[],
        to: string,
        dstAmounts: bigint[]
    ) {
        for (let i = 0; i < dstKeys.length; i++) {
            let success = false;

            let attempts = 0

            do {
                try {
                    const hash = await PancakeSwapper.buyTokenWithNative(
                        wallet,
                        to,
                        dstAmounts[i],
                        dstKeys[i].address)
                    console.log(hash);
                    success = true;
                } catch (err) {
                    attempts++;
                    console.log(`Failed, retrying`)
                    await sleep(300);
                }
            } while (!success && attempts < 10);
        }
    }
}