import type { Metadata } from "next";
import { MyPage } from "@/components/me/my-page";

export const metadata: Metadata = { title: "마이페이지 · 글로벌쇼츠 스튜디오" };

export default function Page() {
  return <MyPage />;
}
