import type { Metadata } from "next";
import { LoginScreen } from "@/components/login/login-screen";

export const metadata: Metadata = { title: "로그인 · 글로벌쇼츠 스튜디오" };

export default function Page() {
  return <LoginScreen />;
}
