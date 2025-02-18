import axios from "axios";
import { NATIVE, TokenConfigInfo } from "src/constants";
import { Keys } from "src/keys";
import { Token } from "src/token";
import { sleep } from "src/utils";

export namespace TokenStats {
    export async function reportBalances(config: TokenConfigInfo) {
        const makerSets = Keys.getVolKeys(config);

        let totalbsc = 0;
        let totalBase = 0;

        for (let i = 0; i < makerSets.length; i++) {
            console.log('Set: ' + i);
            const balances = await Token.getBalances(
                makerSets[i].map(k => k.address),
                [NATIVE, config.address],
                ['bsc', config.symbol]
            )
            console.log(balances);
            totalbsc += Number(balances['total']['bsc']);
            totalBase += Number(balances['total'][config.symbol]);
        }

        console.log(totalbsc, totalBase)
    }

    export async function get24hVolume(pair: string) {
        let attempt = 0
        const maxAttempt = 5
        while (attempt <= maxAttempt) {
            try {
                const apiEndpoint = `https://api.dexscreener.com/latest/dex/pairs/bsc/${pair}`
                const response = await axios.get(apiEndpoint);
                console.log(response.data.pairs[0].volume.h24);
                return response.data.pairs[0].volume.h24;
            }
            catch (e) {
                await sleep(5000)
                attempt += 1
            }
        }
    }

    export async function get1hVolume(pair: string) {
        let attempt = 0
        const maxAttempt = 5
        while (attempt <= maxAttempt) {
            try {
                const apiEndpoint = `https://api.dexscreener.com/latest/dex/pairs/bsc/${pair}`
                const response = await axios.get(apiEndpoint);
                console.log(response.data.pairs[0].volume.h1);
                return response.data.pairs[0].volume.h1;
            }
            catch (e) {
                await sleep(5000)
                attempt += 1
            }
        }
    }

    export async function getTokenPrice(pair: string) {
        let attempt = 0
        const maxAttempt = 5
        while (attempt <= maxAttempt) {
            try {
                const apiEndpoint = `https://api.dexscreener.com/latest/dex/pairs/bsc/${pair}`
                const response = await axios.get(apiEndpoint);
                return Number(response.data.pairs[0].priceUsd);
            }
            catch (e) {
                await sleep(5000)
                attempt += 1
            }
        }
    }
}