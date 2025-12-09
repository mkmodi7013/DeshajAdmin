// history-logger.js
// initializes Firebase & exports db + history helpers
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* ====== REPLACE with your Firebase config ====== */
const firebaseConfig = {
  apiKey: "AIzaSyA6izuR2_oyHbAVhkIVkH0OHj6yAOduD_8",
  authDomain: "apna-kitchen-acdcc.firebaseapp.com",
  projectId: "apna-kitchen-acdcc",
  storageBucket: "apna-kitchen-acdcc.appspot.com",
  messagingSenderId: "129562055761",
  appId: "1:129562055761:web:baa01f9fea6f8eed025470"
};
/* =============================================== */

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const historyRef = collection(db,'stock_history');

// logHistory helper — keeps minimal fields
export async function logHistory({ action, product, oldQty=null, newQty=null, updatedBy='Admin', note=null, orderId=null }){
  try{
    await addDoc(historyRef, {
      action,
      product,
      oldQty,
      newQty,
      updatedBy,
      note,
      orderId,
      time: serverTimestamp()
    });
  }catch(e){ console.error('logHistory failed', e); }
}

// get recent history (limit)
export async function getRecentHistory(limitCount=10){
  try{
    const q = query(historyRef, orderBy('time','desc'), limit(limitCount));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    return rows;
  }catch(e){ console.error(e); return []; }
}

// fetch history all or limited
export async function fetchHistory(maxCount=500){
  return getRecentHistory(maxCount);
}

// export default logger as well
export default {
  logHistory,
  getRecentHistory,
  fetchHistory
};
