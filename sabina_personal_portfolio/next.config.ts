import type { NextConfig } from "next";
import { withValeCms } from '@c3studium/valecms/install/next.mjs'

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  reactStrictMode: true,
};

export default withValeCms(nextConfig)
