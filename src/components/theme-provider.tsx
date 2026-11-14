'use client';

import { useRef, useSyncExternalStore, type ReactNode } from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { Toaster } from 'sonner';
import { Button } from './ui';

type ThemePreference = 'system' | 'light' | 'dark';
const key = 'bdaymate-theme';
const listeners = new Set<() => void>();
let transition: ViewTransition | undefined;

function validPreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}
function applyTheme(preference: ThemePreference) {
  const resolved =
    preference === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : preference;
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#141623' : '#f8fafc');
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const updateSystem = () => {
    if (document.documentElement.dataset.themePreference === 'system')
      applyTheme('system');
  };
  const updateStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null)
      applyTheme(validPreference(event.newValue));
  };
  media.addEventListener('change', updateSystem);
  window.addEventListener('storage', updateStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener('change', updateSystem);
    window.removeEventListener('storage', updateStorage);
  };
}
function snapshot() {
  const data = document.documentElement.dataset;
  return (data.themePreference || 'system') + ':' + (data.theme || 'light');
}
function useTheme() {
  const value = useSyncExternalStore(subscribe, snapshot, () => 'system:light');
  const [preference, resolved] = value.split(':');
  return {
    preference,
    resolved: resolved === 'dark' ? ('dark' as const) : ('light' as const),
  };
}
function chooseTheme(preference: ThemePreference, origin: HTMLElement | null) {
  try {
    localStorage.setItem(key, preference);
  } catch {
    /* Preference still applies for this page session. */
  }
  const change = () => applyTheme(preference);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduced) {
    change();
    return;
  }
  transition?.skipTransition();
  const rect = origin?.getBoundingClientRect();
  const x = rect ? rect.x + rect.width / 2 : innerWidth / 2;
  const y = rect ? rect.y + rect.height / 2 : 0;
  const root = document.documentElement;
  root.style.setProperty('--theme-x', x + 'px');
  root.style.setProperty('--theme-y', y + 'px');
  root.style.setProperty(
    '--theme-radius',
    Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) +
      'px',
  );
  root.dataset.themeTransition = 'true';
  const current = document.startViewTransition(change);
  transition = current;
  void current.finished
    .catch(() => {})
    .finally(() => {
      if (transition === current) {
        delete root.dataset.themeTransition;
        transition = undefined;
      }
    });
}
export function ThemeToggle() {
  const { preference, resolved } = useTheme();
  const origin = useRef<HTMLButtonElement>(null);
  const Icon =
    preference === 'system' ? Monitor : resolved === 'dark' ? Moon : Sun;
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <Button
          ref={origin}
          variant="ghost"
          size="icon"
          className="theme-toggle"
          aria-label="切换主题"
          title="切换主题"
        >
          <Icon size={19} aria-hidden />
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          className="dropdown-content theme-menu"
          align="end"
          sideOffset={10}
        >
          <Dropdown.Label className="theme-menu-label">
            给今天换一种光线
          </Dropdown.Label>
          <Dropdown.RadioGroup
            value={preference}
            onValueChange={(value) =>
              chooseTheme(validPreference(value), origin.current)
            }
          >
            {(
              [
                { value: 'light', label: '日光', icon: Sun },
                { value: 'dark', label: '夜色', icon: Moon },
                { value: 'system', label: '跟随系统', icon: Monitor },
              ] as const
            ).map((item) => (
              <Dropdown.RadioItem
                key={item.value}
                value={item.value}
                className="dropdown-item theme-option"
              >
                <item.icon size={17} aria-hidden />
                {item.label}
                <Dropdown.ItemIndicator className="theme-check">
                  <Check size={15} aria-hidden />
                </Dropdown.ItemIndicator>
              </Dropdown.RadioItem>
            ))}
          </Dropdown.RadioGroup>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { resolved } = useTheme();
  return (
    <>
      {children}
      <Toaster
        theme={resolved}
        richColors
        position="top-center"
        closeButton
        toastOptions={{ className: 'bday-toast' }}
      />
    </>
  );
}
