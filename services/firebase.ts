import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { FinancialState } from '../types';

let app: firebase.app.App | null = null;
let db: firebase.firestore.Firestore | null = null;

// The document ID where all E&R data will be stored
const DOC_ID = 'finances_main_v1';
const COLLECTION = 'er_finances';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const initFirebase = (config: FirebaseConfig) => {
  try {
    if (!firebase.apps.length) {
      app = firebase.initializeApp(config);
    } else {
      app = firebase.app();
    }
    db = firebase.firestore();
    return true;
  } catch (error) {
    console.error("Firebase init error:", error);
    return false;
  }
};

export const subscribeToData = (
  onData: (data: FinancialState) => void, 
  onError: (error: string) => void
) => {
  if (!db) {
    onError("Firebase no está configurado");
    return () => {};
  }

  // Create a real-time listener
  const unsubscribe = db.collection(COLLECTION).doc(DOC_ID).onSnapshot(
    (docSnapshot) => {
      if (docSnapshot.exists) {
        const data = docSnapshot.data() as FinancialState;
        // Basic validation to ensure it's our data structure
        if (data.debts && data.history) {
            onData(data);
        }
      } else {
        // Doc doesn't exist yet, we can optionally create it here or wait for first save
        console.log("Document does not exist yet on cloud");
      }
    },
    (error) => {
      console.error("Sync error:", error);
      onError("Error de sincronización: " + error.message);
    }
  );

  return unsubscribe;
};

export const saveDataToCloud = async (data: FinancialState) => {
  if (!db) return false;
  try {
    await db.collection(COLLECTION).doc(DOC_ID).set(data);
    return true;
  } catch (error) {
    console.error("Save error:", error);
    return false;
  }
};

export const isFirebaseConfigured = () => !!db;