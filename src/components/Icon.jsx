const paths = {
  home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,
  chart: <><path d="M5 20V10"/><path d="M12 20V4"/><path d="M19 20v-7"/><path d="M3 20h18"/></>,
  clipboard: <><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M9 5V3h6v2"/><path d="m8 13 2.2 2.2L16 9.5"/></>,
  shield: <><path d="M12 3 20 6v5c0 5-3.2 8.3-8 10-4.8-1.7-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.8-5 14.2-5 15 0"/></>,
  login: <><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
  sparkle: <><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/></>,
  arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
  refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 8A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 11.9-2"/></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 2-2 6 5"/></>,
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/><circle cx="12" cy="14" r="4"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  check: <path d="m5 12 4.2 4.2L19 6.5"/>,
  logout: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/><path d="m14 8 4 4-4 4M18 12H8"/></>
};

export default function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.sparkle}
    </svg>
  );
}
