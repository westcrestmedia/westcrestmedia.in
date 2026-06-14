/**
 * reviews.js — Westcrest Media Tool Reviews
 * ──────────────────────────────────────────
 * Tool page pe inject karo:
 *
 *   <div id="wm-reviews"></div>
 *   <script type="module">
 *     import '/reviews.js'
 *     window.__WM_TOOL__ = { slug: 'background-remover', name: 'Background Remover' }
 *   </script>
 *
 * reviews.js khud supabase se data fetch karega aur #wm-reviews mein inject karega.
 */

import { supabase } from '/auth.js'

const STYLES = `
#wm-reviews {
  max-width: 860px;
  margin: 64px auto 0;
  padding: 0 24px 80px;
  font-family: 'DM Sans', sans-serif;
}

.wm-rev-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 32px;
  padding-bottom: 20px;
  border-bottom: 1px solid #1e1e1e;
}

.wm-rev-title {
  font-family: 'Syne', sans-serif;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #555;
}

.wm-rev-avg {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wm-rev-big-score {
  font-family: 'Syne', sans-serif;
  font-size: 2.4rem;
  font-weight: 700;
  color: #e8e4dc;
  line-height: 1;
}

.wm-rev-stars-wrap { display: flex; flex-direction: column; gap: 4px; }

.wm-stars {
  display: flex;
  gap: 3px;
}

.wm-star {
  font-size: 14px;
  color: #2a2a2a;
  transition: color .15s;
}
.wm-star.filled { color: #C9A84C; }
.wm-star.half {
  position: relative;
  color: #2a2a2a;
}
.wm-star.half::before {
  content: '★';
  position: absolute;
  left: 0;
  width: 50%;
  overflow: hidden;
  color: #C9A84C;
}

.wm-rev-count {
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  color: #555;
}

/* Write review button */
.wm-write-btn {
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #C9A84C;
  background: none;
  border: 1px solid rgba(201,168,76,0.35);
  padding: 8px 18px;
  border-radius: 2px;
  cursor: pointer;
  transition: background .2s;
}
.wm-write-btn:hover { background: rgba(201,168,76,0.08); }

/* Review form */
.wm-rev-form {
  background: #111;
  border: 1px solid #1e1e1e;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 32px;
  display: none;
}
.wm-rev-form.open { display: block; }

.wm-form-label {
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #555;
  margin-bottom: 10px;
  display: block;
}

.wm-star-picker {
  display: flex;
  gap: 6px;
  margin-bottom: 20px;
}
.wm-star-pick {
  font-size: 24px;
  cursor: pointer;
  color: #2a2a2a;
  transition: color .1s, transform .1s;
  background: none;
  border: none;
  padding: 0;
  line-height: 1;
}
.wm-star-pick:hover,
.wm-star-pick.active { color: #C9A84C; transform: scale(1.15); }

.wm-rev-textarea {
  width: 100%;
  background: #0c0c0c;
  border: 1px solid #242424;
  border-radius: 4px;
  color: #e8e4dc;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.85rem;
  padding: 12px 14px;
  resize: vertical;
  min-height: 90px;
  outline: none;
  margin-bottom: 16px;
  transition: border-color .2s;
}
.wm-rev-textarea:focus { border-color: rgba(201,168,76,0.4); }
.wm-rev-textarea::placeholder { color: #333; }

.wm-form-actions { display: flex; gap: 10px; align-items: center; }

.wm-submit-btn {
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: #C9A84C;
  color: #0c0c0c;
  border: none;
  padding: 9px 20px;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 600;
  transition: opacity .2s;
}
.wm-submit-btn:hover { opacity: 0.85; }
.wm-submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.wm-cancel-btn {
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #555;
  background: none;
  border: none;
  cursor: pointer;
  padding: 9px 12px;
}
.wm-cancel-btn:hover { color: #999; }

.wm-form-msg {
  font-size: 0.75rem;
  margin-left: auto;
}
.wm-form-msg.error { color: #e05252; }
.wm-form-msg.success { color: #4caf50; }

/* Reviews list */
.wm-rev-list { display: flex; flex-direction: column; gap: 16px; }

.wm-rev-card {
  background: #111;
  border: 1px solid #1e1e1e;
  border-radius: 8px;
  padding: 20px 22px;
  transition: border-color .2s;
}
.wm-rev-card:hover { border-color: #2a2a2a; }

.wm-rev-card-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.wm-rev-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: rgba(201,168,76,0.12);
  border: 1px solid rgba(201,168,76,0.2);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Syne', sans-serif;
  font-size: 13px; font-weight: 700;
  color: #C9A84C;
  overflow: hidden; flex-shrink: 0;
}
.wm-rev-avatar img { width: 100%; height: 100%; object-fit: cover; }

.wm-rev-meta { flex: 1; }
.wm-rev-user-name {
  font-size: 0.82rem;
  font-weight: 500;
  color: #e8e4dc;
  margin-bottom: 3px;
}
.wm-rev-date {
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem;
  color: #555;
}

.wm-rev-comment {
  font-size: 0.85rem;
  color: #999;
  line-height: 1.65;
  margin-top: 4px;
}

/* Empty */
.wm-rev-empty {
  text-align: center;
  padding: 40px 24px;
  border: 1px dashed #222;
  border-radius: 8px;
}
.wm-rev-empty-icon { font-size: 1.8rem; opacity: 0.3; margin-bottom: 10px; }
.wm-rev-empty-text { font-size: 0.8rem; color: #555; }

/* Sign in prompt */
.wm-signin-prompt {
  text-align: center;
  padding: 16px;
  background: #111;
  border: 1px solid #1e1e1e;
  border-radius: 6px;
  margin-bottom: 28px;
  font-size: 0.8rem;
  color: #555;
}
.wm-signin-prompt a {
  color: #C9A84C;
  text-decoration: none;
}
.wm-signin-prompt a:hover { text-decoration: underline; }

@media (max-width: 600px) {
  #wm-reviews { padding: 0 16px 60px; margin-top: 48px; }
  .wm-rev-header { flex-direction: column; align-items: flex-start; }
}
`

// ── Helpers ────────────────────────────────────────────────────────────────────

function starsHTML(rating, size = 14) {
  let html = '<div class="wm-stars">'
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      html += '<span class="wm-star filled" style="font-size:' + size + 'px">★</span>'
    } else if (rating >= i - 0.5) {
      html += '<span class="wm-star half" style="font-size:' + size + 'px">★</span>'
    } else {
      html += '<span class="wm-star" style="font-size:' + size + 'px">★</span>'
    }
  }
  return html + '</div>'
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return m + 'm ago'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'h ago'
  const d = Math.floor(h / 24)
  if (d < 30) return d + 'd ago'
  return Math.floor(d / 30) + 'mo ago'
}

// ── Main render ────────────────────────────────────────────────────────────────

async function initReviews() {
  const container = document.getElementById('wm-reviews')
  if (!container) return

  const tool = window.__WM_TOOL__ || {}
  if (!tool.slug) return

  // Inject styles
  if (!document.getElementById('wm-reviews-css')) {
    const style = document.createElement('style')
    style.id = 'wm-reviews-css'
    style.textContent = STYLES
    document.head.appendChild(style)
  }

  // Get session
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  // Fetch reviews
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .eq('tool_slug', tool.slug)
    .eq('is_approved', true)
    .order('created_at', { ascending: false })

  const list = reviews || []
  const avg = list.length ? (list.reduce((s, r) => s + r.rating, 0) / list.length) : 0
  const count = list.length

  // Check if user already reviewed
  // User ka apna review (approved na ho tab bhi dikhao form mein)
  let userReview = user ? list.find(r => r.user_id === user.id) : null
  if (user && !userReview) {
    const { data: myReview } = await supabase
      .from('reviews').select('*')
      .eq('user_id', user.id).eq('tool_slug', tool.slug).maybeSingle()
    userReview = myReview || null
  }

  // Build HTML
  let html = '<div class="wm-rev-header">'
  html += '<div class="wm-rev-title">Reviews — ' + (tool.name || 'This Tool') + '</div>'

  if (count > 0) {
    html += '<div class="wm-rev-avg">'
    html += '<div class="wm-rev-big-score">' + avg.toFixed(1) + '</div>'
    html += '<div class="wm-rev-stars-wrap">' + starsHTML(avg, 16) + '<div class="wm-rev-count">' + count + ' review' + (count !== 1 ? 's' : '') + '</div></div>'
    html += '</div>'
  }

  // Write review button
  if (user && !userReview) {
    html += '<button class="wm-write-btn" id="wm-open-form">Write a Review</button>'
  } else if (!user) {
    html += '<button class="wm-write-btn" id="wm-open-form">Write a Review</button>'
  } else if (userReview) {
    html += '<button class="wm-write-btn" id="wm-open-form">Edit Your Review</button>'
  }

  html += '</div>' // end header

  // Sign in prompt
  if (!user) {
    html += '<div class="wm-signin-prompt">Sign in to leave a review — <a href="/login/?next=' + encodeURIComponent(window.location.pathname) + '">Sign In</a></div>'
  }

  // Form (hidden by default)
  const existingRating = userReview?.rating || 0
  const existingComment = userReview?.comment || ''
  html += '<div class="wm-rev-form" id="wm-rev-form">'
  html += '<label class="wm-form-label">Your Rating</label>'
  html += '<div class="wm-star-picker" id="wm-star-picker">'
  for (let i = 1; i <= 5; i++) {
    html += '<button class="wm-star-pick' + (existingRating >= i ? ' active' : '') + '" data-val="' + i + '">★</button>'
  }
  html += '</div>'
  html += '<label class="wm-form-label">Your Review (optional)</label>'
  html += '<textarea class="wm-rev-textarea" id="wm-rev-text" placeholder="What did you think of this tool?">' + existingComment + '</textarea>'
  html += '<div class="wm-form-actions">'
  html += '<button class="wm-submit-btn" id="wm-submit-btn">Submit Review</button>'
  html += '<button class="wm-cancel-btn" id="wm-cancel-btn">Cancel</button>'
  html += '<span class="wm-form-msg" id="wm-form-msg"></span>'
  html += '</div></div>'

  // Reviews list
  if (count === 0) {
    html += '<div class="wm-rev-empty"><div class="wm-rev-empty-icon">⭐</div><div class="wm-rev-empty-text">No reviews yet — be the first!</div></div>'
  } else {
    html += '<div class="wm-rev-list">'
    list.forEach(function(r) {
      const initial = r.user_name ? r.user_name.charAt(0).toUpperCase() : '?'
      const avatarInner = r.user_avatar
        ? '<img src="' + r.user_avatar + '" alt="' + r.user_name + '" />'
        : initial
      html += '<div class="wm-rev-card">'
      html += '<div class="wm-rev-card-top">'
      html += '<div class="wm-rev-avatar">' + avatarInner + '</div>'
      html += '<div class="wm-rev-meta">'
      html += '<div class="wm-rev-user-name">' + r.user_name + '</div>'
      html += starsHTML(r.rating, 12)
      html += '</div>'
      html += '<div class="wm-rev-date">' + timeAgo(r.created_at) + '</div>'
      html += '</div>'
      if (r.review_text) {
        html += '<div class="wm-rev-comment">' + r.review_text.replace(/</g, '&lt;') + '</div>'
      }
      html += '</div>'
    })
    html += '</div>'
  }

  container.innerHTML = html

  // ── Interactions ────────────────────────────────────────────────────────────
  let selectedRating = existingRating

  // Open form
  const openBtn = document.getElementById('wm-open-form')
  const form    = document.getElementById('wm-rev-form')
  if (openBtn && form) {
    openBtn.addEventListener('click', function() {
      if (!user) {
        window.location.href = '/login/?next=' + encodeURIComponent(window.location.pathname)
        return
      }
      form.classList.toggle('open')
    })
  }

  // Cancel
  const cancelBtn = document.getElementById('wm-cancel-btn')
  if (cancelBtn && form) {
    cancelBtn.addEventListener('click', function() { form.classList.remove('open') })
  }

  // Star picker
  const picks = document.querySelectorAll('.wm-star-pick')
  picks.forEach(function(btn) {
    btn.addEventListener('mouseover', function() {
      const val = parseInt(btn.dataset.val)
      picks.forEach(function(b) { b.classList.toggle('active', parseInt(b.dataset.val) <= val) })
    })
    btn.addEventListener('mouseout', function() {
      picks.forEach(function(b) { b.classList.toggle('active', parseInt(b.dataset.val) <= selectedRating) })
    })
    btn.addEventListener('click', function() {
      selectedRating = parseInt(btn.dataset.val)
      picks.forEach(function(b) { b.classList.toggle('active', parseInt(b.dataset.val) <= selectedRating) })
    })
  })

  // Submit
  const submitBtn = document.getElementById('wm-submit-btn')
  const msgEl     = document.getElementById('wm-form-msg')
  const textarea  = document.getElementById('wm-rev-text')

  if (submitBtn) {
    submitBtn.addEventListener('click', async function() {
      if (!selectedRating) {
        msgEl.textContent = 'Please select a rating.'
        msgEl.className = 'wm-form-msg error'
        return
      }
      submitBtn.disabled = true
      submitBtn.textContent = 'Submitting...'
      msgEl.textContent = ''

      const reviewData = {
        user_id:     user.id,
        user_name:   user.user_metadata?.full_name || user.email?.split('@')[0] || 'Creator',
        user_avatar: user.user_metadata?.avatar_url || null,
        tool_slug:   tool.slug,
        tool_name:   tool.name || '',
        rating:      selectedRating,
        review_text: textarea.value.trim() || null
      }

      const { error } = await supabase
        .from('reviews')
        .upsert(reviewData, { onConflict: 'user_id,tool_slug' })

      if (error) {
        msgEl.textContent = 'Something went wrong. Try again.'
        msgEl.className = 'wm-form-msg error'
        submitBtn.disabled = false
        submitBtn.textContent = 'Submit Review'
      } else {
        msgEl.textContent = '✓ Review submitted!'
        msgEl.className = 'wm-form-msg success'
        setTimeout(function() { initReviews() }, 800)
      }
    })
  }
}

initReviews()
