import { TransactionRequest, Wallet } from "ethers";
import { CHAIN_ID, PANCACKE_V3_ROUTER, PROVIDER, WRAPPED_NATIVE } from "src/constants";
import { IWETH__factory, PancackeV3Router__factory } from "src/contracts";
import { Token } from "src/token";
import {Native} from "@pancakeswap/swap-sdk-evm";
import { Pool, Route, SwapRouter, Trade } from "@pancakeswap/v3-sdk";
import { CurrencyAmount, Token as PancakeToken, Percent, TradeType, Currency } from "@pancakeswap/swap-sdk-core";
export namespace PancakeV3Swap {

  export async function wrap(wallet: Wallet, amount: bigint) {
    const weth = IWETH__factory.connect(WRAPPED_NATIVE, wallet);
    const tx = await weth.deposit({ value: amount });
    await tx.wait();
    return tx.hash;
  }

  export async function wrapIfNeeded(wallet: Wallet, amount: bigint) {
    const wNativeBal = await Token.getTokenBalance(wallet.address, WRAPPED_NATIVE);
    if (wNativeBal >= amount) return;
    const hash = await wrap(wallet, amount - wNativeBal);
    console.log(hash);
  }
  export async function unwrap(wallet: Wallet, amount: bigint) {
    const weth = IWETH__factory.connect(WRAPPED_NATIVE, wallet);
    const tx = await weth.withdraw(amount);
    await tx.wait();
    return tx.hash;
  }

  export async function unwrapAll(wallet: Wallet) {
    const wNativeBal = await Token.getTokenBalance(wallet.address, WRAPPED_NATIVE);
    const hash = await unwrap(wallet, wNativeBal)
    console.log(hash);
  }
  export async function executeSwap(wallet: Wallet, tokenIn: string, tokenOut: string, amountIn: bigint, fee = 10000, recipient?: string) {
    await Token.approveIfNeeded(wallet, PANCACKE_V3_ROUTER, tokenIn as string, amountIn as bigint);

    const routerContract = PancackeV3Router__factory.connect(PANCACKE_V3_ROUTER, wallet);
    const tx = await routerContract.exactInputSingle({
      tokenIn,
      tokenOut,
      fee,
      recipient: recipient ?? wallet.address,
      deadline: Date.now() + 60000,
      amountIn,
      amountOutMinimum: 0n,
      sqrtPriceLimitX96: 0n
    });
    await tx.wait();
    return tx.hash;
  }

  export async function buyWithNative(wallet: Wallet, tokenOut: string, amountIn: bigint, fee = 10000, recipient?: string) {
    const tIn = Native.onChain(CHAIN_ID);
    const tOut = new PancakeToken(
      CHAIN_ID,
      tokenOut as any,
      18,
      'QUOTE'
    )

    const pool = new Pool(
      tIn.wrapped,
      tOut,
      fee,
      0,
      0,
      0
    )
    const swapRoute = new Route(
      [pool],
      tIn,
      tOut
    )


    const methodParameters = SwapRouter.swapCallParameters(
      Trade.createUncheckedTrade({
        route: swapRoute,
        inputAmount: CurrencyAmount.fromRawAmount(tIn, amountIn),
        outputAmount: CurrencyAmount.fromRawAmount(tOut, 0n),
        tradeType: TradeType.EXACT_INPUT
      }), {
      slippageTolerance: new Percent(10_000, 10_000),
      deadline: Date.now() + 60000,
      recipient: recipient ?? wallet.address
    })
    const txReq = {
      data: methodParameters.calldata,
      to: PANCACKE_V3_ROUTER,
      value: methodParameters.value,
      from: wallet.address,
    }

    const tx = await wallet.sendTransaction(txReq);
    await tx.wait();
    return tx.hash;
  }

  export async function sellToNative(wallet: Wallet, tokenIn: string, amountIn: bigint, fee = 10000, recipient?: string) {
    await Token.approveIfNeeded(wallet, PANCACKE_V3_ROUTER, tokenIn, amountIn);
    const tOut = Native.onChain(CHAIN_ID);
    const tIn = new PancakeToken(
      CHAIN_ID,
      tokenIn as any,
      18,
      'QUOTE'
    )

    const pool = new Pool(
      tIn,
      tOut.wrapped,
      fee,
      0,
      0,
      0
    )
    const swapRoute = new Route(
      [pool],
      tIn,
      tOut
    )


    const methodParameters = SwapRouter.swapCallParameters(
      Trade.createUncheckedTrade({
        route: swapRoute,
        inputAmount: CurrencyAmount.fromRawAmount(tIn, amountIn),
        outputAmount: CurrencyAmount.fromRawAmount(tOut, 0n),
        tradeType: TradeType.EXACT_INPUT
      }), {
      slippageTolerance: new Percent(10_000, 10_000),
      deadline: Date.now() + 60000,
      recipient: recipient ?? wallet.address
    })
    const txReq = {
      data: methodParameters.calldata,
      to: PANCACKE_V3_ROUTER,
      value: methodParameters.value,
      from: wallet.address,
    }

    const tx = await wallet.sendTransaction(txReq);
    await tx.wait();
    return tx.hash;
  }
}