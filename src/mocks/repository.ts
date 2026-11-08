import { createMockSeed, defaultNftMedia, type MockState } from './fixtures'

const databaseName = 'acervo-demo'
const storeName = 'marketplace'
const stateKey = 'state'

type AddedStores = 'guestCarts' | 'accountCarts' | 'guestClaims' | 'sessions' | 'quotes'
type PreviousState = Omit<MockState, AddedStores> & Partial<Pick<MockState, AddedStores>>

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 4)
    request.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) {
        request.result.createObjectStore(storeName).put(createMockSeed(), stateKey)
        return
      }

      const store = request.transaction!.objectStore(storeName)
      const previous = store.get(stateKey)
      previous.onsuccess = () => {
        const state = previous.result as PreviousState | undefined
        if (!state) return
        store.put({
          ...state,
          nfts: state.nfts.map((nft) => nft.media.length ? nft : { ...nft, media: defaultNftMedia(nft.id) }),
          guestCarts: state.guestCarts ?? {},
          accountCarts: state.accountCarts ?? {},
          guestClaims: state.guestClaims ?? {},
          sessions: state.sessions ?? {},
          quotes: state.quotes ?? {},
        } satisfies MockState, stateKey)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact<Result>(
  mode: IDBTransactionMode,
  operation: (state: MockState, store: IDBObjectStore) => Result,
): Promise<Result> {
  const database = await openDatabase()

  try {
    return await new Promise<Result>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode)
      const store = transaction.objectStore(storeName)
      const request = store.get(stateKey)
      let result: Result
      let failure: unknown

      request.onsuccess = () => {
        try {
          result = operation((request.result as MockState | undefined) ?? createMockSeed(), store)
        } catch (error) {
          failure = error
          transaction.abort()
        }
      }

      transaction.oncomplete = () => resolve(result)
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Transação cancelada'))
    })
  } finally {
    database.close()
  }
}

export function readMockState() {
  return transact('readonly', (state) => state)
}

export function updateMockState<Result>(update: (state: MockState) => Result) {
  return transact('readwrite', (state, store) => {
    const result = update(state)
    store.put(state, stateKey)
    return result
  })
}

export function resetMockState() {
  return transact('readwrite', (_state, store) => {
    const seed = createMockSeed()
    store.put(seed, stateKey)
    return seed
  })
}
