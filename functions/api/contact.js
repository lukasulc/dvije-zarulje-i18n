const messages = {
  hr: {
    success: "Hvala! Poruka je poslana.",
    error:
      "Poruka se trenutno ne moze poslati. Molimo pokusajte kasnije ili nas kontaktirajte telefonom.",
    invalid: "Molimo unesite ime, ispravnu email adresu i poruku.",
  },
  en: {
    success: "Thanks! Your message has been sent.",
    error:
      "Your message cannot be sent right now. Please try again later or contact us by phone.",
    invalid: "Please enter your name, a valid email address, and a message.",
  },
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clean(value, maxLength) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const formData = await request.formData();
  const locale = formData.get("locale") === "en" ? "en" : "hr";
  const copy = messages[locale];

  if (clean(formData.get("website"), 200)) {
    return jsonResponse({ ok: true, message: copy.success });
  }

  const name = clean(formData.get("name"), 120);
  const email = clean(formData.get("email"), 200);
  const phone = clean(formData.get("phone"), 80);
  const findUs = clean(formData.get("find-us"), 200);
  const message = clean(formData.get("message"), 4000);

  if (!name || !isEmail(email) || !message) {
    return jsonResponse({ ok: false, message: copy.invalid }, 400);
  }

  const to = env.CONTACT_TO_EMAIL;
  const from = env.CONTACT_FROM_EMAIL || "no-reply@dvije-zarulje.hr";

  if (!env.EMAIL || !to || !from) {
    return jsonResponse({ ok: false, message: copy.error }, 500);
  }

  const submittedAt = new Date().toISOString();
  const subject = `Nova poruka sa stranice: ${name}`;
  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone || "-"}`,
    `How they found us: ${findUs || "-"}`,
    `Submitted: ${submittedAt}`,
    "",
    message,
  ].join("\n");
  const html = `
		<h2>Nova poruka sa stranice</h2>
		<p><strong>Ime:</strong> ${escapeHtml(name)}</p>
		<p><strong>Email:</strong> ${escapeHtml(email)}</p>
		<p><strong>Telefon:</strong> ${escapeHtml(phone || "-")}</p>
		<p><strong>Kako su culi za nas:</strong> ${escapeHtml(findUs || "-")}</p>
		<p><strong>Vrijeme:</strong> ${escapeHtml(submittedAt)}</p>
		<hr>
		<p>${escapeHtml(message).replaceAll("\n", "<br>")}</p>
	`;

  try {
    await env.EMAIL.send({
      from,
      to,
      replyTo: email,
      subject,
      text,
      html,
    });
  } catch {
    return jsonResponse({ ok: false, message: copy.error }, 502);
  }

  return jsonResponse({ ok: true, message: copy.success });
}

export function onRequestGet() {
  return jsonResponse({ ok: false, message: "Method not allowed." }, 405);
}
