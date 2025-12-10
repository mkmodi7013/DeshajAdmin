import { db, logHistory } from './history-logger.js';
import {
  collection, query, where, onSnapshot,
  getDocs, runTransaction, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const ordersRef = collection(db, 'orders');
const stockRef = collection(db, 'stock');

// Listen to Processed orders
const q = query(ordersRef, where('status', '==', 'Processed'));

onSnapshot(q, async (snapshot) => {

  snapshot.docChanges().forEach(async (change) => {

    if (change.type !== "added" && change.type !== "modified") return;

    const orderDoc = change.doc;
    const order = orderDoc.data();
    const orderId = orderDoc.id;

    // Skip if already reduced
    if (order.stockReduced) return;

    if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
      await logHistory({ action: 'no-items', orderId, note: 'Order has no items' });
      return;
    }

    for (const item of order.items) {
      try {
        if (!item.name || !item.qty) {
          await logHistory({ action:'invalid-item', orderId, note: JSON.stringify(item) });
          continue;
        }

        // Find stock by name
        const stockSnap = await getDocs(stockRef);
        const stockDocs = stockSnap.docs.filter(d =>
          d.data().name?.trim().toLowerCase() === item.name.trim().toLowerCase()
        );

        if (stockDocs.length === 0) {
          await logHistory({
            action: 'auto-minus-failed',
            product: item.name,
            oldQty: null,
            newQty: null,
            note: `Stock not found (Order ${orderId})`
          });
          continue;
        }

        const stockDoc = stockDocs[0];
        const stockDocRef = doc(db, 'stock', stockDoc.id);

        // Transaction to decrement stock
        await runTransaction(db, async (t) => {
          const sdoc = await t.get(stockDocRef);
          const oldQty = sdoc.data().qty ?? 0;
          let newQty = oldQty - item.qty;
          if (newQty < 0) newQty = 0;
          t.update(stockDocRef, { qty: newQty });

          // Log inside transaction
          await logHistory({
            action: 'auto-minus',
            product: item.name,
            oldQty,
            newQty,
            qtyUsed: item.qty,
            orderId
          });
        });

      } catch (err) {
        console.error('Error processing item', item.name, err);
        await logHistory({
          action: 'auto-minus-error',
          product: item.name,
          error: String(err),
          orderId
        });
      }
    } // end items loop

    // Mark order as stock reduced
    await updateDoc(doc(db, 'orders', orderId), { stockReduced: true });

  }); // end docChanges.forEach
});
