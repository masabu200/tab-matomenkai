import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const directory=path.dirname(fileURLToPath(import.meta.url));
export const tokenPath=process.env.TAB_MATOMEN_TOKEN_FILE||path.join(directory,'.local','token');
export const port=Number(process.env.TAB_MATOMEN_PORT||47831);
export function readToken(){return fs.readFileSync(tokenPath,'utf8').trim()}
export function ensureToken(){fs.mkdirSync(path.dirname(tokenPath),{recursive:true,mode:0o700});if(!fs.existsSync(tokenPath))fs.writeFileSync(tokenPath,crypto.randomBytes(32).toString('hex'),{mode:0o600});fs.chmodSync(tokenPath,0o600);return readToken()}
