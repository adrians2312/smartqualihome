/* QUALIHOME — Main JavaScript */

// ── Toast duration ───────────────────────────────────────────────
var SQH_TOAST_DURATION = 4500;

// ── Dismiss a toast element ──────────────────────────────────────
function dismissToast(toast) {
  if (toast.dataset.sqhDismissed) return;
  toast.dataset.sqhDismissed = '1';
  toast.classList.remove('sqh-toast--visible');
  toast.classList.add('sqh-toast--hiding');
  setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
}

// ── Programmatic toast (usable from any page script) ────────────
function showToast(message, type, title) {
  type = type || 'danger';
  var container = document.getElementById('sqh-toast-container');
  if (!container) return;

  var icons  = { success: 'fa-check-circle', danger: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  var titles = { success: 'Success', danger: 'Error', warning: 'Warning', info: 'Notice' };
  var t = title || titles[type] || 'Notice';

  var toast = document.createElement('div');
  toast.className = 'sqh-toast sqh-toast--' + type;
  toast.setAttribute('role', 'alert');
  toast.innerHTML =
    '<div class="sqh-toast-icon"><i class="fas ' + (icons[type] || 'fa-info-circle') + '"></i></div>' +
    '<div class="sqh-toast-body">' +
      '<div class="sqh-toast-title">' + t + '</div>' +
      '<div class="sqh-toast-msg">' + message + '</div>' +
    '</div>' +
    '<button class="sqh-toast-close" aria-label="Close"><i class="fas fa-times"></i></button>' +
    '<div class="sqh-toast-progress"><div class="sqh-toast-progress-fill"></div></div>';

  container.appendChild(toast);

  // Slide in
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { toast.classList.add('sqh-toast--visible'); });
  });

  // Progress bar
  var fill = toast.querySelector('.sqh-toast-progress-fill');
  if (fill) {
    fill.style.transition = 'none';
    fill.style.width = '100%';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        fill.style.transition = 'width ' + SQH_TOAST_DURATION + 'ms linear';
        fill.style.width = '0%';
      });
    });
  }

  var timer = setTimeout(function () { dismissToast(toast); }, SQH_TOAST_DURATION);
  var closeBtn = toast.querySelector('.sqh-toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      clearTimeout(timer);
      dismissToast(toast);
    });
  }
}

// ── Image source resolution (Cloudinary-aware) ──────────────────
// Absolute URLs (Cloudinary) are used directly; legacy local
// filenames are served through /uploads/.
function sqhImgSrc(ref) {
  ref = String(ref == null ? '' : ref).trim();
  if (/^https?:\/\//i.test(ref)) return ref;
  return '/uploads/' + encodeURIComponent(ref);
}

// ── Numeric input formatting (thousands separators) ──────────────
function sqhCleanNumeric(str) {
  return String(str == null ? '' : str).replace(/[,\s\u20B1]/g, '');
}

function sqhFormatNumericValue(raw) {
  var s = String(raw == null ? '' : raw);
  var negative = s.charAt(0) === '-';
  s = s.replace(/[^\d.]/g, '');
  var firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
  if (!s || s === '.') return negative ? '-' : '';
  var parts = s.split('.');
  parts[0] = parts[0].replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (negative ? '-' : '') + parts.join('.');
}

function sqhBindNumericFormatting(root) {
  (root || document).querySelectorAll('input[data-commas]').forEach(function (el) {
    // WTForms DecimalField renders type="number" by default; commas are
    // invalid in number inputs so the browser blanks "1,000" on the 4th
    // digit. Force text BEFORE binding (and on re-bind) so formatting sticks.
    try { el.setAttribute('type', 'text'); } catch (_) {}
    try { if (el.type !== 'text') el.type = 'text'; } catch (_) {}
    if (el.dataset.sqhCommasBound) return;
    el.dataset.sqhCommasBound = '1';
    el.setAttribute('inputmode', 'decimal');
    el.addEventListener('input', function () {
      var tailLen = null;
      if (typeof el.selectionStart === 'number') {
        tailLen = el.value.length - el.selectionStart;
      }
      var formatted = sqhFormatNumericValue(el.value);
      if (formatted !== el.value) {
        el.value = formatted;
        if (tailLen !== null) {
          var pos = Math.max(0, el.value.length - tailLen);
          try { el.setSelectionRange(pos, pos); } catch (_) {}
        }
      }
    });
  });
}

// ── ZoomDragController (shared by all gallery-style modals) ──
// Verbatim copy of the controller defined in app/templates/index.html.
// Defined on window so dashboard bundles can reuse it instead of
// duplicating zoom/drag state. Guarded to avoid clobbering the inline
// definition on the landing page.
window.ZoomDragController = window.ZoomDragController || class ZoomDragController {
  constructor({ frame, wrapper, img, zoomIn, zoomOut, reset }) {
    this.frame   = frame;
    this.wrapper = wrapper;
    this.img     = img;
    this.zoomIn  = zoomIn;
    this.zoomOut = zoomOut;
    this.reset   = reset;
    this.scale      = 1;
    this.panX       = 0;
    this.panY       = 0;
    this.dragging   = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this._bindButtons();
    this._bindPointer();
    this._bindWheel();
    if (this.img) this.img.addEventListener('load', () => this.resetZoom());
    window.addEventListener('resize', () => { this._clamp(); this._apply(); });
  }
  _clamp() {
    if (!this.frame || !this.img) return;
    if (this.scale <= 1.0001) { this.panX = 0; this.panY = 0; return; }
    const fw = this.frame.clientWidth;
    const fh = this.frame.clientHeight;
    const sw = this.img.offsetWidth * this.scale;
    const sh = this.img.offsetHeight * this.scale;
    const maxX = Math.max(0, (sw - fw) / 2);
    const maxY = Math.max(0, (sh - fh) / 2);
    this.panX = Math.max(-maxX, Math.min(maxX, this.panX));
    this.panY = Math.max(-maxY, Math.min(maxY, this.panY));
  }
  _apply() {
    if (!this.wrapper) return;
    this.wrapper.style.transform = 'translate(' + this.panX + 'px,' + this.panY + 'px) scale(' + this.scale + ')';
    this.wrapper.style.transformOrigin = 'center center';
    this.wrapper.classList.toggle('is-dragging', this.dragging);
    if (this.reset) this.reset.textContent = Math.round(this.scale * 100) + '%';
  }
  setZoom(next) {
    this.scale = Math.max(1, Math.min(4, next));
    this._clamp();
    this._apply();
  }
  resetZoom() {
    this.scale = 1; this.panX = 0; this.panY = 0; this.dragging = false;
    this._apply();
  }
  startDrag(cx, cy) {
    this.dragging   = true;
    this.dragStartX = cx - this.panX;
    this.dragStartY = cy - this.panY;
    this._apply();
  }
  moveDrag(cx, cy) {
    if (!this.dragging) return;
    this.panX = cx - this.dragStartX;
    this.panY = cy - this.dragStartY;
    this._clamp();
    this._apply();
  }
  endDrag() {
    if (!this.dragging) return;
    this.dragging = false;
    this._apply();
  }
  _bindButtons() {
    if (this.zoomIn)  this.zoomIn.addEventListener('click', () => this.setZoom(this.scale + 0.25));
    if (this.zoomOut) this.zoomOut.addEventListener('click', () => this.setZoom(this.scale - 0.25));
    if (this.reset)   this.reset.addEventListener('click', () => this.resetZoom());
  }
  _bindPointer() {
    let pinchStartDist  = 0;
    let pinchStartScale = 1;
    let pinchMidX       = 0;
    let pinchMidY       = 0;
    let pinchStartPanX  = 0;
    let pinchStartPanY  = 0;
    let isPinching      = false;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
    if (this.wrapper) {
      this.wrapper.addEventListener('touchstart', e => {
        if (e.touches.length === 2) {
          isPinching      = true;
          this.dragging   = false;
          pinchStartDist  = dist(e.touches);
          pinchStartScale = this.scale;
          pinchStartPanX  = this.panX;
          pinchStartPanY  = this.panY;
          const rect = this.wrapper.getBoundingClientRect();
          const m    = mid(e.touches);
          pinchMidX  = m.x - rect.left - rect.width / 2;
          pinchMidY  = m.y - rect.top - rect.height / 2;
        } else if (e.touches.length === 1 && !isPinching) {
          this.startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: true });
      this.wrapper.addEventListener('mousedown', e => {
        e.preventDefault();
        this.startDrag(e.clientX, e.clientY);
      });
    }
    window.addEventListener('mousemove', e => this.moveDrag(e.clientX, e.clientY));
    window.addEventListener('mouseup', () => this.endDrag());
    window.addEventListener('touchmove', e => {
      if (e.touches.length === 2 && isPinching) {
        e.preventDefault();
        const newDist  = dist(e.touches);
        if (!pinchStartDist) return;
        const ratio    = newDist / pinchStartDist;
        const newScale = Math.max(1, Math.min(4, pinchStartScale * ratio));
        const scaleRatio = newScale / pinchStartScale;
        this.scale = newScale;
        this.panX  = pinchMidX + scaleRatio * (pinchStartPanX - pinchMidX);
        this.panY  = pinchMidY + scaleRatio * (pinchStartPanY - pinchMidY);
        this._clamp();
        this._apply();
      } else if (e.touches.length === 1 && !isPinching) {
        if (!e.touches.length) return;
        if (this.dragging) e.preventDefault();
        this.moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
    window.addEventListener('touchend', e => {
      if (e.touches.length < 2) isPinching = false;
      if (e.touches.length === 0) this.endDrag();
    });
  }
  _bindWheel() {
    if (!this.wrapper) return;
    this.wrapper.addEventListener('wheel', e => {
      e.preventDefault();
      const rect  = this.wrapper.getBoundingClientRect();
      const cx    = e.clientX - rect.left - rect.width / 2;
      const cy    = e.clientY - rect.top - rect.height / 2;
      const delta = e.deltaY > 0 ? -0.2 : 0.2;
      const prev  = this.scale;
      if (!prev) return;
      this.scale  = Math.max(1, Math.min(4, prev + delta));
      const ratio = this.scale / prev;
      this.panX   = cx + ratio * (this.panX - cx);
      this.panY   = cy + ratio * (this.panY - cy);
      this._clamp();
      this._apply();
    }, { passive: false });
  }
};

document.addEventListener('DOMContentLoaded', function () {

  // ── Comma formatting for numeric inputs ───────────────────────
  sqhBindNumericFormatting();

  // ── Activate existing flash toasts ──────────────────────────────
  document.querySelectorAll('.sqh-toast').forEach(function (toast) {
    // Slide in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.classList.add('sqh-toast--visible');
      });
    });

    // Progress bar countdown
    var fill = toast.querySelector('.sqh-toast-progress-fill');
    if (fill) {
      fill.style.transition = 'none';
      fill.style.width = '100%';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          fill.style.transition = 'width ' + SQH_TOAST_DURATION + 'ms linear';
          fill.style.width = '0%';
        });
      });
    }

    // Auto-dismiss
    var timer = setTimeout(function () { dismissToast(toast); }, SQH_TOAST_DURATION);

    // Manual close
    var closeBtn = toast.querySelector('.sqh-toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        clearTimeout(timer);
        dismissToast(toast);
      });
    }
  });

  // ── Activate current nav-link based on URL ─────────────────────
  var currentPath = window.location.pathname;
  document.querySelectorAll('.sqh-navbar .nav-link').forEach(function (link) {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });

  // ── Password toggle (show/hide) ───────────────────────────────
  document.querySelectorAll('.toggle-password').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.dataset.target;
      var input    = document.getElementById(targetId);
      var icon     = btn.querySelector('i');
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
      } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
      }
    });
  });

  // ── Confirm action modal trigger ──────────────────────────────
  document.querySelectorAll('[data-confirm]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      var msg = el.dataset.confirm || 'Are you sure?';
      if (!window.confirm(msg)) e.preventDefault();
    });
  });

});
