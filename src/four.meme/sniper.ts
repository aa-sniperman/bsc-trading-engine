import { ethers, Wallet } from "ethers";
import { sleep } from "src/utils";
import { TokenManager2__factory } from "src/contracts";
import { FourMemeTypes } from "./types";
import { FourMemeSwapper } from "./swap";
import { PROVIDER, TOKEN_MANAGER_V2 } from "src/constants";
import { PancakeSniper } from "src/pancake/sniper";
import { Token } from "src/token";

export namespace MemeSniper {
    export function extractTokenCreation(log: ethers.Log) {
        const event = TokenManager2__factory.createInterface().parseLog(log);
        if (!event) return;
        if (event.name !== 'TokenCreate') return;
        const creation: FourMemeTypes.TokenCreation = {
            token: event.args[1],
            creator: event.args[0],
            blockNumber: log.blockNumber,
        }
        return creation
    }

    export class Sniper {
        private nonces: number[];
        constructor(
            private readonly wallets: Wallet[],
            private readonly amounts: bigint[],
            private readonly creator: string,
            private readonly dexSniper: PancakeSniper.Sniper,
            private latestBlock?: number
        ) {

        }

        async precalculateNonces() {
            this.nonces = await Promise.all(
                this.wallets.map(async (wallet) => {
                    return await wallet.getNonce("pending");
                })
            )
        }

        async batchRug(token: string) {
            await this.precalculateNonces();
            const amounts = await Token.getRawBalances(this.wallets.map(w => w.address), [token]);
            await Promise.all(this.wallets.map(async (w, walletIdx) => {
                await this.rugForWallet(walletIdx, token, amounts[w.address][token])
            }))
        }

        private async rugForWallet(walletIdx: number, token: string, amount: bigint) {
            let attempt = 0;
            let success = false;
            const wallet = this.wallets[walletIdx];
            const nonce = this.nonces[walletIdx];

            do {
                try {
                    const hash = await FourMemeSwapper.fastSell(
                        wallet,
                        nonce,
                        token,
                        amount
                    )
                    console.log(hash)
                    success = true;
                } catch (err) {
                    const msg = (err as Error).message;
                    if (msg.includes('nonce has already been used')) {
                        success = true;
                    } else {
                        console.log(`Failed to sell for wallet ${wallet.address} at attempt ${attempt + 1}`);
                        console.log(err);
                    }
                }
            } while (attempt < 10 && !success);
        }

        private async buyForWallet(walletIdx: number, token: string) {
            let attempt = 0;
            let success = false;
            const wallet = this.wallets[walletIdx];
            const nonce = this.nonces[walletIdx];
            const amount = this.amounts[walletIdx];
            do {
                try {
                    const hash = await FourMemeSwapper.fastBuy(
                        wallet,
                        nonce,
                        token,
                        amount
                    )
                    console.log(hash)
                    success = true;
                } catch (err) {
                    const msg = (err as Error).message;
                    if (msg.includes('nonce has already been used')) {
                        success = true;
                    } else {
                        console.log(`Failed to snipe for wallet ${wallet.address} at attempt ${attempt + 1}`);
                        console.log(err);
                    }
                }
            } while (attempt < 10 && !success);
        }
        async batchBuy(token: string) {
            await Promise.all(
                this.wallets.map(async (w, i) => {
                    return await this.buyForWallet(i, token)
                })
            )
        }

        async run() {
            await this.precalculateNonces();
            await this.dexSniper.setup();
            console.log(this.nonces);

            while (true) {
                try {
                    const latest = await PROVIDER.getBlock('latest');

                    console.log(this.latestBlock);
                    const logs = await PROVIDER.getLogs({
                        address: TOKEN_MANAGER_V2,
                        fromBlock: this.latestBlock ?? latest?.number,
                        topics: [
                            ethers.id("TokenCreate(address,address,uint256,string,string,uint256,uint256,uint256)"),
                        ]
                    })

                    const creations = logs.map(log => extractTokenCreation(log)).filter(c => c !== undefined && c.creator === this.creator);
                    console.log(creations);
                    if (creations.length > 0) {
                        const creation = creations[0]!;
                        console.log(`Detected new token: ${creation.token}. Sniping.....`)
                        this.batchBuy(creation.token);

                        // turn on Pancake sniper
                        this.dexSniper.run(creation.token, creation.blockNumber);

                        console.log('-------------------------')
                        console.log(creation.token);
                        console.log('-------------------------')
                        return;
                    }

                    if (latest) this.latestBlock = latest.number;

                } catch (err) {
                    console.log(err);
                }

                await sleep(100);
            }
        }
    }
}