import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Account, Transaction } from '../../types'
import SearchPalette from '../SearchPalette'
import { AccountModal, AdjustBalanceModal } from './AccountModals'
import TransactionModal, { type TxDefaults } from './TransactionModal'

type ModalState =
  | null
  | { kind: 'tx'; tx?: Transaction; defaults?: TxDefaults }
  | { kind: 'account'; account?: Account; onCreated?: (id: string) => void }
  | { kind: 'adjust'; account: Account }
  | { kind: 'search' }

interface Modals {
  openTransaction: (tx?: Transaction, defaults?: TxDefaults) => void
  openTransfer: () => void
  openAccount: (account?: Account, onCreated?: (id: string) => void) => void
  openAdjust: (account: Account) => void
  openSearch: () => void
}

const ModalContext = createContext<Modals>(null!)
export const useModals = () => useContext(ModalContext)

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>(null)
  const close = useCallback(() => setModal(null), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setModal((m) => (m?.kind === 'search' ? null : { kind: 'search' }))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const api = useMemo<Modals>(
    () => ({
      openTransaction: (tx, defaults) => setModal({ kind: 'tx', tx, defaults }),
      openTransfer: () => setModal({ kind: 'tx', defaults: { type: 'transfer' } }),
      openAccount: (account, onCreated) => setModal({ kind: 'account', account, onCreated }),
      openAdjust: (account) => setModal({ kind: 'adjust', account }),
      openSearch: () => setModal({ kind: 'search' }),
    }),
    [],
  )

  return (
    <ModalContext.Provider value={api}>
      {children}
      {modal?.kind === 'tx' && <TransactionModal key={modal.tx?.id ?? 'new'} tx={modal.tx} defaults={modal.defaults} onClose={close} />}
      {modal?.kind === 'account' && <AccountModal account={modal.account} onCreated={modal.onCreated} onClose={close} />}
      {modal?.kind === 'adjust' && <AdjustBalanceModal account={modal.account} onClose={close} />}
      {modal?.kind === 'search' && <SearchPalette onClose={close} />}
    </ModalContext.Provider>
  )
}
