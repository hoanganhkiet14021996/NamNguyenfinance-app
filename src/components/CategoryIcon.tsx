import { ArrowLeftRight, Car, CirclePlus, Clapperboard, Ellipsis, GraduationCap, Gift, HeartPulse, Home, Plane, Repeat, ShoppingBag, TrendingUp, Users, Utensils, Wallet, type LucideIcon } from 'lucide-react'
import type { Category } from '../types'

const icons: Record<string, LucideIcon> = { Home, Utensils, Car, ShoppingBag, Clapperboard, HeartPulse, Plane, Repeat, Users, GraduationCap, Ellipsis, Wallet, Gift, TrendingUp, CirclePlus }

export default function CategoryIcon({ category, transfer, size = 16 }: { category?: Category; transfer?: boolean; size?: number }) {
  const Icon = transfer ? ArrowLeftRight : (category && icons[category.icon]) || Ellipsis
  const color = transfer ? '#71717a' : (category?.color ?? '#71717a')
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      style={{ background: `${color}1f`, color }}
      aria-hidden="true"
    >
      <Icon size={size} />
    </span>
  )
}
