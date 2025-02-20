import { TransactionRequest, Wallet } from "ethers";
import { PANCACKE_V3_ROUTER, PROVIDER, WRAPPED_NATIVE } from "src/constants";
import { IWETH__factory, PancackeV3Router__factory } from "src/contracts";
import { ISwapRouter } from "src/contracts/PancackeV3Router";
import { Token } from "src/token";
export namespace PancakeV3Swap {

  export async function wrap(wallet: Wallet, amount: bigint) {
    const weth = IWETH__factory.connect(WRAPPED_NATIVE, wallet);
    const tx = await weth.deposit({ value: amount });
    await tx.wait();
    return tx.hash;
  }

  export async function wrapIfNeeded(wallet: Wallet, amount: bigint) {
    const wNativeBal = await Token.getTokenBalance(wallet.address, WRAPPED_NATIVE);
    if(wNativeBal >= amount) return;
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
    await wrapIfNeeded(wallet, amountIn)
    await Token.approveIfNeeded(wallet, PANCACKE_V3_ROUTER, WRAPPED_NATIVE, amountIn as bigint);

    const routerContract = PancackeV3Router__factory.connect(PANCACKE_V3_ROUTER, wallet);
    const tx = await routerContract.exactInputSingle({
      tokenIn: WRAPPED_NATIVE,
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

  export async function sellToNative(wallet: Wallet, tokenIn: string, amountIn: bigint, fee = 10000, recipient?: string) {
    await Token.approveIfNeeded(wallet, PANCACKE_V3_ROUTER, tokenIn, amountIn as bigint);

    const routerContract = PancackeV3Router__factory.connect(PANCACKE_V3_ROUTER, wallet);
    const tx = await routerContract.exactInputSingle({
      tokenIn,
      tokenOut: WRAPPED_NATIVE,
      fee,
      recipient: recipient ?? wallet.address,
      deadline: Date.now() + 60000,
      amountIn,
      amountOutMinimum: 0n,
      sqrtPriceLimitX96: 0n
    });
    await tx.wait();
    
    await unwrapAll(wallet);
    return tx.hash;
  }
}