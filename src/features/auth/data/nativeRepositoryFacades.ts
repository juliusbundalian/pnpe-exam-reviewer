import type { Auth } from '@react-native-firebase/auth';
import type { Firestore } from '@react-native-firebase/firestore';
import type { AuthenticationSdk } from './FirebaseAuthenticationRepository';
import { createProfileSdk, type ProfileSdk } from './FirebaseProfileRepository';

/** Bind existing native services; these factories never initialize an app. */
export async function createNativeAuthenticationSdk(auth: Auth): Promise<AuthenticationSdk> {
  const sdk = await import('@react-native-firebase/auth');
  return {
    onAuthStateChanged: (listener, onError) => sdk.onAuthStateChanged(auth, listener, onError),
    signInWithEmailAndPassword: (email, password) =>
      sdk.signInWithEmailAndPassword(auth, email, password),
    createUserWithEmailAndPassword: (email, password) =>
      sdk.createUserWithEmailAndPassword(auth, email, password),
    sendPasswordResetEmail: (email) => sdk.sendPasswordResetEmail(auth, email),
    signOut: () => sdk.signOut(auth),
  };
}

export async function createNativeProfileSdk(firestore: Firestore): Promise<ProfileSdk> {
  const sdk = await import('@react-native-firebase/firestore');
  return createProfileSdk({
    doc: (collection, uid) => sdk.doc(firestore, collection, uid),
    getDoc: (reference) => sdk.getDoc(reference),
    serverTimestamp: () => sdk.serverTimestamp(),
    runTransaction: (action) =>
      sdk.runTransaction(firestore, async (transaction) => {
        await action({
          get: (reference) => transaction.get(reference),
          update: (reference, fields) => {
            transaction.update(reference, fields);
          },
          set: (reference, fields) => {
            transaction.set(reference, fields);
          },
        });
      }),
  });
}
