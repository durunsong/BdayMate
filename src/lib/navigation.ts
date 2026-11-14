'use client';

import { useRouter } from 'next/navigation';

export const navigationStartEvent = 'bdaymate:navigation-start';

function beginNavigation(href: string) {
  const url = new URL(href, window.location.href);
  if (
    url.origin === window.location.origin &&
    url.pathname + url.search !==
      window.location.pathname + window.location.search
  )
    window.dispatchEvent(new Event(navigationStartEvent));
}

// Form submissions and notification actions need the same feedback as links.
export function useProgressRouter() {
  const router = useRouter();
  return {
    ...router,
    push(...args: Parameters<typeof router.push>) {
      beginNavigation(args[0]);
      router.push(...args);
    },
    replace(...args: Parameters<typeof router.replace>) {
      beginNavigation(args[0]);
      router.replace(...args);
    },
  };
}
