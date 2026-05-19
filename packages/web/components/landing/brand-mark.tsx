export function BrandMark() {
  return (
    <span className="brand-mark" aria-label="OpenMath logo">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 6.5 V20" opacity="0.55" />
        <path
          d="M3 6.5 C 6 5.5, 9 5.5, 12 6.5 V20 C 9 19, 6 19, 3 20 Z"
          fill="rgba(255,255,255,0.18)"
        />
        <path
          d="M21 6.5 C 18 5.5, 15 5.5, 12 6.5 V20 C 15 19, 18 19, 21 20 Z"
          fill="rgba(255,255,255,0.18)"
        />
        <path d="M5.5 11.2 L7.6 13.3 M7.6 11.2 L5.5 13.3" strokeWidth="1.4" />
        <path d="M14.6 11.6 H18.6 M14.6 13.4 H18.6" strokeWidth="1.4" />
      </svg>
    </span>
  );
}
