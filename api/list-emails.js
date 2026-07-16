/* /api/list-emails.js — 수집된 이메일 목록을 조회하는 관리자 전용 엔드포인트.
   브라우저에서 https://사이트주소/api/list-emails?key=CRON_SECRET값 으로 접속하면
   수집된 이메일이 JSON으로 쭉 나옴.
   ⚠️ 비밀번호로 CRON_SECRET을 재활용함 — 별도 키 관리 안 해도 되게. */

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const key = req.query.key;

  if (!secret || key !== secret) {
    return res.status(401).json({ error: '인증 실패 — key 파라미터를 확인해줘' });
  }

  const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    return res.status(500).json({ error: 'Redis 환경변수가 없어' });
  }

  try {
    const listRes = await fetch(`${KV_REST_API_URL}/smembers/collected_emails`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
    });
    const { result: rawList } = await listRes.json();

    const emails = (rawList || []).map(raw => {
      try { return JSON.parse(raw); } catch { return { email: raw }; }
    });

    // 시간순 정렬 (최신이 위로)
    emails.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));

    return res.status(200).json({
      total: emails.length,
      emails,
    });
  } catch (err) {
    console.error('list-emails.js 에러:', err);
    return res.status(500).json({ error: '서버 오류가 발생했어' });
  }
}
