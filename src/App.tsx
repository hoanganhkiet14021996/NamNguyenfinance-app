import { Route, Routes, useLocation } from 'react-router-dom'
import { ModalProvider } from './components/modals/ModalHost'
import AppLayout from './layouts/AppLayout'
import AccountDetail from './pages/AccountDetail'
import Accounts from './pages/Accounts'
import ComingSoon from './pages/ComingSoon'
import Dashboard from './pages/Dashboard'
import Home from './pages/Home'
import Plan from './pages/Plan'
import Settings from './pages/Settings'
import Transactions from './pages/Transactions'
import { StoreProvider } from './store/AppStore'

function TransactionsRoute() {
  const { search } = useLocation()
  return <Transactions key={search} />
}

export default function App() {
  return (
    <StoreProvider>
      <ModalProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Home />} />
            <Route path="transactions" element={<TransactionsRoute />} />
            <Route path="overview" element={<Dashboard />} />
            <Route path="plan" element={<Plan />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="accounts/:id" element={<AccountDetail />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<ComingSoon title="Not found" phase={1} text="This page does not exist." />} />
          </Route>
        </Routes>
      </ModalProvider>
    </StoreProvider>
  )
}
