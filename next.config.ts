import type { NextConfig } from "next";

// 全ページ共通の安全のためのヘッダー。
// 他サイトへの埋め込み(クリックジャッキング)・<base> や form の送り先の書き換え・
// 参照元 URL の漏れ・カメラなど不要な機能の利用を止める。
// script-src は Next の inline script を使うため、ここでは絞らない。
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // 親フォルダの lockfile を誤ってルートにしないよう固定する
  turbopack: { root: process.cwd() },
  // 開発中の「N」ボタンがスマホ幅で下のナビに重なるため消す
  devIndicators: false,
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: {
    // 画像はブラウザで縮小してから送るが、余裕を持たせる
    serverActions: { bodySizeLimit: "3mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
