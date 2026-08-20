import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "persona-atlas-public-demo.chatgpt.site";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const imageUrl = `${protocol}://${host}/og.png`;
  return {
    title: "假面骑事 | Persona Driver 工作台",
    description: "选择人物卡与指令卡，插入 3D Persona Driver，召唤可追溯的角色工作面板。",
    icons: { icon: "/favicon.svg" },
    openGraph: {
      title: "假面骑事",
      description: "公开测试版，打开链接即可体验 Three.js Persona Driver 插卡召唤工作台。",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "假面骑事公开测试版" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "假面骑事",
      description: "公开测试版，打开链接即可体验 Three.js Persona Driver 插卡召唤工作台。",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
