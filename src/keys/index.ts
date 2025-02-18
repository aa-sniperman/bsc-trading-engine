import { ethers } from "ethers";
import * as fs from "fs";
import { PROVIDER, TokenConfigInfo } from "src/constants";

export namespace Keys {
    export interface WalletKey {
        index: number;
        privateKey: string;
        address: string;
    }

    export function getFlattenedVolKeys(config: TokenConfigInfo) {
        let makers: WalletKey[] = [];
        for (let i = 0; i < 50; i++) {
            try {
                const set = require(`src/secrets/${config.symbol.toLowerCase()}/vol-keys-${i}.json`) as WalletKey[];
                makers = makers.concat(set);
            } catch (err) {

            }
        }
        return makers;
    }

    export async function genKeys(numOfKeys: number, fileName: string) {
        const keys: WalletKey[] = [];

        for (let i = 0; i < numOfKeys; i++) {
            // Generate a random wallet
            const wallet = ethers.Wallet.createRandom();

            // Append wallet details to keys
            const key: WalletKey = {
                index: i,
                privateKey: wallet.privateKey,
                address: wallet.address,
            };

            keys.push(key);
        }

        // Save keys to secret.json
        fs.writeFileSync(`src/secrets/${fileName}.json`, JSON.stringify(keys), "utf-8");

        console.log(`Successfully generated ${numOfKeys} keys and saved to ${fileName}.json.`);

        return keys;
    }
    export function walletKeysToWallets(keys: WalletKey[]) {
        return keys.map(k => new ethers.Wallet(k.privateKey, PROVIDER));
    }

    export function getVolKeys(config: TokenConfigInfo) {
        const makerSets: WalletKey[][] = [];
        for (let i = 0; i < 50; i++) {
            try {
                const set = require(`src/secrets/${config.symbol.toLowerCase()}/vol-keys-${i}.json`) as WalletKey[];
                makerSets.push(set);
            } catch (err) {

            }
        }
        return makerSets;
    }
}
