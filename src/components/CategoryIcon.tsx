import { ArrowLeftRight, Car, CirclePlus, Clapperboard, Coffee, Dumbbell, Ellipsis, GraduationCap, Gift, HeartPulse, Home, PartyPopper, Plane, Repeat, Shirt, ShoppingBag, ShoppingBasket, TrendingUp, Users, Utensils, Wallet, type LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Category } from '../types'

const icons: Record<string, LucideIcon> = { Home, Utensils, Coffee, ShoppingBasket, Shirt, Dumbbell, PartyPopper, Car, ShoppingBag, Clapperboard, HeartPulse, Plane, Repeat, Users, GraduationCap, Ellipsis, Wallet, Gift, TrendingUp, CirclePlus }

export default function CategoryIcon({ category, transfer, size = 16 }: { category?: Category; transfer?: boolean; size?: number }) {
  const Icon = transfer ? ArrowLeftRight : (category && icons[category.icon]) || Ellipsis
  const color = transfer ? '#71717a' : (category?.color ?? '#71717a')
  return (
    <span
      className="cat-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      style={{ '--cat': color } as CSSProperties}
      aria-hidden="true"
    >
      <Icon size={size} />
    </span>
  )
}
