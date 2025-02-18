import { formatEther, parseEther, Wallet } from "ethers";
import { NATIVE, PROVIDER, TokenConfigInfo, WBNB_PAIR, WRAPPED_NATIVE } from "src/constants";
import { Keys } from "src/keys";
import { PancakeSwapper } from "src/pancake/swap";
import { Token } from "src/token";
import { TokenStats } from "src/token-stats";
import { getRandomInt, sleep } from "src/utils";

export namespace VolumeMakerV2 {
    export interface VolMakerConfig {
        targetVol1h: number;
        minTradeSize: number;
        maxTradeSize: number;
        timeScale: number;
        disableRebalancing?: boolean;
        maxWalletsNum?: number;
    }

    export class Maker {
        private balances: number[];
        private quotePrice: number;
        private basePrice: number;

        constructor(
            private makers: Keys.WalletKey[],
            private readonly quoteToken: string,
            private readonly baseTokenConfig: TokenConfigInfo,
            private readonly config: VolMakerConfig
        ) {
            this.balances = new Array<number>(makers.length);
        }

        private async _update() {
            try {
                this.quotePrice = Number(await TokenStats.getTokenPrice(WBNB_PAIR));
                this.basePrice = Number(await TokenStats.getTokenPrice(this.baseTokenConfig.pair));

                const tokenBalances = await Token.getBalances(this.makers.map(maker => maker.address), [
                    this.quoteToken,
                    this.baseTokenConfig.address
                ], [
                    'QUOTE',
                    'BASE'
                ])

                for (let i = 0; i < this.makers.length; i++) {
                    const address = this.makers[i].address;
                    const baseBal = tokenBalances[address]['BASE'];
                    const quoteBal = tokenBalances[address]['QUOTE'];
                    this.balances[i] = Number(baseBal) * this.basePrice + Number(quoteBal) * this.quotePrice;
                }

                if (this.config.maxWalletsNum) {
                    // Combine makers and balances into pairs
                    const paired = this.makers.map((maker, index) => ({
                        maker,
                        balance: this.balances[index],
                    }));

                    // Sort the pairs by balance in descending order
                    paired.sort((a, b) => b.balance - a.balance);

                    // Extract the sorted makers and balances
                    this.makers = paired.map((pair) => pair.maker).slice(0, this.config.maxWalletsNum);
                    this.balances = paired.map((pair) => pair.balance).slice(0, this.config.maxWalletsNum);
                }

            } catch (err) {

            }
        }

        private _pickSenderAndRecipient(): { sender: Keys.WalletKey; recipient: Keys.WalletKey, fundDestination: Keys.WalletKey } | null {
            const { minTradeSize } = this.config;

            // Filter eligible senders (balance >= minTradeSize)
            const eligibleSenders = this.makers.filter((_, i) => this.balances[i] >= (minTradeSize / 3));

            // All makers can be recipients
            const eligibleRecipients = this.makers;

            if (eligibleSenders.length === 0 || eligibleRecipients.length === 0) {
                console.log(`There are no eligible wallets`)
                return null; // No eligible senders or recipients
            }

            // Calculate weights for senders (higher balance => higher weight)
            const senderWeights = eligibleSenders.map(sender =>
                this.balances[this.makers.indexOf(sender)]
            );

            // Calculate weights for recipients (lower balance => higher weight)
            const totalBalance = this.balances.reduce((sum, balance) => sum + balance, 0);

            const fundDestinationWeights = eligibleRecipients.map(recipient =>
                this.balances[this.makers.indexOf(recipient)]
            );
            const recipientWeights = eligibleRecipients.map(recipient =>
                totalBalance - this.balances[this.makers.indexOf(recipient)]
            );

            // Pick sender and recipient
            const sender = this._weightedRandomChoice(eligibleSenders, senderWeights);
            const recipient = this._weightedRandomChoice(eligibleRecipients, recipientWeights);
            const fundDestination = this._weightedRandomChoice(eligibleRecipients, fundDestinationWeights);

            return { sender, recipient, fundDestination };
        }

        private _weightedRandomChoice<T>(choices: T[], weights: number[]): T {
            const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
            const randomWeight = Math.random() * totalWeight;

            let cumulativeWeight = 0;
            for (let i = 0; i < choices.length; i++) {
                cumulativeWeight += weights[i];
                if (randomWeight <= cumulativeWeight) {
                    return choices[i];
                }
            }

            // Fallback in case of rounding errors
            return choices[choices.length - 1];
        }

        private async _makeTrade(sender: Keys.WalletKey, recipient: Keys.WalletKey, fundDestination: Keys.WalletKey) {
            const senderQuoteBal = await Token.getTokenBalance(sender.address, this.quoteToken);
            const senderQuoteValue = Number(formatEther(senderQuoteBal)) * this.quotePrice;
            const senderBaseBal = await Token.getTokenBalance(sender.address, this.baseTokenConfig.address);
            const senderBaseValue = Number(formatEther(senderBaseBal)) * this.basePrice;

            console.log(
                senderQuoteValue,
                senderBaseValue
            )

            const senderWallet = new Wallet(sender.privateKey, PROVIDER);
            if (senderQuoteValue < this.config.minTradeSize && senderBaseValue < this.config.minTradeSize) {
                console.log(`Not enough money to trade, gathering funds from ${sender.address} to ${fundDestination.address}...`)
                if (senderQuoteBal > 1000n)
                    try {
                        await Token.transferETH(senderWallet, senderQuoteBal - parseEther('0.001'), fundDestination.address);
                    } catch (err) {

                    }
                await sleep(10000);
                if (senderBaseBal > 1000n) {
                    try {
                        await Token.transferToken(senderWallet, this.baseTokenConfig.address, senderQuoteBal, fundDestination.address);
                    } catch (err) {

                    }
                }
                return;
            };
            let isBuy: boolean;
            if (senderQuoteValue < this.config.minTradeSize) {
                isBuy = false;
            } else if (senderBaseValue < this.config.minTradeSize) {
                isBuy = true;
            } else {
                // decide whether to buy or sell based on the quote value & the base value. quote value > base value => more likely to buy and vice versa
                const totalValue = senderQuoteValue + senderBaseValue;
                const buyProbability = senderQuoteValue / totalValue;
                isBuy = Math.random() < buyProbability;
            }

            const balance = isBuy ? senderQuoteBal : senderBaseBal;
            const minTrade = parseEther((
                Math.floor(
                    1e9 * this.config.minTradeSize / (isBuy ? this.quotePrice : this.basePrice)
                ) / 1e9
            ).toString());

            const maxTrade = parseEther((
                Math.floor(
                    1e9 * this.config.maxTradeSize / (isBuy ? this.quotePrice : this.basePrice)
                ) / 1e9
            ).toString());
            const percent = getRandomInt(0, 101);
            let tradeAmount = ((maxTrade - minTrade) * BigInt(percent) / 100n) + minTrade;
            tradeAmount = tradeAmount > balance ? balance : tradeAmount;

            let attempts = 0;
            let buySuccess = false;
            do {
                try {
                    console.log(`Wallet ${sender.address} ${isBuy ? 'buying' : 'selling'} with ${tradeAmount}..., Recipient: ${recipient.address}`)

                    let hash;
                    if (!isBuy) {
                        hash = await PancakeSwapper.sellTokenToNative(
                            senderWallet,
                            this.baseTokenConfig.address,
                            tradeAmount,
                            recipient.address
                        )
                    } else {
                        hash = await PancakeSwapper.buyTokenWithNative(
                            senderWallet,
                            this.baseTokenConfig.address,
                            tradeAmount,
                            recipient.address
                        )
                    }

                    console.log(hash);
                    buySuccess = true;
                } catch (err) {
                    console.log(err);
                    attempts++;
                    await sleep(5000);
                }
            } while (attempts < 3 && !buySuccess)

            await sleep(getRandomInt(this.config.timeScale * 10, this.config.timeScale * 50))
        }

        private async _rebalance(sender: Keys.WalletKey) {
            await sleep(getRandomInt(this.config.timeScale, this.config.timeScale * 10))

            const senderQuoteBal = await Token.getTokenBalance(sender.address, this.quoteToken);
            const senderQuoteValue = Number(formatEther(senderQuoteBal)) * this.quotePrice;
            const senderBaseBal = await Token.getTokenBalance(sender.address, this.baseTokenConfig.address);
            const senderBaseValue = Number(formatEther(senderBaseBal)) * this.basePrice;

            // Calculate the total value and the target value for each token
            const totalValue = senderQuoteValue + senderBaseValue;
            const targetValue = totalValue / 2;


            let isBuy: boolean;
            let tradeAmountUSD: number;

            console.log(senderQuoteBal, senderBaseBal, this.quotePrice, this.basePrice)
            console.log(senderQuoteValue, senderBaseValue)

            const senderWallet = new Wallet(sender.privateKey, PROVIDER);

            if (senderQuoteValue > targetValue) {
                // Excess in quote, need to sell some quote for base
                isBuy = true;
                const excessValue = senderQuoteValue - targetValue;
                tradeAmountUSD = excessValue; // Convert excess value to base token amount
            } else if (senderBaseValue > targetValue) {
                // Excess in base, need to buy some base with quote
                isBuy = false;
                const excessValue = senderBaseValue - targetValue;
                tradeAmountUSD = excessValue; // Convert excess value to quote token amount
            } else {
                // Already balanced, no action needed
                console.log(`Sender ${sender.address} is already balanced.`);
                return;
            }

            console.log(isBuy, tradeAmountUSD);
            if (tradeAmountUSD < 5) return;
            const tradeAmount = parseEther((
                Math.floor(
                    1e9 * tradeAmountUSD / (isBuy ? this.quotePrice : this.basePrice)
                ) / 1e9
            ).toString());

            let attempts = 0;
            let buySuccess = false;

            do {
                try {
                    console.log(`Wallet ${sender.address} ${isBuy ? 'buying' : 'selling'} with ${tradeAmount}...`)

                    let hash;
                    if (!isBuy) {
                        hash = await PancakeSwapper.sellTokenToNative(
                            senderWallet,
                            this.baseTokenConfig.address,
                            tradeAmount,
                        )
                    } else {
                        hash = await PancakeSwapper.buyTokenWithNative(
                            senderWallet,
                            this.baseTokenConfig.address,
                            tradeAmount,
                        )
                    }
                    console.log(hash);
                    buySuccess = true;
                } catch (err) {
                    console.log(err);
                    attempts++;
                    await sleep(5000);
                }
            } while (attempts < 3 && !buySuccess)
        }

        async run() {
            let cur1hVol: number;
            while (true) {
                cur1hVol = await TokenStats.get1hVolume(this.baseTokenConfig.pair)
                console.log(`Current 1h vol: ${cur1hVol}`);
                if (cur1hVol >= this.config.targetVol1h) {
                    console.log(`Done.`);
                    await sleep(30000);
                    continue;
                };
                const numberOfTrades = getRandomInt(300, 500);
                console.log(`Making vol with ${numberOfTrades} random trades...`);
                for (let i = 0; i < numberOfTrades; i++) {
                    await this._update();
                    const wallets = this._pickSenderAndRecipient();
                    if (wallets) {
                        const { sender, recipient, fundDestination } = wallets;
                        console.log(`Picked sender: ${sender.address}. Picked recipient: ${recipient.address}`)
                        await this._makeTrade(sender, recipient, fundDestination);
                    }
                }

                if (!this.config.disableRebalancing) {
                    await this._update();
                    const shuffledMakers = this.makers.sort(() => Math.random() - 0.5);
                    for (const maker of shuffledMakers) {
                        console.log(`Maker ${maker.address} rebalancing....`)
                        await this._rebalance(maker);
                    }
                }

                await sleep(5000);
            }
        }
    }
}