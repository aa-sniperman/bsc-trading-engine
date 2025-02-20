import { PROVIDER, TokenConfigInfo } from "src/constants";
import { Keys } from "src/keys";
import { Token } from "src/token";
import { getRandomInt } from "src/utils";
import { PancakeSwapper } from "./swap";
import { parseEther, Wallet } from "ethers";

export namespace PancakeTakeProfit {
    function getTopWalletsByBalance(balances: Record<string, Record<string, string>>, symbol: string, count: number) {
        return Object.entries(balances)
            .filter(([key]) => key !== 'total') // Ignore the total key
            .map(([address, balances]: any) => ({
                address,
                thoon: parseFloat(balances[symbol] || "0"),
            }))
            .sort((a, b) => b.thoon - a.thoon) // Sort by highest THOON balance
            .slice(0, count); // Get top N wallets
    }

    export async function takeProfitBuyBaseAmount(
        keys: Keys.WalletKey[],
        token: TokenConfigInfo,
        min: number, 
        max: number
    ) {
        const balances = await Token.getBalances(
            keys.map(k => k.address),
            [token.address],
            [token.symbol]
        );

        const top3Wallets = getTopWalletsByBalance(balances, token.symbol, 3);
        const top3Keys = top3Wallets.map(w => keys.find(k => k.address === w.address)!);
        await Promise.all(top3Keys.map(async (k) => {
            const amount = getRandomInt(Math.floor(min / 3), Math.floor(max / 3));
            await PancakeSwapper.sellTokenToNative(
                new Wallet(k.privateKey, PROVIDER),
                token.address,
                parseEther(amount.toString())
            )
        }))
    }
}