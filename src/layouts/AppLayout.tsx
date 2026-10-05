import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, Ellipsis, House, Landmark, LayoutDashboard, PiggyBank, Plus, Receipt, Settings, X, type LucideIcon } from 'lucide-react'
import { cx } from '../components/ui'
import { useModals } from '../components/modals/ModalHost'
import { useApplyAppearance } from '../hooks/useTheme'
import { useStore } from '../store/AppStore'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const nav: NavItem[] = [
  { to: '/', label: 'Home', icon: House },
  { to: '/transactions', label: 'History', icon: Receipt },
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/plan', label: 'Plan', icon: PiggyBank },
  { to: '/accounts', label: 'Accounts', icon: Landmark },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const mobileMain = nav.slice(0, 4)
const mobileMore = nav.slice(4)

export default function AppLayout() {
  useApplyAppearance()
  const { openTransaction } = useModals()
  const { data, resetDemo } = useStore()
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1024)
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMoreOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
      isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-soft hover:text-ink',
    )

  return (
    <div className="min-h-dvh">
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-card px-3 py-5 transition-[width] duration-200 md:flex',
          collapsed ? 'w-[68px]' : 'w-60',
        )}
      >
        <div className={cx('mb-6 flex items-center gap-2 px-2', collapsed && 'justify-center px-0')}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white dark:text-zinc-950">₫</span>
          {!collapsed && <span className="font-semibold tracking-tight">NAMONEY</span>}
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass} title={collapsed ? item.label : undefined} aria-label={item.label}>
              <item.icon size={18} className="shrink-0" />
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-soft"
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          {!collapsed && 'Collapse'}
        </button>
      </aside>

      <div className={cx('transition-[padding] duration-200', collapsed ? 'md:pl-[68px]' : 'md:pl-60')}>
        {data.isDemo && (
          <div className="border-b border-line bg-accent-soft px-4 py-2 text-center text-xs text-accent">
            You're viewing demo data.{' '}
            <button className="font-semibold underline" onClick={() => confirm('Reset all data back to the demo set?') && resetDemo()}>
              Reset demo
            </button>{' '}
            or clear it in Settings › Data.
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 pb-32 pt-6 md:px-8 md:pb-16 md:pt-8">
          <Outlet />
        </main>
      </div>

      {location.pathname !== '/' && (
        <button
          onClick={() => openTransaction()}
          aria-label="Add transaction"
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg active:scale-95 dark:text-zinc-950 md:hidden"
        >
          <Plus size={26} />
        </button>
      )}

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {mobileMain.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => cx('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-accent' : 'text-muted')}
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
        <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted" aria-haspopup="dialog">
          <Ellipsis size={20} />
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="anim-fade fixed inset-0 z-40 flex items-end bg-black/40 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="anim-sheet w-full rounded-t-2xl border border-line bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="More">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">More</h2>
              <button onClick={() => setMoreOpen(false)} aria-label="Close" className="rounded-lg p-2 text-muted"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {mobileMore.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
