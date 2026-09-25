import { useEffect, useState } from 'react';

// Hash routes (#/qr) keep every page working on static hosting and never collide with
// short-link paths (/<slug>), which live in the real URL path.
export interface Route {
  path: string;
  params: URLSearchParams;
}

function parse(): Route {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { path: path || '/', params: new URLSearchParams(query) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function href(path: string, params?: Record<string, string>): string {
  const q = params ? `?${new URLSearchParams(params)}` : '';
  return `#${path}${q}`;
}

export function navigate(path: string, params?: Record<string, string>) {
  location.hash = href(path, params);
}
