// Vercel Serverless Function — 문의 폼 → 이메일 전송
// 사용 서비스: Resend (https://resend.com) — 무료 월 3,000건

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb'
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL || 'nasms88@naver.com';

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: 'RESEND_API_KEY 환경변수가 설정되지 않았습니다.'
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const { name = '', contact = '', type = '', message = '', attachment = null } = body || {};

  if (!name.trim() || !contact.trim() || !message.trim()) {
    return res.status(400).json({ ok: false, error: '필수 항목이 비어 있습니다.' });
  }

  if (attachment && attachment.size > 3 * 1024 * 1024) {
    return res.status(400).json({ ok: false, error: '첨부파일은 3MB 이하여야 합니다.' });
  }

  const escape = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const subject = `[한지 홈페이지 문의] ${name} (${type || '서비스 미선택'})`;

  const html = `
    <div style="font-family:'Apple SD Gothic Neo','맑은 고딕',sans-serif;line-height:1.7;color:#1F2A37;">
      <h2 style="color:#2E7D6B;border-bottom:2px solid #2E7D6B;padding-bottom:8px;">새로운 문의가 도착했습니다</h2>
      <table style="width:100%;border-collapse:collapse;margin-top:20px;">
        <tr><td style="padding:8px 12px;background:#F4F1EB;width:140px;font-weight:bold;">이름 / 회사명</td>
            <td style="padding:8px 12px;border-bottom:1px solid #E5E1D8;">${escape(name)}</td></tr>
        <tr><td style="padding:8px 12px;background:#F4F1EB;font-weight:bold;">연락처</td>
            <td style="padding:8px 12px;border-bottom:1px solid #E5E1D8;">${escape(contact)}</td></tr>
        <tr><td style="padding:8px 12px;background:#F4F1EB;font-weight:bold;">서비스 유형</td>
            <td style="padding:8px 12px;border-bottom:1px solid #E5E1D8;">${escape(type)}</td></tr>
      </table>
      <h3 style="margin-top:24px;color:#2E7D6B;">프로젝트 내용</h3>
      <div style="background:#FBFAF7;padding:16px;border-left:3px solid #2E7D6B;white-space:pre-wrap;">
${escape(message)}
      </div>
      ${attachment && attachment.filename ? `
      <div style="margin-top:20px;padding:14px 16px;background:#E8F2EE;border-radius:6px;font-size:14px;">
        📎 <strong>첨부파일:</strong> ${escape(attachment.filename)}
        <span style="color:#4B5A6B;font-size:12px;margin-left:6px;">(${(attachment.size/1024).toFixed(0)}KB)</span>
      </div>
      ` : ''}
      <p style="margin-top:24px;font-size:12px;color:#8C97A3;">
        본 메일은 hanji.co.kr 문의 폼에서 자동 발송되었습니다.
      </p>
    </div>
  `;

  const emailPayload = {
    from: '주식회사 한지 <onboarding@resend.dev>',
    to: [toEmail],
    reply_to: contact.includes('@') ? contact : undefined,
    subject,
    html
  };

  if (attachment && attachment.filename && attachment.content) {
    emailPayload.attachments = [{
      filename: attachment.filename,
      content: attachment.content
    }];
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(502).json({ ok: false, error: 'Resend 전송 실패', detail: errText });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
