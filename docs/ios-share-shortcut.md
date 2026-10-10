# Sharing videos to TravelWith from an iPhone

On Android, the installed app (PWA) shows up in the share sheet on its own: `share_target` in `src/app/manifest.ts`. Safari doesn't support that, so on the iPhone the share sheet entry is an Apple Shortcut that opens `https://<app domain>/?share=<link>`. The app reads the link (`useSharedLink`), opens the most recent trip on Ideas and shows the "Nueva idea" form filled in, ready to confirm.

## Build the Shortcut (once, by the team)

In the Shortcuts app, create a new shortcut named **"Guardar en TravelWith"**:

1. In its details (ⓘ), turn on **Show in Share Sheet**. Under **Share Sheet Types**, leave only **URLs** and **Text**.
2. Action **Get URLs from Input** (input: Shortcut Input).
3. Action **Get Item from List** → First Item.
4. Action **URL Encode** → Encode (input: Item from List).
5. Action **Text**: `https://<app domain>/?share=` followed by the **URL Encoded Text** variable.
6. Action **Open URLs** (input: Text).
7. Optional: if step 2 finds no link, **Show Alert** "No encontré un link para guardar".

Share it with **Share → Copy iCloud Link**. That link goes in the app's help and in the onboarding message for the group.

## Use (each member, once)

1. Open the iCloud link on the iPhone → **Add Shortcut**.
2. In TikTok or Instagram: **Share → More (⋯) → Guardar en TravelWith**. To keep it within reach, add it to the favorites row with **Edit Actions**.

Safari opens TravelWith with the link already in the form; tap **Agregar idea**. If the session has expired, sign in: the link waits until the form is confirmed or closed.

## Test

- Android (Chrome, app installed): share a TikTok → TravelWith → the form appears with the link.
- iPhone: run the Shortcut from a reel → the form appears with the link.
- Without the app open or signed out: after signing in, the form still appears with the link.
