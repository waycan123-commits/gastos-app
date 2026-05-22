export default function FinanceLogo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="5" y="5" width="38" height="38" rx="14" fill="url(#logo-bg)" />
      <path
        d="M14 31.5V18.2C14 16.9 15.5 16.2 16.5 17L24 23L31.5 17C32.5 16.2 34 16.9 34 18.2V31.5"
        stroke="url(#logo-line)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 33H32"
        stroke="rgba(255,255,255,0.82)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="logo-bg" x1="8" y1="7" x2="42" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="#16243B" />
          <stop offset="0.48" stopColor="#0B1223" />
          <stop offset="1" stopColor="#071A22" />
        </linearGradient>
        <linearGradient id="logo-line" x1="14" y1="17" x2="34" y2="33" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67E8F9" />
          <stop offset="0.5" stopColor="#5AA9FF" />
          <stop offset="1" stopColor="#2DDF88" />
        </linearGradient>
      </defs>
    </svg>
  )
}
