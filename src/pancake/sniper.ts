import { ethers, Wallet } from "ethers";
import { TokenManager2__factory } from "src/contracts";
import { PancakeTypes } from "./types";
import { PROVIDER, TOKEN_MANAGER_V2 } from "src/constants";
import { PancakeSwapper } from "./swap";
import { sleep } from "src/utils";

const pumpInterface = TokenManager2__factory.createInterface();

export namespace PancakeSniper {
    export function extractPairCreated(log: ethers.Log) {
        const event = pumpInterface.parseLog(log);
        if (!event) return;
        if (event.name !== 'LiquidityAdded') return;
        const creation: PancakeTypes.NewListing = {
            token: event.args[0],
        }
        return creation;
    }
    export class Sniper {
        private latestBlock: number;
        private nonces: number[];
        private wallets: Wallet[];
        constructor(
            private readonly privKeys: string[],
            private readonly amounts: bigint[],
        ) {
            this.wallets = privKeys.map(p => new Wallet(p, PROVIDER));
        }

        private async precalculateNonces() {
            this.nonces = await Promise.all(
                this.wallets.map(async (wallet) => {
                    return await wallet.getNonce("pending");
                })
            )
        }

        private async buyForWallet(walletIdx: number, token: string) {
            let attempt = 0;
            let success = false;
            const wallet = this.wallets[walletIdx];
            const nonce = this.nonces[walletIdx];
            const amount = this.amounts[walletIdx];
            do {
                try {
                    const hash = await PancakeSwapper.fastBuyTokenWithNative(
                        wallet,
                        nonce,
                        token,
                        amount
                    )
                    console.log(hash)
                    success = true;
                } catch (err) {
                    console.log(err);
                    console.log(`Failed to snipe for wallet ${wallet.address} at attempt ${attempt + 1}`);
                }
            } while (attempt < 10 && !success);
        }
        async batchBuy(token: string) {
            await Promise.all(
                this.privKeys.map(async (pk, i) => {
                    return await this.buyForWallet(i, token)
                })
            )
        }

        async setup() {
            await this.precalculateNonces();
        }
        async run(token: string, fromBlock: number) {
            this.latestBlock = fromBlock;
            while (true) {
                try {

                    console.log(this.latestBlock);
                    const logs = await PROVIDER.getLogs({
                        fromBlock: this.latestBlock,
                        toBlock: this.latestBlock + 999,
                        // fromBlock: 51587325,
                        // toBlock: 51587340,
                        topics: [
                            ethers.id("LiquidityAdded(address,uint256,address,uint256)")
                        ],
                        address: TOKEN_MANAGER_V2
                    })

                    console.log(logs);
                    const creations = logs.map(log => extractPairCreated(log)).filter(c => c !== undefined);
                    console.log(creations);
                    if (creations.length > 0) {
                        console.log(`Detected pancake listing. Sniping.....`)
                        await this.batchBuy(token);
                        return;
                    }

                    const latest = await PROVIDER.getBlock('latest');
                    if (latest) this.latestBlock = Math.min(latest.number, this.latestBlock + 1000);

                } catch (err) {
                    console.log(err);
                }

                await sleep(100);
            }
        }
    }
}