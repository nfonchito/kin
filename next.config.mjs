/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
    dirs: [],
  },
  // No ignoreBuildErrors: tsc --noEmit is clean, so type errors should fail
  // the build rather than ship. Turning it off costs nothing today and stops
  // a real error reaching production later.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
