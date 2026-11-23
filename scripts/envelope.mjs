// The public CI only uploads authenticated ciphertext. Signing stays in android-build.yml.
import fs from 'node:fs';
import crypto from 'node:crypto';
const [mode, input, output] = process.argv.slice(2);
const modeIsEncrypt = mode === 'encrypt';
const modeIsDecrypt = mode === 'decrypt';
if ((!modeIsEncrypt && !modeIsDecrypt) || !input || !output) {
  throw new Error('usage: private-build-envelope.mjs encrypt|decrypt input output [recipient-key.pem]');
}

const pemFile = process.argv[5];
const recipient = process.env.WB_PRIVATE_RECIPIENT_KEY;
const data = fs.readFileSync(input);
const recipientMagic = Buffer.from('WB-PRIVATE-APK-V2\0');
const algorithm = 'aes-256-gcm';
const rsaOptions = { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' };
const nonceBytes = 12;
const tagBytes = 16;

function encrypt(data, key, header) {
  const nonce = crypto.randomBytes(nonceBytes);
  const cipher = crypto.createCipheriv(algorithm, key, nonce);
  cipher.setAAD(header);
  return Buffer.concat([nonce, cipher.update(data), cipher.final(), cipher.getAuthTag()]);
}

function decrypt(data, key, header) {
  if (data.length < nonceBytes + tagBytes) throw new Error('invalid private envelope');
  const cipher = crypto.createDecipheriv(algorithm, key, data.subarray(0, nonceBytes));
  cipher.setAAD(header);
  cipher.setAuthTag(data.subarray(-tagBytes));
  return Buffer.concat([cipher.update(data.subarray(nonceBytes, -tagBytes)), cipher.final()]);
}

function wrappingLength(key) {
  const bits = key.asymmetricKeyDetails?.modulusLength;
  if (key.asymmetricKeyType !== 'rsa' || ![3072, 4096].includes(bits)) {
    throw new Error('recipient delivery requires a 3072 or 4096 bit RSA key');
  }
  return bits / 8;
}

if (modeIsEncrypt && recipient) {
  const publicKey = crypto.createPublicKey({
    key: Buffer.from(recipient, 'base64'), format: 'der', type: 'spki'
  });
  wrappingLength(publicKey);
  const dataKey = crypto.randomBytes(32);
  const wrappedKey = crypto.publicEncrypt({ ...rsaOptions, key: publicKey }, dataKey);
  const header = Buffer.concat([recipientMagic, wrappedKey]);
  fs.writeFileSync(output, Buffer.concat([header, encrypt(data, dataKey, header)]), { flag: 'wx' });
} else if (modeIsDecrypt && data.subarray(0, recipientMagic.length).equals(recipientMagic)) {
  if (!pemFile) throw new Error('recipient key file required');
  const privateKey = crypto.createPrivateKey(fs.readFileSync(pemFile));
  const headerLength = recipientMagic.length + wrappingLength(privateKey);
  if (data.length < headerLength + nonceBytes + tagBytes) throw new Error('invalid recipient envelope');
  const header = data.subarray(0, headerLength);
  const key = crypto.privateDecrypt({ ...rsaOptions, key: privateKey }, header.subarray(recipientMagic.length));
  fs.writeFileSync(output, decrypt(data.subarray(headerLength), key, header), { flag: 'wx' });
} else {
  const key = Buffer.from(process.env.WB_PRIVATE_BUILD_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('private build key missing');
  const aad = Buffer.from('world-between-private-build-v1');
  fs.writeFileSync(output, modeIsEncrypt ? encrypt(data, key, aad) : decrypt(data, key, aad));
}
