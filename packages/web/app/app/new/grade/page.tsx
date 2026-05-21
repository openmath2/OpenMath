import type { Metadata } from "next";
import { GradePicker } from "./picker";

export const metadata: Metadata = {
  title: "학년 선택 — OpenMath",
  description: "출제 대상 학년을 선택하세요. 중1 · 중2 · 중3.",
};

export default function GradePage() {
  return <GradePicker />;
}
