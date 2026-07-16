/* /api/send-daily.js — Vercel Cron이 매일 아침 8시대(KST)에 호출.
   push_subscriptions Set에 저장된 모든 구독자에게 똑같은 알림 문구 하나를 보냄 (개인화 없음).
   ⚠️ 필요한 환경변수:
   - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (mailto:본인이메일)
   - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
   - CRON_SECRET (선택이지만 강력 추천 — 이 값 설정하면 Vercel Cron만 호출 가능, 아무나 못 두드림) */

import webpush from 'web-push';

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: '인증 실패' });
    }
  }

  const {
    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
    UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
  } = process.env;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    console.error('푸시 발송에 필요한 환경변수가 부족해요.');
    return res.status(500).json({ error: '서버 설정이 아직 안 끝났어' });
  }

  webpush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:example@example.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  try {
    const listRes = await fetch(`${UPSTASH_REDIS_REST_URL}/smembers/push_subscriptions`, {
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
    });
    const { result: subs } = await listRes.json();

    // 모두에게 똑같은 문구 (개인화 없음 — B안)
    const payload = JSON.stringify({
      title: '부업 나침반',
      body: '오늘의 챌린지가 열렸어요 — 확인하러 가볼까요? ✨',
      url: './index.html',
    });

    let sent = 0, removed = 0, failed = 0;
    for (const raw of subs || []) {
      try {
        const sub = JSON.parse(raw);
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // 구독이 만료/취소됨 — 목록에서 제거해서 다음번엔 헛수고 안 하게
          await fetch(`${UPSTASH_REDIS_REST_URL}/srem/push_subscriptions/${encodeURIComponent(raw)}`, {
            headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
          });
          removed++;
        } else {
          failed++;
          console.error('발송 실패:', err.statusCode, err.message);
        }
      }
    }

    return res.status(200).json({ ok: true, sent, removed, failed, total: (subs || []).length });
  } catch (err) {
    console.error('send-daily.js 에러:', err);
    return res.status(500).json({ error: '서버 오류가 발생했어' });
  }
}
