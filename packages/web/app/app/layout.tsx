import type { Metadata } from "next";
import { PrimaryNav } from "@/components/app/primary-nav";

export const metadata: Metadata = {
  title: "워크스페이스 — OpenMath",
  description:
    "OpenMath 출제 워크스페이스. 학년 · 단원 · 의도를 골라 검증된 동형 문제 한 세트를 만듭니다.",
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-canvas relative">
      <PrimaryNav />
      {children}
    </div>
  );
}
