/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Trailing slashes required for static export to work with Capacitor
  trailingSlash: true,
}

export default nextConfig
