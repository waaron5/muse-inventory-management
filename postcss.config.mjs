// Tailwind through PostCSS, as the Next.js CSS guide sets it up. A custom
// Turbopack loader rule served stale CSS from Vercel's restored build cache.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
