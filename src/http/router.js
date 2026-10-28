function pathSegments(path) {
  try {
    return new URL(path, 'http://router.local').pathname.split('/').filter(Boolean);
  } catch {
    return null;
  }
}

export class Router {
  #routes = [];

  add(method, path, handler) {
    if (typeof method !== 'string' || typeof path !== 'string' || typeof handler !== 'function') {
      throw new TypeError('A route requires a method, path, and handler');
    }
    if (!path.startsWith('/')) throw new TypeError('Route paths must start with /');

    this.#routes.push({
      method: method.toUpperCase(),
      segments: pathSegments(path),
      handler,
    });
    return this;
  }

  match(method, path) {
    const segments = pathSegments(path);
    if (!segments) return undefined;

    for (const route of this.#routes) {
      if (route.method !== String(method).toUpperCase() || route.segments.length !== segments.length) {
        continue;
      }

      const params = Object.create(null);
      let matches = true;
      for (let index = 0; index < segments.length; index += 1) {
        const expected = route.segments[index];
        let actual;
        try {
          actual = decodeURIComponent(segments[index]);
        } catch {
          matches = false;
          break;
        }

        if (expected.startsWith(':')) {
          params[expected.slice(1)] = actual;
        } else if (expected !== actual) {
          matches = false;
          break;
        }
      }

      if (matches) return { handler: route.handler, params };
    }
    return undefined;
  }
}

export function createRouter() {
  return new Router();
}