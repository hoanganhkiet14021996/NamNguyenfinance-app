import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { X } from 'lucide-react'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none select-none'
const btnVariants = {
  primary: 'bg-accent text-on-accent hover:opacity-90 px-4 py-2.5',
  secondary: 'bg-card border border-line text-ink hover:bg-soft px-4 py-2.5',
  ghost: 'text-muted hover:bg-soft hover:text-ink px-3 py-2',
  danger: 'bg-card border border-line text-neg hover:bg-soft px-4 py-2.5',
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof btnVariants }) {
  return <button {...props} className={cx(btnBase, btnVariants[variant], className)} />
}

/**
 * Tap-twice confirmation. Replaces window.confirm(), which embedded browsers and some installed
 * web apps never show (it silently returns false, so the action never happens).
 */
export function useConfirmTap(ms = 4000) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const tap = (action: () => void) => {
    window.clearTimeout(timer.current)
    if (armed) {
      setArmed(false)
      action()
      return
    }
    setArmed(true)
    timer.current = window.setTimeout(() => setArmed(false), ms)
  }
  return { armed, tap }
}

export function ConfirmButton({
  onConfirm,
  confirmLabel = 'Tap again to confirm',
  children,
  ...props
}: Omit<Parameters<typeof Button>[0], 'onClick'> & { onConfirm: () => void; confirmLabel?: ReactNode }) {
  const { armed, tap } = useConfirmTap()
  return (
    <Button type="button" {...props} onClick={() => tap(onConfirm)}>
      {armed ? confirmLabel : children}
    </Button>
  )
}

export function Card({ className, children, hover }: { className?: string; children: ReactNode; hover?: boolean }) {
  return <section className={cx('card p-5', hover && 'card-hover', className)}>{children}</section>
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-medium">{children}</h2>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

const fieldClass =
  'w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base outline-none md:text-sm transition-colors placeholder:text-muted/70 focus:border-accent'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldClass, className)} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(fieldClass, 'appearance-none bg-no-repeat pr-8', className)} />
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-soft p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-[40px] rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
            value === o.value ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Progress({ ratio, tone = 'accent', label }: { ratio: number; tone?: 'accent' | 'warn' | 'neg'; label: string }) {
  const color = { accent: 'bg-accent', warn: 'bg-warn', neg: 'bg-neg' }[tone]
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(ratio, 1) * 100)}
      className="h-1.5 overflow-hidden rounded-full bg-soft"
    >
      <div className={cx('anim-grow h-full rounded-full', color)} style={{ width: `${Math.min(Math.max(ratio, 0), 1) * 100}%` }} />
    </div>
  )
}

/** `invert`: a rise is bad news (spending), so it is red and a fall is green. */
export function Delta({ value, format, suffix = '', invert }: { value: number; format: (n: number) => string; suffix?: string; invert?: boolean }) {
  if (Math.abs(value) < 0.5) return <span className="text-xs text-muted">No change{suffix}</span>
  const up = value > 0
  return (
    <span className={cx('num text-xs font-medium', up !== !!invert ? 'text-pos' : 'text-neg')}>
      {up ? '▲' : '▼'} {format(Math.abs(value))}
      {suffix}
    </span>
  )
}

export function EmptyState({ title, text, action, icon }: { title: string; text: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** `dismissOnBackdrop={false}` for forms: a stray tap outside must not throw away what was typed. */
export function Modal({
  title,
  onClose,
  children,
  wide,
  dismissOnBackdrop = true,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  dismissOnBackdrop?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && ref.current) {
        const items = ref.current.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus?.()
    }
  }, [onClose])

  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={dismissOnBackdrop ? onClose : undefined}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(
          'anim-sheet flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-line bg-card shadow-xl sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-3 text-muted hover:bg-soft">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2">{children}</div>
      </div>
    </div>
  )
}

export function AmountInput({ value, onChange, autoFocus }: { value: number; onChange: (n: number) => void; autoFocus?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 rounded-xl border border-line px-4 py-3 focus-within:border-accent">
      <input
        inputMode="numeric"
        aria-label="Amount"
        placeholder="0"
        data-autofocus={autoFocus ? '' : undefined}
        className="num min-w-0 flex-1 bg-transparent text-3xl font-semibold outline-none placeholder:text-muted/50"
        value={value ? value.toLocaleString('en-US') : ''}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '').slice(0, 13)) || 0)}
      />
      <span className="text-lg text-muted">₫</span>
    </div>
  )
}
