/**
 * tool-reviews.js — Tool Page Review Section
 */

import { supabase } from '/assets/js/auth.js'

const GOLD        = '#C9A84C'
const GOLD_DIM    = 'rgba(200,169,110,0.15)'
const GOLD_BORDER = 'rgba(200,169,110,0.22)'
const DARK        = '#0a0a0f'
const CARD_BG     = 'rgba(255,255,255,0.03)'
const MUTED       = 'rgba(245,240,232,0.45)'
const TEXT        = '#f5f0e8'

/* ─── HELPERS ─────────────────────────────────────────── */

function stars(rating, interactive = false, selected = 0) {
  return [1,2,3,4,5].map(i => {
    const filled = interactive ? i <= selected : i <= rating
    const style = `font-size:1.3rem;cursor:${interactive ? 'pointer' : 'default'};color:${filled ? GOLD : 'rgba(200,169,110,0.25)'};transition:color .15s;line-height:1;`
    const attr  = interactive ? `data-star="${i}"` : ''
    return `<span class="wm-star" ${attr} style="${style}">★</span>`
  }).join('')
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  return `${mo}mo ago`
}

function avg(reviews) {
  if (!reviews.length) return 0
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

/* ─── RENDER ──────────────────────────────────────────── */

async function init() {
  const root = document.getElementById('wm-reviews-root')
  if (!root) return

  const tool = window.__WM_TOOL__ || {}
  if (!tool.slug) return

  injectCSS()

  // Session + approved reviews fetch karo
  const [{ data: { session } }, { data: reviews }] = await Promise.all([
    supabase.auth.getSession(),
    supabase
      .from('reviews')
      .select('*')
      .eq('tool_slug', tool.slug)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
  ])

  const user    = session?.user ?? null
  const list    = reviews || []
  const average = avg(list)
  const total   = list.length

  // Check karo user ka koi PENDING review hai is tool pe
  let hasPendingReview = false
  if (user) {
    const { data: pendingData } = await supabase
      .from('reviews')
      .select('id')
      .eq('tool_slug', tool.slug)
      .eq('user_id', user.id)
      .eq('is_approved', false)
      .limit(1)
    hasPendingReview = !!(pendingData && pendingData.length > 0)
  }

  root.innerHTML = buildSection(tool, list, average, total, user, hasPendingReview)
  bindEvents(tool, user)
}

function buildSection(tool, list, average, total, user, hasPendingReview) {
  const ratingBar   = buildRatingBar(list, average, total)
  const formBlock   = buildForm(user, hasPendingReview)
  const reviewCards = list.length
    ? list.map(r => buildCard(r)).join('')
    : `<div style="text-align:center;padding:2rem;color:${MUTED};font-family:'DM Mono',monospace;font-size:0.75rem;letter-spacing:0.1em;">No reviews yet. Be the first!</div>`

  return `
<section class="wm-reviews-section">
  <div class="wm-reviews-inner">

    <!-- Header -->
    <div class="wm-reviews-header">
      <div>
        <div class="wm-reviews-eyebrow">User Reviews</div>
        <h2 class="wm-reviews-title">${escHtml(tool.name)}</h2>
      </div>
      ${total > 0 ? `
      <div class="wm-reviews-avg">
        <div class="wm-avg-number">${average.toFixed(1)}</div>
        <div class="wm-avg-stars">${stars(Math.round(average))}</div>
        <div class="wm-avg-count">${total} review${total !== 1 ? 's' : ''}</div>
      </div>` : ''}
    </div>

    <div class="wm-reviews-body">

      <!-- Left: Rating breakdown + Form -->
      <div class="wm-reviews-left">
        ${total > 0 ? ratingBar : ''}
        ${formBlock}
      </div>

      <!-- Right: Review cards -->
      <div class="wm-reviews-right">
        ${reviewCards}
      </div>

    </div>
  </div>
</section>`
}

function buildRatingBar(list, average, total) {
  const counts = [5,4,3,2,1].map(n => ({
    n,
    count: list.filter(r => r.rating === n).length
  }))

  const bars = counts.map(({ n, count }) => {
    const pct = total ? Math.round((count / total) * 100) : 0
    return `
    <div class="wm-bar-row">
      <span class="wm-bar-label">${n}★</span>
      <div class="wm-bar-track">
        <div class="wm-bar-fill" style="width:${pct}%"></div>
      </div>
      <span class="wm-bar-count">${count}</span>
    </div>`
  }).join('')

  return `<div class="wm-rating-bars">${bars}</div>`
}

function buildForm(user, hasPendingReview) {
  // Not logged in
  if (!user) {
    return `
    <div class="wm-form-card wm-login-prompt">
      <div style="font-size:1.5rem;margin-bottom:0.5rem;">✍️</div>
      <div style="color:${TEXT};font-size:0.85rem;margin-bottom:0.75rem;">Share your experience</div>
      <a href="/login/?next=${encodeURIComponent(window.location.pathname)}"
         class="wm-submit-btn">Sign In to Review</a>
    </div>`
  }

  // Pending review hai — form band rakho
  if (hasPendingReview) {
    return `
    <div class="wm-form-card" style="text-align:center;">
      <div style="font-size:1.5rem;margin-bottom:0.5rem;">⏳</div>
      <div style="color:${TEXT};font-size:0.85rem;">Your review is pending approval.</div>
      <div style="color:${MUTED};font-size:0.75rem;margin-top:0.4rem;">Once approved, you can leave another review anytime.</div>
      <a href="/dashboard/" style="display:inline-block;margin-top:1rem;font-family:'DM Mono',monospace;font-size:0.6rem;letter-spacing:0.1em;color:${GOLD};text-decoration:none;">View in Dashboard →</a>
    </div>`
  }

  // Fresh form — no edit mode ab
  return `
  <div class="wm-form-card">
    <div class="wm-form-title">Write a Review</div>

    <div class="wm-star-input" id="wm-star-input">
      ${stars(0, true, 0)}
    </div>
    <div class="wm-star-hint" id="wm-star-hint">Tap to rate</div>
    <input type="hidden" id="wm-rating-val" value="0">

    <textarea id="wm-review-text" class="wm-textarea"
      placeholder="Tell others what you think about this tool…"
      maxlength="500"></textarea>
    <div class="wm-char-count"><span id="wm-char-num">0</span>/500</div>

    <button class="wm-submit-btn" id="wm-submit-btn">Submit Review</button>
    <div id="wm-form-msg" class="wm-form-msg"></div>
  </div>`
}

function buildCard(r) {
  const initials = (r.user_name || 'U').charAt(0).toUpperCase()
  const avatarEl = r.user_avatar
    ? `<img src="${escHtml(r.user_avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : `<span style="font-weight:700;font-size:13px;color:${GOLD};">${initials}</span>`

  return `
  <div class="wm-review-card">
    <div class="wm-card-top">
      <div class="wm-card-avatar">${avatarEl}</div>
      <div class="wm-card-meta">
        <div class="wm-card-name">${escHtml(r.user_name || 'Anonymous')}</div>
        <div class="wm-card-time">${timeAgo(r.created_at)}</div>
      </div>
      <div class="wm-card-stars">${stars(r.rating)}</div>
    </div>
    ${r.review_text ? `<div class="wm-card-text">${escHtml(r.review_text)}</div>` : ''}
  </div>`
}

function starLabel(n) {
  return ['','Terrible','Poor','Okay','Good','Excellent'][n] || ''
}

/* ─── EVENTS ──────────────────────────────────────────── */

function bindEvents(tool, user) {
  // Star interaction
  const starInput = document.getElementById('wm-star-input')
  const ratingVal = document.getElementById('wm-rating-val')
  const starHint  = document.getElementById('wm-star-hint')

  if (starInput) {
    let currentRating = 0

    starInput.addEventListener('mouseover', e => {
      const s = e.target.closest('.wm-star')
      if (!s) return
      const n = parseInt(s.dataset.star)
      renderStarInput(starInput, n)
      if (starHint) starHint.textContent = starLabel(n)
    })

    starInput.addEventListener('mouseleave', () => {
      renderStarInput(starInput, currentRating)
      if (starHint) starHint.textContent = currentRating ? starLabel(currentRating) : 'Tap to rate'
    })

    starInput.addEventListener('click', e => {
      const s = e.target.closest('.wm-star')
      if (!s) return
      currentRating = parseInt(s.dataset.star)
      if (ratingVal) ratingVal.value = currentRating
      renderStarInput(starInput, currentRating)
      if (starHint) starHint.textContent = starLabel(currentRating)
    })
  }

  // Char count
  const textarea = document.getElementById('wm-review-text')
  const charNum  = document.getElementById('wm-char-num')
  if (textarea && charNum) {
    textarea.addEventListener('input', () => {
      charNum.textContent = textarea.value.length
    })
  }

  // Submit — HAMESHA INSERT, kabhi UPDATE nahi
  const submitBtn = document.getElementById('wm-submit-btn')
  const formMsg   = document.getElementById('wm-form-msg')

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const rating = parseInt(document.getElementById('wm-rating-val')?.value || '0')
      const text   = document.getElementById('wm-review-text')?.value.trim() || ''

      if (!rating) {
        showMsg(formMsg, 'Please select a star rating.', 'error')
        return
      }

      submitBtn.disabled = true
      submitBtn.textContent = 'Submitting…'

      const { data: { session } } = await supabase.auth.getSession()
      const u = session?.user
      if (!u) { showMsg(formMsg, 'Please sign in first.', 'error'); return }

      // Hamesha naya INSERT — is_approved: false
      const payload = {
        tool_slug:   tool.slug,
        tool_name:   tool.name,
        rating,
        review_text: text,
        user_name:   u.user_metadata?.full_name || u.email?.split('@')[0] || 'Anonymous',
        user_avatar: u.user_metadata?.avatar_url || null,
        user_id:     u.id,
        is_approved: false,   // ← hamesha false, tumhare approval ke baad show hoga
      }

      const { error } = await supabase.from('reviews').insert(payload)

      if (error) {
        showMsg(formMsg, 'Something went wrong. Try again.', 'error')
        submitBtn.disabled = false
        submitBtn.textContent = 'Submit Review'
      } else {
        showMsg(formMsg, '✓ Review submitted! It will appear after approval.', 'success')
        submitBtn.disabled = true
        submitBtn.textContent = 'Submitted ✓'
        // Form hide karo, pending message dikhao
        setTimeout(() => {
          const formCard = submitBtn.closest('.wm-form-card')
          if (formCard) {
            formCard.innerHTML = `
              <div style="text-align:center;">
                <div style="font-size:1.5rem;margin-bottom:0.5rem;">⏳</div>
                <div style="color:${TEXT};font-size:0.85rem;">Your review is pending approval.</div>
                <div style="color:${MUTED};font-size:0.75rem;margin-top:0.4rem;">Once approved, you can leave another review anytime.</div>
                <a href="/dashboard/" style="display:inline-block;margin-top:1rem;font-family:'DM Mono',monospace;font-size:0.6rem;letter-spacing:0.1em;color:${GOLD};text-decoration:none;">View in Dashboard →</a>
              </div>`
          }
        }, 2000)
      }
    })
  }
}

function renderStarInput(container, selected) {
  container.querySelectorAll('.wm-star').forEach(el => {
    const n = parseInt(el.dataset.star)
    el.style.color = n <= selected ? GOLD : 'rgba(200,169,110,0.25)'
  })
}

function showMsg(el, msg, type) {
  if (!el) return
  el.textContent = msg
  el.style.color = type === 'error' ? '#e05555' : '#6fcf97'
  el.style.display = 'block'
}

/* ─── CSS ─────────────────────────────────────────────── */

function injectCSS() {
  if (document.getElementById('wm-reviews-css')) return
  const s = document.createElement('style')
  s.id = 'wm-reviews-css'
  s.textContent = `
.wm-reviews-section {
  border-top: 1px solid ${GOLD_BORDER};
  padding: 4rem 1.5rem 5rem;
  background: ${DARK};
}
.wm-reviews-inner {
  max-width: 1100px;
  margin: 0 auto;
}
.wm-reviews-eyebrow {
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${GOLD};
  margin-bottom: 0.4rem;
}
.wm-reviews-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  font-weight: 300;
  color: ${TEXT};
  margin: 0;
}
.wm-reviews-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 2.5rem;
  gap: 1rem;
  flex-wrap: wrap;
}
.wm-reviews-avg { text-align: center; }
.wm-avg-number {
  font-family: 'Cormorant Garamond', serif;
  font-size: 3rem;
  font-weight: 300;
  color: ${TEXT};
  line-height: 1;
}
.wm-avg-stars { margin: 0.3rem 0; }
.wm-avg-count {
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: ${MUTED};
}
.wm-reviews-body {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 2.5rem;
  align-items: start;
}
.wm-rating-bars { margin-bottom: 1.5rem; }
.wm-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.wm-bar-label {
  font-family: 'DM Mono', monospace;
  font-size: 0.65rem;
  color: ${MUTED};
  width: 20px;
  text-align: right;
  flex-shrink: 0;
}
.wm-bar-track {
  flex: 1;
  height: 5px;
  background: rgba(255,255,255,0.07);
  border-radius: 99px;
  overflow: hidden;
}
.wm-bar-fill {
  height: 100%;
  background: ${GOLD};
  border-radius: 99px;
  transition: width 0.4s ease;
}
.wm-bar-count {
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  color: ${MUTED};
  width: 16px;
  flex-shrink: 0;
}
.wm-form-card {
  background: ${CARD_BG};
  border: 1px solid ${GOLD_BORDER};
  border-radius: 10px;
  padding: 1.5rem;
}
.wm-login-prompt { text-align: center; }
.wm-form-title {
  font-family: 'Syne', sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  color: ${TEXT};
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
}
.wm-star-input {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}
.wm-star-hint {
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: ${MUTED};
  margin-bottom: 1rem;
  min-height: 1em;
}
.wm-textarea {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  padding: 10px 12px;
  color: ${TEXT};
  font-family: 'Syne', sans-serif;
  font-size: 0.82rem;
  line-height: 1.5;
  resize: vertical;
  min-height: 90px;
  outline: none;
  transition: border-color .2s;
  box-sizing: border-box;
}
.wm-textarea:focus { border-color: ${GOLD}; }
.wm-textarea::placeholder { color: rgba(245,240,232,0.25); }
.wm-char-count {
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem;
  color: ${MUTED};
  text-align: right;
  margin: 4px 0 1rem;
}
.wm-submit-btn {
  display: inline-block;
  width: 100%;
  text-align: center;
  padding: 10px 20px;
  background: transparent;
  border: 1px solid rgba(200,169,110,0.5);
  border-radius: 3px;
  color: ${GOLD};
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  cursor: pointer;
  text-decoration: none;
  transition: background .2s;
}
.wm-submit-btn:hover { background: ${GOLD_DIM}; }
.wm-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.wm-form-msg {
  display: none;
  font-family: 'DM Mono', monospace;
  font-size: 0.65rem;
  margin-top: 0.75rem;
  text-align: center;
}
.wm-reviews-right {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.wm-review-card {
  background: ${CARD_BG};
  border: 1px solid ${GOLD_BORDER};
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  transition: border-color .2s;
}
.wm-review-card:hover { border-color: rgba(200,169,110,0.4); }
.wm-card-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 0.75rem;
}
.wm-card-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1.5px solid ${GOLD_BORDER};
  background: rgba(200,169,110,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.wm-card-meta { flex: 1; min-width: 0; }
.wm-card-name {
  font-family: 'Syne', sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  color: ${TEXT};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wm-card-time {
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem;
  color: ${MUTED};
  margin-top: 2px;
}
.wm-card-stars { flex-shrink: 0; }
.wm-card-text {
  font-family: 'Syne', sans-serif;
  font-size: 0.82rem;
  color: rgba(245,240,232,0.75);
  line-height: 1.6;
}
@media (max-width: 768px) {
  .wm-reviews-body { grid-template-columns: 1fr; }
  .wm-reviews-section { padding: 3rem 1rem 4rem; }
}
  `
  document.head.appendChild(s)
}

init()