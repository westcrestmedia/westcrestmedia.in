const SUPABASE_URL = 'https://arxhryvhmnxkwqwnxoei.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeGhyeXZobW54a3dxd254b2VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDQxNzEsImV4cCI6MjA5NjU4MDE3MX0.0FJtAGOkCflI3ZpGm9ZdfIHWr3GHj_2xqysIMIqXonI'

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Google Login ──
async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://westcrestmedia.in/login.html'
    }
  })
  if (error) showError(error.message)
}

// ── Email Login ──
async function loginWithEmail(email, password) {
  const btn = document.getElementById('email-login-btn')
  const mode = btn.dataset.mode

  if (!email || !password) return showError('Please fill in all fields.')

  btn.disabled = true
  btn.textContent = mode === 'login' ? 'Signing in…' : 'Creating account…'

  let result
  if (mode === 'login') {
    result = await supabase.auth.signInWithPassword({ email, password })
  } else {
    result = await supabase.auth.signUp({ email, password })
  }

  const { data, error } = result
  btn.disabled = false

  if (error) {
    showError(error.message)
    btn.textContent = mode === 'login' ? 'Sign In' : 'Create Account'
    return
  }

  if (mode === 'signup') {
    showError('✅ Check your email to confirm your account!', true)
    btn.textContent = 'Create Account'
    return
  }

  showUserPanel(data.user)
}

// ── Logout ──
async function logout() {
  await supabase.auth.signOut()
  document.getElementById('user-panel').style.display = 'none'
  document.getElementById('auth-box').style.display = 'block'
}

// ── Toggle Login / Signup Mode ──
function toggleMode() {
  const btn = document.getElementById('email-login-btn')
  const toggle = document.getElementById('mode-toggle')
  const title = document.getElementById('form-title')
  const subtitle = document.querySelector('.form-subtitle')

  if (btn.dataset.mode === 'login') {
    btn.dataset.mode = 'signup'
    btn.textContent = 'Create Account'
    title.textContent = 'Create Account'
    subtitle.textContent = 'Join Westcrest Media — free tools for creators'
    toggle.innerHTML = 'Already have an account? <span>Sign in</span>'
  } else {
    btn.dataset.mode = 'login'
    btn.textContent = 'Sign In'
    title.textContent = 'Welcome Back'
    subtitle.textContent = 'Sign in to access your Westcrest Media account'
    toggle.innerHTML = "Don't have an account? <span>Create one free</span>"
  }

  hideError()
}

// ── Show User Panel after login ──
function showUserPanel(user) {
  document.getElementById('auth-box').style.display = 'none'

  const panel = document.getElementById('user-panel')
  panel.style.display = 'flex'

  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Creator'
  document.getElementById('user-name').textContent = name

  const avatarImg = document.getElementById('user-avatar')
  const avatarLetter = document.getElementById('avatar-letter')

  if (user.user_metadata?.avatar_url) {
    avatarImg.src = user.user_metadata.avatar_url
    avatarImg.style.display = 'block'
    avatarLetter.style.display = 'none'
  } else {
    avatarLetter.textContent = name.charAt(0).toUpperCase()
  }
}

// ── Error helper ──
function showError(msg, success = false) {
  const el = document.getElementById('auth-error')
  el.textContent = msg
  el.style.display = 'block'
  el.style.color = success ? '#4caf50' : 'var(--error)'
  el.style.borderColor = success ? 'rgba(76,175,80,0.3)' : 'rgba(224,82,82,0.18)'
  el.style.background = success ? 'rgba(76,175,80,0.07)' : 'rgba(224,82,82,0.07)'
}

function hideError() {
  const el = document.getElementById('auth-error')
  el.style.display = 'none'
}

// ── On page load — check if already logged in ──
window.addEventListener('load', async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    showUserPanel(session.user)
  }
})
