import * as dotenv from 'dotenv';
import * as Joi from 'joi';
dotenv.config();

export const isLocal = process.env.NODE_ENV === 'local';

const envVarsSchema = Joi.object()
  .keys({
    PRIVATE_KEY: Joi.string().required(),
    NETWORK: Joi.string().valid('mainnet', 'testnet'),
    MAINNET_RPC: Joi.string().default('https://binance.llamarpc.com'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env);

if (error != null) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const env = {
  network: envVars.NETWORK,
  keys: {
    pk: envVars.PRIVATE_KEY,
  },
  bsc: {
    mainnetRpc: envVars.MAINNET_RPC,
  },
};
