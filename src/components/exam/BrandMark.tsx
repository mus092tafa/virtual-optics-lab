import { useId } from 'react'

/**
 * The mark of the application, shared by the header, the start screen and the exam bars: parallel
 * light through a converging lens, meeting at its focus. The same drawing is public/favicon.svg.
 */
export function BrandMark() {
  // useId contains characters that are awkward inside url(#…); the id keeps only the safe ones.
  const glow = 'brand-glow-' + useId().replace(/[^\w-]/g, '')
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id={glow}>
          <stop offset="0" stopColor="#fff4e4" />
          <stop offset="0.3" stopColor="#f6a96b" stopOpacity="0.85" />
          <stop offset="1" stopColor="#e2824a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0b0f14" />
      <path d="M6 20H26L50 32M6 32H50M6 44H26L50 32" fill="none" stroke="#e2c7a5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 9Q36 32 26 55Q16 32 26 9Z" fill="#7cc4ff" fillOpacity="0.14" stroke="#7cc4ff" strokeWidth="2.6" strokeLinejoin="round" />
      <circle cx="50" cy="32" r="10" fill={`url(#${glow})`} />
      <circle cx="50" cy="32" r="2.8" fill="#fff4e4" />
    </svg>
  )
}
