/* /api/subscribe.js — 브라우저가 알림 구독하면 이 엔드포인트로 구독 정보(PushSubscription)를 보내옴.
   Upstash Redis(REST API)의 Set 자료구조에 저장해서 나중에 send-daily.js가 전체 목록을 훑을 수 있게 함.
   ⚠️ 필요한 환경변수: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
   (Vercel 대시보드 → Storage → Upstash Redis 연동하면 자동으로 이 값들이 세팅됨) */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않은 요청 방식이야' });
  }

  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    console.error('Upstash Redis 환경변수가 설정되지 않았어요.');
    return res.status(500).json({ error: '서버 설정이 아직 안 끝났어' });
  }

  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: '구독 정보가 올바르지 않아' });
  }

  try {
    const value = JSON.stringify(subscription);
    const url = `${UPSTASH_REDIS_REST_URL}/sadd/push_subscriptions/${encodeURIComponent(value)}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('Upstash 저장 실패:', r.status, t);
      return res.status(500).json({ error: '구독 저장에 실패했어' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('subscribe.js 에러:', err);
    return res.status(500).json({ error: '서버 오류가 발생했어' });
  }
}
