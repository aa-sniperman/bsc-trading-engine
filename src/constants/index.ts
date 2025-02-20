import { JsonRpcProvider } from "ethers";
import { env } from "src/configs";

const isMainnet = env.network === 'mainnet';

const rpc = env.bsc.mainnetRpc;

export const PROVIDER = new JsonRpcProvider(rpc);

export const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const WRAPPED_NATIVE = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

export const MULTICALL_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

export const CHAIN_ID = 56;
export const MAX_UINT256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
export const TOKEN_MANAGER_HELPER_V3 = '0xF251F83e40a78868FcfA3FA4599Dad6494E46034';
export const TOKEN_MANAGER_V2 = '0x5c952063c7fc8610FFDB798152D69F0B9550762b';
export const PANCACKE_V2_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
export const PANCACKE_V3_ROUTER = '0x1b81D678ffb9C0263b24A97847620C99d213eB14';
export const WBNB_PAIR = '0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE'

export interface TokenConfigInfo {
    address: string,
    pair: string,
    symbol: string,
  }
  export const TokenConfig = {
    WAIFU: {
      address: "0xd52a77306495c901C89738b7B3096B99c5c6570d",
      pair: "0x750A3FA3f88ca4842Cb2d210b8ab6fE1B7e48301",
      symbol: "WAIFU"
    },
  }