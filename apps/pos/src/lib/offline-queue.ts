/**
 * Offline Queue Manager para POS
 *
 * Guarda órdenes localmente en IndexedDB si no hay conexión
 * Sincroniza automáticamente cuando reconecta
 *
 * IMPORTANTE: Esta es la especificación técnica.
 * Implementación completa en PASO 4.2
 */

interface QueuedOrder {
  id: string
  items: { productId: string; qty: number }[]
  customerId?: string
  total: number
  timestamp: number
  synced: boolean
}

// 1. Inicializar IndexedDB
export async function initOfflineDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('seul_pos_offline', 1)

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('orders')) {
        db.createObjectStore('orders', { keyPath: 'id' })
          .createIndex('synced', 'synced')
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// 2. Guardar orden localmente (cuando offline)
export async function saveOrderOffline(order: QueuedOrder) {
  const db = await initOfflineDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('orders', 'readwrite')
    const req = tx.objectStore('orders').add(order)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// 3. Obtener órdenes pendientes de sincronización
export async function getPendingOrders() {
  const db = await initOfflineDB()
  return new Promise<QueuedOrder[]>((resolve, reject) => {
    const tx = db.transaction('orders', 'readonly')
    const req = tx.objectStore('orders').getAll()

    req.onsuccess = () => {
      const all = req.result as QueuedOrder[]
      const pending = all.filter((order) => !order.synced)
      resolve(pending)
    }
    req.onerror = () => reject(req.error)
  })
}

// 4. Sincronizar con servidor
export async function syncOfflineOrders(apiUrl: string) {
  try {
    const pending = await getPendingOrders()

    for (const order of pending) {
      try {
        const response = await fetch(`${apiUrl}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order),
        })

        if (response.ok) {
          // Marcar como sincronizada
          await markOrderSynced(order.id)
        }
      } catch (error) {
        console.error('Sync error para orden:', order.id, error)
        // Reintentar luego
      }
    }
  } catch (error) {
    console.error('Sync failed:', error)
  }
}

// 5. Marcar como sincronizada
export async function markOrderSynced(orderId: string) {
  const db = await initOfflineDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('orders', 'readwrite')
    const req = tx.objectStore('orders').get(orderId)

    req.onsuccess = () => {
      const order = req.result
      order.synced = true
      tx.objectStore('orders').put(order)
      resolve()
    }

    req.onerror = () => reject(req.error)
  })
}

// 6. Detectar conexión y sincronizar
export function watchConnection(apiUrl: string) {
  window.addEventListener('online', () => {
    console.log('📡 Conexión restaurada, sincronizando órdenes...')
    syncOfflineOrders(apiUrl)
  })

  window.addEventListener('offline', () => {
    console.log('⚠️ Sin conexión, órdenes se guardarán localmente')
  })
}

export default {
  initOfflineDB,
  saveOrderOffline,
  getPendingOrders,
  syncOfflineOrders,
  markOrderSynced,
  watchConnection,
}
