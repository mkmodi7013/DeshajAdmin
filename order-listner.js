// orders-listener.js
import { db, logHistory } from './history-logger.js';
import {
  collection, query, where, onSnapshot,
  getDocs, runTransaction, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const ordersRef = collection(db, 'orders');
const stockRef = collection(db, 'stock');

// listen only delivered (not processed)
const q = query(ordersRef, where('status', '==', 'Delivered'));

onSnapshot(q, async (snapshot) => {

  snapshot.forEach(async (orderDoc) => {

    const order = orderDoc.data();
    const orderId = orderDoc.id;

    /* safety check
    if (!order.items || order.items.length === 0) {
      await updateDoc(doc(db, "orders", orderId), { status: "processed" });
      return;
    }*/

    // Loop items
    for (const item of order.items) {

      try {
        // match stock product name
        const stockQuery = query(stockRef, where('product', '==', item.name));
        const stockSnap = await getDocs(stockQuery);

        if (stockSnap.empty) {
          await logHistory({
            action: 'auto-minus-failed',
            product: item.name,
            oldQty: null,
            newQty: null,
            note: `Stock not found for ${item.name} (Order ${orderId})`
          });
          continue;
        }

        const stockDoc = stockSnap.docs[0];
        const stockDocRef = doc(db, 'stock', stockDoc.id);

        // Transaction update stock
        await runTransaction(db, async (t) => {

          const sdoc = await t.get(stockDocRef);
          const oldQty = sdoc.data().quantity ?? 0;
          let newQty = oldQty - item.qty;

          if (newQty < 0) newQty = 0;

          t.update(stockDocRef, { quantity: newQty });

          // return values for log
          return { oldQty, newQty };

        }).then(async ({ oldQty, newQty }) => {

          // After stock update → log
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

        // log failure
        await logHistory({
          action: 'auto-minus-error',
          product: item.name,
          error: String(err),
          orderId
        });
      }

    } // end loop

    // mark processed so it won't run again
    await updateDoc(doc(db, 'orders', orderId), { status: 'processed' });

  });

});
