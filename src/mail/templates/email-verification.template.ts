function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return entities[character];
  });
}

export function emailVerificationTemplate(
  firstName: string,
  otp: string,
  verificationUrl: string
): { subject: string; html: string; text: string } {
  const safeName = escapeHtml(firstName);
  const safeOtp = escapeHtml(otp);
  const safeUrl = escapeHtml(verificationUrl);

  return {
    subject: 'Verify your Medcore HMS account',

    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>Welcome to Medcore HMS, ${safeName}!</h2>

        <p>Your account has been created. Verify your email address to activate it.</p>

        <p>Your six-digit verification code is:</p>

        <div style="
          font-size: 28px;
          font-weight: bold;
          letter-spacing: 8px;
          padding: 16px;
          background: #f3f4f6;
          text-align: center;
          border-radius: 8px;
        ">${safeOtp}</div>

        <p>This code expires in <strong>10 minutes</strong>.</p>

        <p>You can also open the verification page using this link:</p>

        <p>
          <a href="${safeUrl}"
             style="display:inline-block;padding:12px 20px;background:#2563eb;
                    color:#ffffff;text-decoration:none;border-radius:6px;">
            Verify Email
          </a>
        </p>

        <p>If the button does not work, copy this link into your browser:</p>
        <p>${safeUrl}</p>

        <p>If you did not expect this account, please contact your hospital administrator.</p>

        <p>Regards,<br />Medcore HMS Team</p>
      </div>
    `,

    text: `
Welcome to Medcore HMS, ${firstName}!

Your account has been created. Verify your email address to activate it.

Your verification code is: ${otp}

This code expires in 10 minutes.

Open this link to enter your code:
${verificationUrl}

If you did not expect this account, please contact your hospital administrator.

Regards,
Medcore HMS Team
    `
  };
}