const shapes = {
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="5" /><path d="M8 3v4m8-4v4M3.5 10.5h17M8 14.5h1m6 0h1M9 17.5q3 2 6 0" /></>,
  history: <><path d="M4 8a8.5 8.5 0 1 1-.5 7M3.5 3.5V8H8" /><path d="M12 7.5V12l3 2" /></>,
  account: <><rect x="3.5" y="3.5" width="17" height="17" rx="6" /><circle cx="12" cy="9" r="2.5" /><path d="M7.5 17c.5-2 2-3 4.5-3s4 1 4.5 3" /></>,
  logout: <><path d="M10 3.5H8a4.5 4.5 0 0 0-4.5 4.5v8A4.5 4.5 0 0 0 8 20.5h2M10 12h10m-4-4 4 4-4 4" /></>,
  sun: <><rect x="7.5" y="7.5" width="9" height="9" rx="4" /><path d="M12 2.5V4m0 16v1.5M2.5 12H4m16 0h1.5M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" /></>,
  moon: <path d="M20.5 13.5A8.5 8.5 0 0 1 10.5 3.5a8.5 8.5 0 1 0 10 10Z" />,
  check: <path d="m5.5 12 4.5 4.5 8.5-9" />,
  unchecked: <rect x="4" y="4" width="16" height="16" rx="5" />,
  checked: <><rect x="4" y="4" width="16" height="16" rx="5" /><path d="m8 12 2.5 2.5L16 9" /></>,
  info: <><rect x="3.5" y="3.5" width="17" height="17" rx="6" /><path d="M12 11v5m0-8v.1" /></>,
  warning: <><path d="M9.4 4.8a3 3 0 0 1 5.2 0l6 10.5a3 3 0 0 1-2.6 4.5H6a3 3 0 0 1-2.6-4.5Z" /><path d="M12 9v4m0 3v.1" /></>,
  edit: <><path d="m13.5 5.5 5 5M4 20l5.5-1.5L20 8a2 2 0 0 0 0-2.8L18.8 4A2 2 0 0 0 16 4L5.5 14.5Z" /><path d="m5.5 14.5 4 4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6.5 6.5 11 11m0-11-11 11" />,
  pause: <><rect x="5" y="4" width="5" height="16" rx="2" /><rect x="14" y="4" width="5" height="16" rx="2" /></>,
  play: <path d="M6 5.5a2 2 0 0 1 3-1.7l10 6.5a2 2 0 0 1 0 3.4L9 20.2a2 2 0 0 1-3-1.7Z" />,
  grip: <>{[7.5, 16.5].flatMap(x => [5, 12, 19].map(y => <rect key={`${x}-${y}`} x={x - 1.5} y={y - 1.5} width="3" height="3" rx="1.2" />))}</>,
  refresh: <><path d="M4 8a8.5 8.5 0 0 1 14-2l2 2M20 4v4h-4M20 16a8.5 8.5 0 0 1-14 2l-2-2M4 20v-4h4" /></>,
  previous: <path d="m14.5 5-6 7 6 7" />,
  next: <path d="m9.5 5 6 7-6 7" />,
};

export type IconName = keyof typeof shapes;

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return <svg className={`inline-block shrink-0 align-middle ${className}`} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" data-icon={name}>
    {shapes[name]}
  </svg>;
}
