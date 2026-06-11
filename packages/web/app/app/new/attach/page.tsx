import type { Metadata } from "next";

import { AttachView } from "./view";

export const metadata: Metadata = {
  title: "이 문제처럼 — OpenMath",
  description:
    "가지고 있는 문제를 붙여넣거나 사진으로 올리면 학년·단원을 자동으로 인식하고 같은 유형의 문제를 만듭니다.",
};

export default function AttachPage() {
  return <AttachView />;
}
