const EVENT_ART = {
  'lagos-after-dark': {
    src: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1400&q=85',
    alt: 'A crowd gathered beneath bright lights at an outdoor music festival',
    kind: 'Live music',
  },
  'the-rhythm-room': {
    src: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=85',
    alt: 'A live band performing on a warmly lit stage',
    kind: 'Live music',
  },
  'soft-life-supper': {
    src: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=85',
    alt: 'A long dinner table set for an evening gathering',
    kind: 'Food & drink',
  },
  'creative-circuit': {
    src: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85',
    alt: 'A packed dance floor at a late-night event',
    kind: 'Arts & culture',
  },
  'sunset-sessions': {
    src: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=85',
    alt: 'A DJ performing at an open-air music event',
    kind: 'Live music',
  },
};

export function el(tag, props = {}, children = []) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null) continue;
    if (key === 'className') {
      element.className = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in element && !key.startsWith('aria-') && !key.startsWith('data-')) {
      element[key] = value;
    } else {
      element.setAttribute(key, String(value));
    }
  }

  const nodes = Array.isArray(children) ? children : [children];
  for (const child of nodes) {
    if (child === undefined || child === null || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return element;
}

export function formatPrice(priceCents) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

export function formatEventDate(value, options = {}) {
  return new Intl.DateTimeFormat('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...options,
  }).format(new Date(value));
}

export function eventArtFor(eventId) {
  return EVENT_ART[eventId] ?? {
    src: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=85',
    alt: 'A crowd enjoying a live event',
    kind: 'Around town',
  };
}