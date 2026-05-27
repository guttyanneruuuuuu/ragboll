// ============================================================
// dom.js — Helpers for tiny declarative DOM construction.
//
// We deliberately do NOT depend on a UI framework so the bundle
// stays small and the index.html can be opened straight from the
// filesystem. These helpers act as a 5-line "h()" function with
// extras like classnames, event binding and template literals.
// ============================================================

/**
 * Create an HTMLElement using the JSX-like signature
 * `el('div.foo#bar', { onClick: ... }, children)`.
 *
 * - tag may include `#id` and `.classes`
 * - props maps DOM properties (`onClick` -> `addEventListener`)
 * - children can be strings, numbers, nodes or arrays
 */
export function el(spec, props = {}, ...children) {
  let tag = 'div';
  let id  = '';
  const classes = [];
  if (typeof spec === 'string') {
    const m = spec.match(/^([a-zA-Z][a-zA-Z0-9-]*)?(?:#([a-zA-Z0-9_-]+))?((?:\.[a-zA-Z0-9_-]+)*)$/);
    if (m) {
      tag = m[1] || 'div';
      id = m[2] || '';
      if (m[3]) m[3].split('.').filter(Boolean).forEach(c => classes.push(c));
    }
  }
  const node = document.createElement(tag);
  if (id) node.id = id;
  if (classes.length) node.classList.add(...classes);
  if (props && typeof props === 'object' && !(props instanceof Node) && !Array.isArray(props)) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null) continue;
      if (key === 'style' && typeof value === 'object') {
        Object.assign(node.style, value);
      } else if (key === 'dataset' && typeof value === 'object') {
        for (const [dk, dv] of Object.entries(value)) node.dataset[dk] = dv;
      } else if (key === 'class' || key === 'className') {
        const arr = Array.isArray(value) ? value : String(value).split(/\s+/);
        node.classList.add(...arr.filter(Boolean));
      } else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key in node) {
        try { node[key] = value; } catch (_err) { node.setAttribute(key, value); }
      } else {
        node.setAttribute(key, value);
      }
    }
  } else if (props != null) {
    children.unshift(props);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    if (child instanceof Node) node.appendChild(child);
    else node.appendChild(document.createTextNode(String(child)));
  }
  return node;
}

/** Shortcut: `el('text', { tag }, ...children)`. */
export function text(content) {
  return document.createTextNode(String(content));
}

/** Replace the children of a node with new content. */
export function setChildren(parent, ...children) {
  while (parent.firstChild) parent.removeChild(parent.firstChild);
  for (const child of children.flat(Infinity)) {
    if (child == null) continue;
    if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
  return parent;
}

/** Find the first element matching `selector` or throw. */
export function $(selector, root = document) {
  const node = root.querySelector(selector);
  if (!node) throw new Error(`[dom] selector not found: ${selector}`);
  return node;
}

/** Optional find — returns null if absent. */
export function $opt(selector, root = document) {
  return root.querySelector(selector);
}

/** Find all matches as a real Array. */
export function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/** Add or remove a class based on a boolean. */
export function toggle(node, cls, on) {
  if (!node) return;
  if (on) node.classList.add(cls);
  else node.classList.remove(cls);
}

/** Detach a node from the DOM (safe if not attached). */
export function detach(node) {
  if (node && node.parentNode) node.parentNode.removeChild(node);
}

/** Try to copy `text` to the clipboard, falling back to a textarea. */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_err) { /* will use the fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch (_err) {
    return false;
  }
}

/** Locate the first focusable descendant — used for screen transitions. */
export function focusFirstButton(root) {
  const btn = root.querySelector('button, [tabindex]');
  if (btn && typeof btn.focus === 'function') {
    try { btn.focus({ preventScroll: true }); } catch (_err) { btn.focus(); }
  }
}

/** Add an event listener that automatically unbinds when the
 *  returned function is called. Saves tedious `removeEventListener`
 *  bookkeeping. */
export function listen(target, event, handler, options) {
  target.addEventListener(event, handler, options);
  return () => target.removeEventListener(event, handler, options);
}

/** Resolve when the document is in `interactive`/`complete` state. */
export function ready() {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

/**
 * Tiny template helper. Usage:
 *   const node = html`<div class="hi">hello ${name}</div>`;
 * Returns an HTMLElement. Escapes interpolations by default.
 */
export function html(strings, ...values) {
  const safe = values.map(v => {
    if (v instanceof Node) return `<!--ragblade:slot-->`;
    const s = String(v ?? '');
    return s.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;',
    }[c]));
  });
  const concat = strings.reduce((acc, str, i) => acc + str + (safe[i] ?? ''), '');
  const wrapper = document.createElement('template');
  wrapper.innerHTML = concat.trim();
  const root = wrapper.content.firstElementChild;
  // Replace slot comments with actual node references.
  if (root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    const slots = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue === 'ragblade:slot') slots.push(walker.currentNode);
    }
    let slotIndex = 0;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v instanceof Node) {
        const placeholder = slots[slotIndex++];
        if (placeholder && placeholder.parentNode) {
          placeholder.parentNode.replaceChild(v, placeholder);
        }
      }
    }
  }
  return root || wrapper.content;
}

/** Add a CSS string into a `<style>` element on demand. */
export function injectStyle(css, id = 'ragblade-runtime-style') {
  let style = document.getElementById(id);
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    document.head.appendChild(style);
  }
  style.appendChild(document.createTextNode(css));
  return style;
}
