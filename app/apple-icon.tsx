import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#ffffff",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <svg fill="none" height={150} viewBox="0 0 128 128" width={150}>
          <path
            d="M64 20 L102 86 H26 Z"
            stroke="#1e40af"
            strokeLinejoin="round"
            strokeWidth={7}
          />
          <path
            d="M64 108 L26 42 H102 Z"
            stroke="#1e40af"
            strokeLinejoin="round"
            strokeWidth={7}
          />
        </svg>
      </div>
    ),
    size,
  );
}
