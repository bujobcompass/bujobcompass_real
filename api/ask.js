/* ============ /api/ask.js — Vercel 서버리스 함수
   역할: 브라우저가 Anthropic API를 직접 호출하면 API 키가 노출되니까,
   이 함수가 중간에서 키를 안전하게 들고 있으면서 대신 호출해줌.

   ⚠️ 세인님이 해야 할 것 (1번만 하면 됨):
   1. Vercel 프로젝트 → Settings → Environment Variables
   2. Key: ANTHROPIC_API_KEY / Value: 콘솔에서 발급받은 실제 키 값
   3. 저장 후 "Redeploy" (기존 배포엔 자동 반영 안 됨, 재배포해야 적용됨)

   이 파일은 GitHub 저장소에 "api/ask.js" 경로로 올리면(즉, 저장소 최상단에 api 폴더를 만들고
   그 안에 이 파일을 넣으면) Vercel이 자동으로 서버리스 함수로 인식해서 배포해줌.
   별도 설정 필요 없음 — 파일 위치만 맞으면 됨. ============ */

export default async function handler(req, res) {
  // 이 서버리스 함수는 POST 요청만 받음 (브라우저가 fetch로 프롬프트를 보내는 방식)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않은 방식이에요' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // 키를 아직 Vercel에 안 넣었을 때 — 사용자한테는 안전한 메시지만 보여주고, 실제 키 부재는 서버 로그에만 남김
    console.error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았어요. Vercel Settings에서 등록해주세요.');
    return res.status(500).json({ error: 'AI 기능이 아직 준비 중이에요' });
  }

  const { prompt, maxTokens } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || prompt.length > 4000) {
    return res.status(400).json({ error: '요청 내용을 확인해주세요' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', // 품질·비용 균형이 좋은 기본 모델. 필요하면 나중에 다른 모델로 교체 가능
        max_tokens: Math.min(maxTokens || 1000, 1500), // 응답 길이 상한 — 비용 통제용
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API 에러:', response.status, errText);
      return res.status(502).json({ error: 'AI 응답 생성에 실패했어요. 잠시 후 다시 시도해줘' });
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    return res.status(200).json({ text });
  } catch (err) {
    console.error('서버리스 함수 에러:', err);
    return res.status(500).json({ error: '일시적인 오류가 발생했어요' });
  }
}
