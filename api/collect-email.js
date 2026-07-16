/* /api/collect-email.js — 사용자가 이메일 입력 후 "시작하기" 누르면 여기로 전송됨.
   Upstash Redis에 이메일 + 메타정보(유형, 관심사, 직업, 시각)를 저장.
   ⚠️ 필요한 환경변수: KV_REST_API_URL, KV_REST_API_TOKEN (Upstash 연동 시 자동 세팅됨) */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않은 요청 방식이야' });
  }

  const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    console.error('Upstash Redis 환경변수가 설정되지 않았어요.');
    return res.status(500).json({ error: '서버 설정이 아직 안 끝났어' });
  }

  const { email, typeName, interest, job, ts } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: '이메일이 올바르지 않아' });
  }

  try {
    // 이메일 + 메타정보를 JSON으로 묶어서 Redis Set에 저장
    // Set이라 같은 이메일이 여러 번 제출돼도 중복 안 생김
    const value = JSON.stringify({ email: email.toLowerCase().trim(), typeName, interest, job, ts });
    const url = `${KV_REST_API_URL}/sadd/collected_emails/${encodeURIComponent(value)}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('이메일 저장 실패:', r.status, t);
      return res.status(500).json({ error: '저장에 실패했어' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('collect-email.js 에러:', err);
    return res.status(500).json({ error: '서버 오류가 발생했어' });
  }
}
