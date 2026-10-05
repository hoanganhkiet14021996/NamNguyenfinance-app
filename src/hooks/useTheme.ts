import { useEffect } from 'react'
import { useStore } from '../store/AppStore'

export function useApplyAppearance() {
  const { theme, density } = useStore().data.settings

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#071315' : '#f3f7f7')
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.density = density
  }, [density])
}
