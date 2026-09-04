import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@skillhydra/core",
    "@skillhydra/skill-kit",
    "@skillhydra/policy",
    "@skillhydra/runtime",
    "@skillhydra/sandbox",
  ],
};

export default nextConfig;
