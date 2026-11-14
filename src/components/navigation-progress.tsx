'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { navigationStartEvent } from '@/lib/navigation';

export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [pending, setPending] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const committed = pathname + (search ? '?' + search : '');

  useEffect(() => {
    function start() {
      clearTimeout(timeout.current);
      setPending(true);
      // Navigation can be cancelled or fail before a route commits; never leave a stuck bar.
      timeout.current = setTimeout(() => setPending(false), 20_000);
    }
    function click(event: MouseEvent) {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest('a[href]')
          : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.hasAttribute('download') ||
        (link.target && link.target !== '_self') ||
        link.hasAttribute('data-no-progress')
      )
        return;
      const url = new URL(link.href, location.href);
      if (
        url.origin !== location.origin ||
        !['http:', 'https:'].includes(url.protocol) ||
        url.pathname + url.search === location.pathname + location.search
      )
        return;
      start();
    }
    function history() {
      if (location.pathname + location.search !== committed) start();
    }
    document.addEventListener('click', click, true);
    window.addEventListener('popstate', history);
    window.addEventListener(navigationStartEvent, start);
    return () => {
      clearTimeout(timeout.current);
      document.removeEventListener('click', click, true);
      window.removeEventListener('popstate', history);
      window.removeEventListener(navigationStartEvent, start);
    };
  }, [committed]);

  useEffect(() => {
    clearTimeout(timeout.current);
    const frame = requestAnimationFrame(() => setPending(false));
    return () => cancelAnimationFrame(frame);
  }, [committed]);

  return (
    <div
      className="navigation-progress"
      data-active={pending}
      hidden={!pending}
      role="progressbar"
      aria-label="正在打开页面"
    >
      <span className="navigation-progress-beam" />
      <span className="sr-only">正在打开页面，请稍候</span>
    </div>
  );
}
