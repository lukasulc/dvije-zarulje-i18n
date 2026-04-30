import { EmailMessage } from "cloudflare:email";

const messages = {
	hr: {
		success: "Hvala! Poruka je poslana.",
		error: "Poruka se trenutno ne moze poslati. Molimo pokusajte kasnije ili nas kontaktirajte telefonom.",
		invalid: "Molimo unesite ime, ispravnu email adresu i poruku.",
	},
	en: {
		success: "Thanks! Your message has been sent.",
		error: "Your message cannot be sent right now. Please try again later or contact us by phone.",
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

function clean(value, maxLength) {
	return String(value || "").trim().slice(0, maxLength);
}

function isEmail(value) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cleanHeader(value, maxLength) {
	return clean(value, maxLength).replace(/[\r\n]/g, " ");
}

function encodeHeader(value) {
	const cleanValue = cleanHeader(value, 200);

	if (/^[\x20-\x7e]*$/.test(cleanValue)) {
		return cleanValue;
	}

	const bytes = new TextEncoder().encode(cleanValue);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return `=?UTF-8?B?${btoa(binary)}?=`;
}

function buildEmailBody(fields) {
	return [
		`Name: ${fields.name}`,
		`Email: ${fields.email}`,
		`Phone: ${fields.phone || "-"}`,
		`How they found us: ${fields.findUs || "-"}`,
		`Submitted: ${fields.submittedAt}`,
		"",
		fields.message,
	].join("\r\n");
}

function buildRawEmail({ from, to, replyTo, subject, body }) {
	const headers = [
		`From: ${cleanHeader(from, 200)}`,
		`To: ${cleanHeader(to, 200)}`,
		`Reply-To: ${cleanHeader(replyTo, 200)}`,
		`Subject: ${encodeHeader(subject)}`,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
	];

	return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

async function handleContact(request, env) {
	if (request.method !== "POST") {
		return jsonResponse({ ok: false, message: "Method not allowed." }, 405);
	}

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

	const to = cleanHeader(env.CONTACT_TO_EMAIL, 200);
	const from = cleanHeader(env.CONTACT_FROM_EMAIL || "kontakt@dvije-zarulje.hr", 200);

	if (!env.EMAIL || !to || !from) {
		console.error("Contact email configuration is incomplete.", {
			hasEmailBinding: Boolean(env.EMAIL),
			hasContactToEmail: Boolean(to),
			hasContactFromEmail: Boolean(from),
		});

		return jsonResponse({ ok: false, message: copy.error }, 500);
	}

	const submittedAt = new Date().toISOString();
	const subject = `Nova poruka na Dvije Žarulje od: ${name}`;
	const body = buildEmailBody({ name, email, phone, findUs, submittedAt, message });
	const rawEmail = buildRawEmail({ from, to, replyTo: email, subject, body });

	try {
		await env.EMAIL.send(new EmailMessage(from, to, rawEmail));
	} catch (error) {
		console.error("Contact email send failed.", {
			message: error instanceof Error ? error.message : String(error),
			from,
			to,
		});

		return jsonResponse({ ok: false, message: copy.error }, 502);
	}

	return jsonResponse({ ok: true, message: copy.success });
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname === "/api/contact") {
			return handleContact(request, env);
		}

		return env.ASSETS.fetch(request);
	},
};
