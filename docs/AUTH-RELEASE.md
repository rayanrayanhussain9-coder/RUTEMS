# Email-first authentication release

## Implemented
- Existing accounts: email, then password. Staff authorization and admin TOTP stay unchanged.
- New accounts: email, password and confirmation (minimum 12 characters), email code verified by Supabase `verifyOtp` with type `email`.
- Signup resend uses Supabase `resend` with type `signup`; the UI has a 60-second cooldown, while Supabase enforces server limits.
- No public account lookup and no role assignment from signup metadata.

## Required before publishing this flow
1. Configure production SMTP in Supabase RUTEMS (project `vgenmqsxdqtepiugcznf`). A verified sender domain and an email provider are needed; do not commit credentials.
2. Keep email confirmation enabled. Under Authentication > Emails > Confirm sign up, use subject `Your RUTEMS verification code` and the content in `supabase/templates/confirmation.html`. Saving the local template does not update the hosted project.
3. Check Site URL is `https://rutems.rayan9.workers.dev` and the redirect allow list includes `https://rutems.rayan9.workers.dev/login`. Password recovery and existing invitations still use links.
4. Cloudflare GitHub access was repaired on 2026-09-20: RUTEMS and college-clash are both selected, and the disconnected warning is gone. Keep both repositories authorized.
5. Push and deploy the reviewed release with build `npm run build` and deploy `npx wrangler deploy --config dist/server/wrangler.json --name rutems`.
6. Verify live signup with an inbox controlled by the tester: code arrives, wrong code fails, correct code creates a session, role remains public. Confirm existing admin sign-in and MFA. No production account or email was created by the automated tests.

Do not deploy the code-entry UI before the confirmation email contains the code. The default template currently contains a link, and custom templates are locked until SMTP (or a qualifying plan) is configured. Supabase's built-in mailer is not a substitute for production email delivery.
