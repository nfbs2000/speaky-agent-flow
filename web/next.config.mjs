/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
const staticExport = process.env.STATIC_EXPORT === '1'

const nextConfig = {
  ...(staticExport ? { output: 'export' } : {}),
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
