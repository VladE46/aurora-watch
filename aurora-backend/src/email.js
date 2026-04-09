/**
 * email.js
 * Sends emails via Brevo (formerly Sendinblue) transactional API.
 * Free tier: 300 emails/day, no credit card required.
 * Sign up at https://app.brevo.com
 */

const BREVO_API = 'https://api.brevo.com/v3/smtp/email';

const FROM = {
  email: process.env.BREVO_SENDER_EMAIL || 'alerts@auroracheck.app',
  name:  process.env.BREVO_SENDER_NAME  || 'AuroraCheck',
};

async function sendEmail({ to, subject, htmlContent }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey || apiKey === 'your_brevo_api_key_here') {
    console.log('[Email stub] Would send to:', to, '| Subject:', subject);
    return { stubbed: true };
  }

  const res = await fetch(BREVO_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: FROM,
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error ${res.status}: ${err}`);
  }
  return await res.json();
}

/**
 * Sends a welcome / confirmation email when someone subscribes.
 */
async function sendConfirmation({ email, locationName, threshold, unsubToken, frontendUrl }) {
  const unsubUrl = `${frontendUrl || 'http://localhost:5500'}/unsubscribe?token=${unsubToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0c0c1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;padding:0 16px;">
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:16px;overflow:hidden;">

      <div style="background:linear-gradient(135deg,rgba(29,158,117,0.2),rgba(83,74,183,0.15));padding:32px 32px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:32px;margin-bottom:12px;">🌌</div>
        <h1 style="color:#5DCAA5;font-size:22px;font-weight:600;margin:0 0 8px;">You're subscribed!</h1>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;margin:0;">AuroraCheck alerts are active for your location.</p>
      </div>

      <div style="padding:28px 32px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="color:rgba(255,255,255,0.45);font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);">Location</td>
            <td style="color:#fff;font-size:13px;font-weight:500;text-align:right;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);">${locationName}</td>
          </tr>
          <tr>
            <td style="color:rgba(255,255,255,0.45);font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);">Alert threshold</td>
            <td style="color:#5DCAA5;font-size:13px;font-weight:600;text-align:right;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);">&gt;${threshold}% probability</td>
          </tr>
          <tr>
            <td style="color:rgba(255,255,255,0.45);font-size:13px;padding:8px 0;">Data source</td>
            <td style="color:rgba(255,255,255,0.7);font-size:13px;text-align:right;padding:8px 0;">NOAA OVATION model</td>
          </tr>
        </table>

        <p style="color:rgba(255,255,255,0.55);font-size:13px;line-height:1.6;margin-bottom:24px;">
          We check aurora conditions every hour. When the probability at your location exceeds
          <strong style="color:#fff;">${threshold}%</strong>, we'll send you an immediate alert so you have time to get outside.
        </p>

        <p style="font-size:12px;color:rgba(255,255,255,0.25);text-align:center;margin:0;">
          <a href="${unsubUrl}" style="color:rgba(255,255,255,0.3);text-decoration:underline;">Unsubscribe</a>
        </p>
      </div>
    </div>
    <p style="text-align:center;font-size:11px;color:rgba(255,255,255,0.2);margin-top:20px;">AuroraCheck · Data from NOAA Space Weather Prediction Center</p>
  </div>
</body>
</html>`;

  return sendEmail({
    to: email,
    subject: `✓ AuroraCheck alerts active for ${locationName}`,
    htmlContent: html,
  });
}

/**
 * Sends the actual aurora alert when conditions are met.
 */
async function sendAuroraAlert({ email, locationName, prob, kp, cloud, threshold, unsubToken, frontendUrl }) {
  const unsubUrl = `${frontendUrl || 'http://localhost:5500'}/unsubscribe?token=${unsubToken}`;
  const siteUrl  = frontendUrl || 'http://localhost:5500';

  const probColor  = prob >= 70 ? '#5DCAA5' : '#EF9F27';
  const cloudText  = cloud !== null ? `${Math.round(cloud)}%` : 'N/A';
  const cloudColor = cloud !== null && cloud < 40 ? '#5DCAA5' : cloud !== null && cloud < 70 ? '#EF9F27' : '#E24B4A';
  const kpText     = kp !== null ? kp.toFixed(1) : 'N/A';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0c0c1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;padding:0 16px;">
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(29,158,117,0.3);border-radius:16px;overflow:hidden;">

      <div style="background:linear-gradient(135deg,rgba(29,158,117,0.25),rgba(83,74,183,0.15));padding:32px 32px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:40px;margin-bottom:12px;">🌌</div>
        <h1 style="color:#5DCAA5;font-size:24px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">Aurora alert!</h1>
        <p style="color:rgba(255,255,255,0.7);font-size:15px;margin:0;">Conditions are favorable at <strong style="color:#fff;">${locationName}</strong></p>
      </div>

      <div style="padding:28px 32px;">

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
          <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Aurora chance</div>
            <div style="font-size:28px;font-weight:700;color:${probColor};">${Math.round(prob)}%</div>
          </div>
          <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Kp index</div>
            <div style="font-size:28px;font-weight:700;color:#AFA9EC;">${kpText}</div>
          </div>
          <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Cloud cover</div>
            <div style="font-size:28px;font-weight:700;color:${cloudColor};">${cloudText}</div>
          </div>
        </div>

        <div style="background:rgba(29,158,117,0.12);border:1px solid rgba(29,158,117,0.25);border-radius:12px;padding:16px;margin-bottom:24px;">
          <p style="color:rgba(93,202,165,0.9);font-size:14px;line-height:1.6;margin:0;">
            <strong style="color:#5DCAA5;">Now is the time to go outside.</strong>
            Head to a dark location away from city lights. Let your eyes adjust for 10–15 minutes.
            ${cloud !== null && cloud > 60 ? `<br><br>⚠️ Note: ${Math.round(cloud)}% cloud cover may reduce visibility — look for gaps in the clouds.` : ''}
          </p>
        </div>

        <div style="text-align:center;margin-bottom:24px;">
          <a href="${siteUrl}" style="background:#1D9E75;color:#fff;text-decoration:none;border-radius:10px;padding:12px 28px;font-size:15px;font-weight:600;display:inline-block;">
            View live forecast →
          </a>
        </div>

        <p style="font-size:12px;color:rgba(255,255,255,0.25);text-align:center;margin:0;">
          This alert was triggered because probability exceeded your ${threshold}% threshold. &nbsp;·&nbsp;
          <a href="${unsubUrl}" style="color:rgba(255,255,255,0.3);text-decoration:underline;">Unsubscribe</a>
        </p>
      </div>
    </div>
    <p style="text-align:center;font-size:11px;color:rgba(255,255,255,0.2);margin-top:20px;">AuroraCheck · Data from NOAA Space Weather Prediction Center</p>
  </div>
</body>
</html>`;

  return sendEmail({
    to: email,
    subject: `🌌 Aurora alert — ${Math.round(prob)}% chance tonight at ${locationName}`,
    htmlContent: html,
  });
}

module.exports = { sendConfirmation, sendAuroraAlert };
