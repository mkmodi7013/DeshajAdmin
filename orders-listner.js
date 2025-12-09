// orders-listener.js
import { db, logHistory } from './history-logger.js';
import {
  collection, query, where, onSnapshot,
  getDocs, runTransaction, doc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const ordersRef = collection(db, 'orders');
const stockRef = collection(db, 'stock');

// Listen to Processed orders
const q = query(ordersRef, where('status', '==', 'Processed'));

onSnapshot(q, async (snapshot) => {

  snapshot.forEach(async (orderDoc) => {

    const order = orderDoc.data();
    const orderId = orderDoc.id;

    // Skip if no items
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

        // Fetch stock docs and match by lowercase trimmed name
        const stockSnap = await getDocs(stockRef);
        const stockDocs = stockSnap.docs.filter(d =>
          d.data().product?.trim().toLowerCase() === item.name.trim().toLowerCase()
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

        // Transaction: decrement stock
        await runTransaction(db, async (t) => {
          const sdoc = await t.get(stockDocRef);
          const oldQty = sdoc.data().quantity ?? 0;
          let newQty = oldQty - item.qty;
          if (newQty < 0) newQty = 0;
          t.update(stockDocRef, { quantity: newQty });
          return { oldQty, newQty };
        }).then(async ({ oldQty, newQty }) => {
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

    // ⚠️ Do NOT update status → stays Processed

  }); // end snapshot.forEach

});
