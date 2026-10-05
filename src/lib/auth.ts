import { cloudConfigured, supabase } from './supabase'

/** Chữ thường, bỏ dấu tiếng Việt: "Kiệt Hoàng" → "kiet hoang" (app này không có search.ts như project kia). */
function normalize(raw: string): string {
  return raw.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim()
}

/**
 * Đăng nhập kiểu "tên + PIN 6 số" (app chỉ dùng cho vài người quen).
 * Supabase chỉ có email/password (mật khẩu ≥ 6 ký tự) nên:
 *  - tên → email ảo `<tên>@namnguyen27.app` (không có email nào được gửi; cần tắt "Confirm email")
 *  - PIN 6 số dùng thẳng làm mật khẩu
 * Đổi quy tắc tên → email sẽ làm mọi tài khoản cũ không đăng nhập được.
 */

// Đổi domain = đổi email của mọi tài khoản → tài khoản cũ không đăng nhập được. Phải có đuôi (.app) để qua kiểm tra email của Supabase
const EMAIL_DOMAIN = 'namnguyen27.app'
export const PIN_LENGTH = 6

/** "Kiệt Hoàng" → "kiethoang"; chỉ giữ a-z 0-9 . _ - */
export function normalizeUsername(raw: string): string {
  return normalize(raw).replace(/[^a-z0-9._-]/g, '')
}

export function validateUsername(raw: string): string | null {
  const u = normalizeUsername(raw)
  if (u.length < 3) return 'Tên cần ít nhất 3 ký tự (chữ hoặc số)'
  if (u.length > 24) return 'Tên tối đa 24 ký tự'
  return null
}

export function validatePin(pin: string): string | null {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin) ? null : `Mã PIN gồm đúng ${PIN_LENGTH} chữ số`
}

export const usernameToEmail = (raw: string) => `${normalizeUsername(raw)}@${EMAIL_DOMAIN}`

/** Tên hiển thị của user đang đăng nhập. */
export function displayName(user: { email?: string; user_metadata?: Record<string, unknown> } | null | undefined): string {
  const meta = user?.user_metadata?.username
  if (typeof meta === 'string' && meta) return meta
  return user?.email?.replace(`@${EMAIL_DOMAIN}`, '') ?? ''
}

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Sai tên hoặc mã PIN'
  if (/already registered|already exists/i.test(message)) return 'Tên này đã có người dùng — chọn tên khác hoặc đăng nhập'
  if (/email not confirmed/i.test(message)) return 'Tài khoản chưa kích hoạt. Hãy tắt "Confirm email" trong Supabase rồi tạo lại.'
  if (/rate limit|too many/i.test(message)) return 'Thử quá nhiều lần, đợi vài phút rồi thử lại'
  if (/weak|password should/i.test(message)) return 'Mã PIN quá yếu theo cài đặt Supabase'
  if (/fetch|network/i.test(message)) return 'Mất kết nối mạng'
  return message
}

function check(username: string, pin: string) {
  if (!cloudConfigured) throw new Error('Chưa cấu hình Supabase')
  const err = validateUsername(username) ?? validatePin(pin)
  if (err) throw new Error(err)
}

export async function signInWithPin(username: string, pin: string) {
  check(username, pin)
  const { error } = await supabase!.auth.signInWithPassword({ email: usernameToEmail(username), password: pin })
  if (error) throw new Error(friendly(error.message))
}

export async function signUpWithPin(username: string, pin: string) {
  check(username, pin)
  // Chặn trước: nếu Supabase còn bật "Confirm email" nó sẽ gửi mail tới địa chỉ ảo → mail bị trả về, project có thể bị phạt
  if (!(await isAutoConfirmEnabled())) {
    throw new Error('Supabase đang bật "Confirm email". Tắt nó ở Authentication → Sign In / Providers → Email rồi thử lại.')
  }
  const { data, error } = await supabase!.auth.signUp({
    email: usernameToEmail(username),
    password: pin,
    options: { data: { username: username.trim() } },
  })
  if (error) throw new Error(friendly(error.message))
  if (!data.session) throw new Error('Tạo tài khoản xong nhưng chưa đăng nhập được — thử đăng nhập lại.')
}

async function isAutoConfirmEnabled(): Promise<boolean> {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  const key = (
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  )?.trim()
  if (!url || !key) return false
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    const json = (await res.json()) as { mailer_autoconfirm?: boolean }
    return json.mailer_autoconfirm === true
  } catch {
    return false
  }
}

export async function signOut() {
  await supabase?.auth.signOut()
}
