/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth } from 'firebase/auth';

let authInstance: Auth | null = null;
let googleProviderInstance: GoogleAuthProvider | null = null;
let firebaseReadyPromise: Promise<{ auth: Auth; googleProvider: GoogleAuthProvider }> | null = null;

async function loadFirebaseConfig() {
  const response = await fetch('/api/firebase-config', {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Firebase configuration is not available.');
  }

  return response.json();
}

export async function getFirebaseClient() {
  if (authInstance && googleProviderInstance) {
    return {
      auth: authInstance,
      googleProvider: googleProviderInstance
    };
  }

  if (!firebaseReadyPromise) {
    firebaseReadyPromise = loadFirebaseConfig().then((firebaseConfig) => {
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      authInstance = getAuth(app);
      googleProviderInstance = new GoogleAuthProvider();

      return {
        auth: authInstance,
        googleProvider: googleProviderInstance
      };
    });
  }

  return firebaseReadyPromise;
}

export { signInWithPopup };
