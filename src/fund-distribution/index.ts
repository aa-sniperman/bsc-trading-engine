import { id, parseEther, Wallet } from "ethers";
import { Token } from "../token";
import { Keys } from "src/keys";
import { NATIVE, PROVIDER } from "src/constants";
import { sleep } from "src/utils";

export namespace FundDistribution {
    async function estimateTransferTokenGas(pk: string, token: string) {
        return parseEther('0.00001')
    }

    async function estimateTransferETHGas(pk: string) {
        return parseEther('0.00001')
    }

    async function groupEndWithMiddle(
        middleKeys: Keys.WalletKey[],
        endKeys: Keys.WalletKey[],
        endAmounts: bigint[],
        transferGas: bigint,
    ) {
        const endPerMiddle = Math.ceil(endKeys.length / middleKeys.length);
        let middleAmounts: bigint[] = [];
        let middleGas: bigint[] = [];
        const groupedEndKeys: Keys.WalletKey[][] = [];
        const groupedEndAmounts: bigint[][] = [];
        for (let middleIdx = 0; middleIdx < middleKeys.length; middleIdx++) {
            let middleAmount = 0n;
            let targetedEndKeys: Keys.WalletKey[] = [];
            let targetedEndAmounts: bigint[] = [];
            const minEndIdx = middleIdx * endPerMiddle;
            const maxEndIdx = Math.min(endKeys.length, (middleIdx + 1) * endPerMiddle)
            for (let endIdx = minEndIdx; endIdx < maxEndIdx; endIdx++) {
                middleAmount += endAmounts[endIdx];
                targetedEndKeys.push(endKeys[endIdx]);
                targetedEndAmounts.push(endAmounts[endIdx]);
            }
            middleAmounts.push(middleAmount);
            middleGas.push(transferGas * BigInt(maxEndIdx - minEndIdx))
            groupedEndKeys.push(targetedEndKeys);
            groupedEndAmounts.push(targetedEndAmounts);
        }
        return { middleAmounts, middleGas, groupedEndKeys, groupedEndAmounts };
    }

    async function distributeToMiddle(
        srcKey: Keys.WalletKey,
        token: string,
        middleKeys: Keys.WalletKey[],
        middleAmounts: bigint[],
        middleGas: bigint[],
    ) {
        const middleGasBalances = await Token.getRawBalances(middleKeys.map(k => k.address), [NATIVE]);
        if (token === NATIVE) {
            await Token.batchFastTransferETH(
                new Wallet(srcKey.privateKey, PROVIDER),
                middleAmounts.map((a, idx) => {
                    const delta = a + middleGas[idx] - middleGasBalances[middleKeys[idx].address][token];
                    return delta >= 0n ? delta : 0n
                }),
                middleKeys.map(k => k.address)
            )
        } else {
            const lastNonce = await Token.batchFastTransferETH(
                new Wallet(srcKey.privateKey, PROVIDER),
                middleGas,
                middleKeys.map(k => k.address)
            )
            await Token.batchFastTransferToken(
                new Wallet(srcKey.privateKey, PROVIDER),
                token,
                middleAmounts,
                middleKeys.map(k => k.address),
                lastNonce
            )
        }
    }

    async function distributeToEnd(
        middleKey: Keys.WalletKey,
        token: string,
        endKeys: Keys.WalletKey[],
        endAmounts: bigint[]
    ) {
        if (token === NATIVE) {
            await Token.batchFastTransferETH(
                new Wallet(middleKey.privateKey, PROVIDER),
                endAmounts,
                endKeys.map(k => k.address)
            )
        } else {
            await Token.batchFastTransferToken(
                new Wallet(middleKey.privateKey, PROVIDER),
                token,
                endAmounts,
                endKeys.map(k => k.address)
            )
        }
    }

    export async function distribute(
        srcKey: Keys.WalletKey,
        token: string,
        middleKeys: Keys.WalletKey[],
        endKeys: Keys.WalletKey[],
        endAmounts: bigint[],
    ) {
        const transferGas = token === NATIVE ?
            await estimateTransferETHGas(srcKey.privateKey) :
            await estimateTransferTokenGas(srcKey.privateKey, token);

        const {
            middleAmounts,
            middleGas,
            groupedEndKeys,
            groupedEndAmounts
        } = await groupEndWithMiddle(middleKeys, endKeys, endAmounts, transferGas);

        console.log(transferGas);
        console.log(middleAmounts);
        console.log(middleGas);
        console.log(groupedEndKeys);
        console.log(groupedEndAmounts);
        console.log(`------------Distribute to middle wallets------------`);
        await distributeToMiddle(
            srcKey,
            token,
            middleKeys,
            middleAmounts,
            middleGas
        );

        await sleep(10000);
        console.log(`------------Distribute to end wallets-------------`);
        await Promise.all(middleKeys.map(async (middleKey, idx) => {
            await distributeToEnd(
                middleKey,
                token,
                groupedEndKeys[idx],
                groupedEndAmounts[idx]
            )
        }))
    }

    async function moveFundBetween2Wallets(
        srcKey: Keys.WalletKey,
        endKey: Keys.WalletKey,
    ) {
        const ethBal = await Token.getTokenBalance(srcKey.address, NATIVE);
        const gasFee = parseEther('0.00005');
        await Token.transferETH(new Wallet(srcKey.privateKey, PROVIDER), ethBal - gasFee, endKey.address);
    }
    export async function migrateMMFunds(
        srcKeys: Keys.WalletKey[],
        endKeys: Keys.WalletKey[],
    ) {
        await Promise.all(srcKeys.map((src, i) => {
            moveFundBetween2Wallets(src, endKeys[i]);
        }))
    }
}