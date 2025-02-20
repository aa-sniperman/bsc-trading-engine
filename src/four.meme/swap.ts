import { TransactionRequest, Wallet } from "ethers";
import { CHAIN_ID, TOKEN_MANAGER_V2 } from "src/constants";
import { ERC20__factory, TokenManager2__factory } from "src/contracts";
import { Token } from "src/token";

export namespace FourMemeSwapper {
    export async function buy(
        wallet: Wallet,
        token: string,
        amountIn: bigint
    ) {
        const sc = TokenManager2__factory.connect(TOKEN_MANAGER_V2, wallet);
        const tx = await sc["buyTokenAMAP(address,uint256,uint256)"](token, amountIn, 0n, { value: amountIn });
        await tx.wait();
        return tx.hash;
    }

    export async function sell(
        wallet: Wallet,
        token: string,
        amountIn: bigint
    ) {
        await Token.approveIfNeeded(wallet, TOKEN_MANAGER_V2, token, amountIn);
        const sc = TokenManager2__factory.connect(TOKEN_MANAGER_V2, wallet);
        const tx = await sc.sellToken(token, amountIn);
        await tx.wait();
        return tx.hash;
    }

    export async function fastBuy(
        wallet: Wallet,
        nonce: number,
        token: string,
        amountIn: bigint
    ) {
        const data = TokenManager2__factory.createInterface().encodeFunctionData(
            'buyTokenAMAP(address,uint256,uint256)',
            [
                token,
                amountIn,
                0n
            ]
        )
        const tx: TransactionRequest = {
            from: wallet.address,
            to: TOKEN_MANAGER_V2,
            value: amountIn,
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

    export async function fastSell(
        wallet: Wallet,
        nonce: number,
        token: string,
        amountIn: bigint
    ) {
        const approvalData = ERC20__factory.createInterface().encodeFunctionData(
            'approve',
            [
                TOKEN_MANAGER_V2,
                amountIn
            ]
        );
        const approvalTx: TransactionRequest = {
            from: wallet.address,
            to: token,
            gasLimit: 100_000n,
            gasPrice: 3_000_000_000n,
            data: approvalData,
            nonce,
            type: 0,
            chainId: BigInt(CHAIN_ID)
        }
        const data = TokenManager2__factory.createInterface().encodeFunctionData(
            'sellToken',
            [
                token,
                amountIn,
            ]
        )
        const tx: TransactionRequest = {
            from: wallet.address,
            to: TOKEN_MANAGER_V2,
            gasLimit: 200_000n,
            gasPrice: 3_000_000_000n,
            data,
            nonce: nonce + 1,
            type: 0,
            chainId: BigInt(CHAIN_ID)
        }
        const singedApproval = await wallet.signTransaction(approvalTx);
        const signedTx = await wallet.signTransaction(tx);
        wallet.provider!.broadcastTransaction(singedApproval);
        const receipt = await wallet.provider!.broadcastTransaction(signedTx);
        return receipt.hash;
    }
}