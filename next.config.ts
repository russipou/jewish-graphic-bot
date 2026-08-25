import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  turbopack: {
    root: process.cwd(),
  },
  // The image tool reads these at request time with a runtime-built path,
  // which Vercel's static file tracing can't see — include them explicitly.
  outputFileTracingIncludes: {
    "/**": ["./creation-ai-promt.md", "./review-ai-promt.md"],
  },
};

export default withEve(nextConfig);
