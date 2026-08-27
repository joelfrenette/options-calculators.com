/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  // @react-pdf/renderer draws with pdfkit, whose built-in fonts live as data
  // modules under pdfkit/js/standard-fonts (Helvetica.cjs, …). Next's serverless
  // output tracer does not follow those dynamic requires, so on Vercel the PDF
  // build threw "Cannot find module …/standard-fonts/Helvetica.cjs" while the
  // Excel and email paths worked (only PDF needs the fonts). Force-include the
  // whole pdfkit js tree — and fontkit's data — for the two routes that render
  // a PDF. The version-wildcard matches the pnpm store path.
  outputFileTracingIncludes: {
    "/api/report/download": [
      "./node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/**/*",
      "./node_modules/.pnpm/fontkit@*/node_modules/fontkit/**/*",
    ],
    "/api/report-email": [
      "./node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/**/*",
      "./node_modules/.pnpm/fontkit@*/node_modules/fontkit/**/*",
    ],
  },
}

export default nextConfig
