import { ethers, formatEther, TransactionRequest, Wallet } from "ethers";
import { Call, multicall, MULTICALL_ABI } from "src/multicall";
import axios from "axios";
import { ERC20__factory } from "src/contracts";
import { sleep } from "src/utils";
import { CHAIN_ID, MAX_UINT256, MULTICALL_ADDRESS, NATIVE, PROVIDER } from "src/constants";
import ERC20_ABI from "src/abis/ERC20.json";

export namespace Token {
  export async function getTokenBalance(account: string, token: string) {
    if (token === NATIVE) {
      return await PROVIDER.getBalance(account);
    }
    const contract = ERC20__factory.connect(token, PROVIDER);
    return await contract.balanceOf(account);
  }

  export async function getRawBalances(accounts: string[], tokens: string[]) {
    const calls: Call[] = [];
    for (const account of accounts) {
      for (const token of tokens) {
        if (token === NATIVE) {
          calls.push({
            target: MULTICALL_ADDRESS,
            method: "getEthBalance",
            params: [account],
            contract: new ethers.Contract(MULTICALL_ADDRESS, MULTICALL_ABI, PROVIDER)
          })
        } else {
          calls.push({
            target: token,
            method: "balanceOf",
            params: [account],
            contract: new ethers.Contract(token, ERC20_ABI, PROVIDER)
          })
        }
      }
    }

    const multicallResult = await multicall(
      PROVIDER,
      MULTICALL_ADDRESS,
      calls,
    )

    const results: Record<string, Record<string, bigint>> = {};
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      const balances: Record<string, bigint> = {};

      multicallResult.slice(i * tokens.length, (i + 1) * tokens.length).forEach((result, j) => {
        balances[tokens[j]] = result[0] as bigint
        if (!results['total']) results['total'] = {};
        if (!results['total'][tokens[j]]) {
          results['total'][tokens[j]] = 0n;
        }
        results['total'][tokens[j]] = results['total'][tokens[j]] + balances[tokens[j]];
      })

      results[account] = balances;
    }
    return results;
  }

  export async function getBalances(accounts: string[], tokens: string[], symbols: string[]) {
    const calls: Call[] = [];
    for (const account of accounts) {
      for (const token of tokens) {
        if (token === NATIVE) {
          calls.push({
            target: MULTICALL_ADDRESS,
            method: "getEthBalance",
            params: [account],
            contract: new ethers.Contract(MULTICALL_ADDRESS, MULTICALL_ABI, PROVIDER)
          })
        } else {
          calls.push({
            target: token,
            method: "balanceOf",
            params: [account],
            contract: new ethers.Contract(token, ERC20_ABI, PROVIDER)
          })
        }
      }
    }

    const multicallResult = await multicall(
      PROVIDER,
      MULTICALL_ADDRESS,
      calls,
    )

    const results: Record<string, Record<string, string>> = {};
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      const balances: Record<string, string> = {};

      multicallResult.slice(i * tokens.length, (i + 1) * tokens.length).forEach((result, j) => {
        balances[symbols[j]] = formatEther((result[0] as BigInt).toString())
        if (!results['total']) results['total'] = {};
        if (!results['total'][symbols[j]]) {
          results['total'][symbols[j]] = '0';
        }
        results['total'][symbols[j]] = (+results['total'][symbols[j]] + parseFloat(balances[symbols[j]])).toString();
      })

      results[account] = balances;
    }
    return results;
  }

  export async function getTokenUSDPrice(token: string) {
    const client = axios.create({
      baseURL: 'https://api.dexscreener.com/',
      headers: {
        'content-type': 'application/json',
      },
    });

    const { data } = await client.get(`latest/dex/tokens/${token}`);
    // for(const pair of data.pairs) {
    // console.log(pair.baseToken, pair.quoteToken);
    // }
    const targetPairs = data.pairs.filter(
      (pair: any) =>
        pair.chainId === 'zksync' &&
        pair.baseToken.address === token &&
        pair.quoteToken.symbol === 'USDC.e',
    );

    const sortedPairs = targetPairs.sort(
      (a: any, b: any) => b.liquidity.base - a.liquidity.base,
    );
    return sortedPairs.at(0)?.priceNative
  }

  export async function approveToken(
    wallet: Wallet,
    spender: string,
    token: string,
    amount: bigint
  ) {
    const tokenSc = ERC20__factory.connect(token, wallet);
    const tx = await tokenSc.approve(spender, amount);
    await tx.wait();
    console.log(tx.hash)
    return tx.hash;
  }
  export async function approveIfNeeded(
    wallet: Wallet,
    spender: string,
    token: string,
    amount: bigint
  ) {
    const tokenSc = ERC20__factory.connect(token, wallet);
    const allowance = await tokenSc.allowance(wallet.address, spender);
    if (allowance < amount) {
      await approveToken(wallet, spender, token, BigInt(MAX_UINT256));
    }
  }

  export async function transferToken(wallet: Wallet, token: string, amount: bigint, recipient: string) {
    const tokenContract = ERC20__factory.connect(token, wallet);
    const tx = await tokenContract.transfer(recipient, amount);
    await tx.wait();
    console.log(tx.hash);
  }

  export async function transferETH(wallet: Wallet, amount: bigint, recipient: string) {
    const tx = await wallet.sendTransaction({
      to: recipient,
      value: '0x' + amount.toString(16),
    })
    console.log(amount, recipient)
    console.log(tx);
    await tx.wait();
    console.log(tx.hash);
  }

  export async function fastTransferToken(
    wallet: Wallet,
    nonce: number,
    token: string,
    amount: bigint,
    recipient: string
  ) {
    const txData = ERC20__factory.createInterface().encodeFunctionData(
      "transfer",
      [recipient, amount]
    );
    const tx: TransactionRequest = {
      from: wallet.address,
      to: token,
      data: txData,
      value: '0x0',
      chainId: CHAIN_ID,
      nonce,
      gasLimit: 1e6,
      gasPrice: 1e7,
    }

    const signedTx = await wallet.signTransaction(tx);

    const res = await wallet.provider!.broadcastTransaction(signedTx);

    return res.hash;
  }

  export async function batchFastTransferToken(
    wallet: Wallet,
    token: string,
    amounts: bigint[],
    recipients: string[],
    nonce?: number,
  ) {
    let curNonce = nonce ?? await wallet.getNonce();
    for (let i = 0; i < amounts.length; i++) {
      const amount = amounts[i];
      const recipient = recipients[i];
      try {
        const hash = await fastTransferToken(
          wallet,
          curNonce++,
          token,
          amount,
          recipient
        )
        console.log(hash);
      } catch (err) {
        console.log(err);
      }
      await sleep(100);
    }
    return curNonce;
  }

  export async function batchFastTransferETH(
    wallet: Wallet,
    amounts: bigint[],
    recipients: string[],
    nonce?: number,
  ) {
    let curNonce = nonce ?? await wallet.getNonce();
    for (let i = 0; i < amounts.length; i++) {
      const amount = amounts[i];
      if (amount === 0n) continue;
      const recipient = recipients[i];
      try {
        const pop = await wallet.populateTransaction({
          to: recipient,
          value: '0x' + amount.toString(16),
          gasLimit: 1e6,
          gasPrice: 1e7,
        })
        pop.nonce = curNonce++;
        const signedTx = await wallet.signTransaction(pop);

        const res = await wallet.provider!.broadcastTransaction(signedTx);
        console.log(res.hash);
      } catch (err) {
        console.log(err);
      }
      await sleep(1000);
    }
    return curNonce;
  }
}
