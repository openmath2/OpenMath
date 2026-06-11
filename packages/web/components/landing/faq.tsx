type FaqItem = {
  question: string;
  answer: string;
};

const items: FaqItem[] = [
  {
    question: "OpenMath 은 다른 AI 출제 도구와 무엇이 다른가요?",
    answer:
      "AI 출력을 그대로 신뢰하지 않습니다. SymPy 기반 기호 계산이 6단계 결정론적 게이트로 모든 문항을 검증하고, 답이 맞다고 증명한 문항만 사용자에게 노출됩니다. 화면에 보이는 ✓는 AI 의 자신감이 아니라 독립된 계산 시스템의 결론입니다.",
  },
  {
    question: "구조 동형과 개념 동형은 무엇이 다른가요?",
    answer:
      "구조 동형은 숫자·계수만 바꿔서 같은 풀이 경로를 따르는 변형입니다. 개념 동형은 풀이 경로가 달라도 같은 학습 목표와 평가 차원을 보존합니다. 출제 화면S3 에서 두 모드 중 하나를 명시적으로 선택합니다.",
  },
  {
    question: "한 번 출제에 시간이 얼마나 걸리나요?",
    answer:
      "보통 5 ~ 30 초입니다. 비슷한 문제 찾기 · 출제 의도 분석 · 문제 생성 · SymPy 산술 검증 · 독립 재풀이 · 학습 목표 점검의 6단계가 실시간으로 화면에 노출되어 진행 상황을 직접 확인할 수 있습니다.",
  },
  {
    question: "회원가입이 필요한가요?",
    answer:
      "1차 MVP는 로그인 없이 사용할 수 있습니다. 브라우저 탭을 닫으면 세션이 폐기되므로, 만든 문항 세트는 PDF 로 내려받아 보관하세요. 계정·이력 기능은 v2 에서 검토합니다.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="container-landing faq-section relative z-[2]">
      <h2>자주 묻는 질문</h2>
      <div className="faq-list">
        {items.map((item) => (
          <details key={item.question} className="disclosure-row">
            <summary>
              <span>{item.question}</span>
              <span className="chevron" aria-hidden="true">
                ⌄
              </span>
            </summary>
            <div className="content">{item.answer}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
