// The sign-in code email, in sign-in's look: the Muse purple bubble with the
// logo and "inventory" across the top of a floating white card, and the code
// in a filled box like sign-in's fields. Email clients can't read the app's
// CSS tokens, so the colours are copied from globals.css; the header is a
// picture (public/email/code-header.png) because they can't draw SVG or load
// the script font either. The plain text goes with it for clients that
// show no HTML.

const purple = "#935ba5"; // --muse-purple
const ink = "#18181a"; // --ink
const subtle = "#62656b"; // --text-subtle
const fill = "#eeeff2"; // --fill
const page = "#f3f4f5"; // --bg-subtle
const card = "#ffffff"; // --entry-card
const sans = "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function codeEmail(code: string, appURL: string) {
  const expiry = "It works for 5 minutes. If you didn't ask for it, you can ignore this email.";
  return {
    subject: `${code} is your Muse Inventory code`,
    text: [`Your Muse Inventory sign-in code is ${code}.`, "", expiry].join("\n"),
    html: codeHTML(escape(code), new URL("/email/code-header.png", appURL).href, expiry),
  };
}

function codeHTML(code: string, header: string, expiry: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Your Muse Inventory code</title>
<style>@import url("https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@500;600;700&display=swap");</style>
</head>
<body style="margin:0;padding:0;background:${page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your sign-in code is ${code}. It works for 5 minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${page};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:${card};border-radius:24px;box-shadow:0 0 2px rgba(0,0,0,0.1),0 2px 8px rgba(0,0,0,0.1),0 6px 20px rgba(0,0,0,0.14);">
<tr><td style="padding:0;border-radius:24px 24px 0 0;">
<img src="${header}" width="480" alt="Muse Inventory" style="display:block;width:100%;max-width:480px;height:auto;border:0;border-radius:24px 24px 0 0;color:${purple};font:700 22px ${sans};">
</td></tr>
<tr><td style="padding:4px 32px 32px;font-family:${sans};color:${ink};">
<h1 style="margin:0 0 6px;font-size:22px;line-height:30px;font-weight:600;color:${ink};">Your sign-in code</h1>
<p style="margin:0 0 20px;font-size:16px;line-height:24px;color:${subtle};">Enter it on the sign-in screen.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:16px 16px 16px 24px;background:${fill};border-radius:12px;font-family:${sans};font-size:36px;line-height:44px;font-weight:700;letter-spacing:8px;color:${ink};font-variant-numeric:tabular-nums;">${code}</td></tr>
</table>
<p style="margin:20px 0 0;font-size:14px;line-height:20px;color:${subtle};">${expiry}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function escape(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
