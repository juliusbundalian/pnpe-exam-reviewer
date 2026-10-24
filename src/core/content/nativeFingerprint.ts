import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import { canonicalJson, type Fingerprint } from './Fingerprint';
export const nativeFingerprint: Fingerprint = {
  digest: (value) => digestStringAsync(CryptoDigestAlgorithm.SHA256, canonicalJson(value)),
};
