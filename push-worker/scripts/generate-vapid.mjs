import { webcrypto } from 'node:crypto';

const toBase64Url = value => Buffer.from(value)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const decodeBase64Url = value => Buffer.from(
  value.replace(/-/g, '+').replace(/_/g, '/'),
  'base64',
);

const keyPair = await webcrypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
);
const publicJwk = await webcrypto.subtle.exportKey('jwk', keyPair.publicKey);
const privateJwk = await webcrypto.subtle.exportKey('jwk', keyPair.privateKey);
const publicKey = Buffer.concat([
  Buffer.from([4]),
  decodeBase64Url(publicJwk.x),
  decodeBase64Url(publicJwk.y),
]);

console.log(`VAPID_PUBLIC_KEY=${toBase64Url(publicKey)}`);
console.log(`VAPID_PRIVATE_KEY=${privateJwk.d}`);
