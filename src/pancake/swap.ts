import { TransactionRequest, Wallet } from "ethers";
import { CHAIN_ID, PANCACKE_V2_ROUTER, WRAPPED_NATIVE } from "src/constants";
import { PancackeRouter__factory } from "src/contracts";
import { Token } from "src/token";

export namespace PancakeSwapper {

    export async function fastBuyTokenWithNative(
        wallet: Wallet,
        nonce: number,
        token: string,
        amountIn: bigint,
        recipient?: string
    ) {
        const data = PancackeRouter__factory.createInterface().encodeFunctionData("swapExactETHForTokens", [
            0n,
            [
                WRAPPED_NATIVE,
                token
            ],
            recipient ?? wallet.address,
            Date.now() + 60000
        ]);
        const tx: TransactionRequest = {
            from: wallet.address,
            value: amountIn,
            to: PANCACKE_V2_ROUTER,
            gasLimit: 200_000n,
            gasPrice: 3_000_000_000n,
            data,
            nonce,
            type: 0,
            chainId: BigInt(CHAIN_ID)
        }
        const signedTx = await wallet.signTransaction(tx);
        const receipt = await wallet.provider!.broadcastTransaction(signedTx);
        return receipt.hash;
    }
    export async function buyTokenWithNative(
        wallet: Wallet,
        token: string,
        amountIn: bigint,
        recipient?: string
    ) {
        const sc = PancackeRouter__factory.connect(PANCACKE_V2_ROUTER, wallet);
        const tx = await sc.swapExactETHForTokens(
            0n,
            [
                WRAPPED_NATIVE,
                token
            ],
            recipient ?? wallet.address,
            Date.now() + 60000, {
            value: amountIn
        }
        );
        await tx.wait();
        return tx.hash;
    }

    export async function sellTokenToNative(
        wallet: Wallet,
        token: string,
        amountIn: bigint,
        recipient?: string
    ) {
        await Token.approveIfNeeded(wallet, PANCACKE_V2_ROUTER, token, amountIn);
        const sc = PancackeRouter__factory.connect(PANCACKE_V2_ROUTER, wallet);
        const tx = await sc.swapExactTokensForETH(
            amountIn,
            0n,
            [
                token,
                WRAPPED_NATIVE
            ],
            recipient ?? wallet.address,
            Date.now() + 60000
        );
        await tx.wait();
        return tx.hash;
    }
}