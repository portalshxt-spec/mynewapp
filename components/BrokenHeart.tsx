/** The broken heart neon sign motif. */
export default function BrokenHeart({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 0 5px rgba(61,232,232,0.8))" }}
    >
      <g stroke="#3DE8E8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 18 C26 12, 14 12, 12 22 C10 32, 22 42, 29 49 L26 38 L33 30 L28 24 Z" />
        <path
          d="M36 20 C40 13, 52 14, 53 23 C54 33, 42 43, 36 49 L38 37 L32 31 L37 25 Z"
          stroke="#C9A961"
          style={{ filter: "drop-shadow(0 0 5px rgba(201,169,97,0.8))" }}
        />
      </g>
    </svg>
  );
}
