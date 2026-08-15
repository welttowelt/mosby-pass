const onGitHub = process.env.GITHUB_ACTIONS === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  agentRules: false,
  outputFileTracingRoot: process.cwd(),
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: onGitHub ? "/mosby-pass" : "",
  assetPrefix: onGitHub ? "/mosby-pass/" : "",
};

export default nextConfig;
