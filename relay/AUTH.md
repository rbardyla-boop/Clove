# Clove Relay — Substack authentication

Relay does not require or store a Substack password.

Substack's current web sign-in supports an emailed verification code as well as password login. If your Substack account is tied to a Gmail/Google identity and you do not use a Substack password, use the email-verification flow inside Relay's Chromium window.

## Passwordless login

1. Run:

   ```bash
   clove-relay login examples/detox-season.yml
   ```

2. In the Chromium window Relay opens, enter the email address associated with the Substack author account.

3. Click **Continue**. Do not choose **Sign in with password** if you do not have one.

4. Retrieve the verification code from the Substack email using your normal mail client/browser.

5. Enter that verification code back into the Relay Chromium window.

   If Substack offers only a verification link, make sure the link is opened in the Relay Chromium profile. If another browser opens it, copy the verification URL and paste it into the Relay Chromium window instead. The authenticated session must end up in `.relay-auth/substack`, not only in the user's ordinary browser profile.

6. Once authenticated, make sure the **Publisher dashboard** for the intended publication is visible. If authentication lands on ordinary Substack Home, open the profile menu and choose **Publisher dashboard**, or navigate to the manifest's configured dashboard URL.

7. Return to the terminal and press Enter only after the publisher dashboard is visibly open.

## Security boundary

- Relay never asks for the email password or Google password.
- Relay never copies cookies from another browser.
- Relay does not automate Gmail or Google sign-in.
- The user completes authentication interactively in the visible browser.
- Session state remains only in the local `.relay-auth/substack` profile, which is git-ignored.
