import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const MenuSchema = z.array(
	z.object({
		name: z.string().trim().min(1),
		price: z.coerce.number().positive(),
		description: z.string().trim().optional(),
		category: z.enum(["Starter", "Main", "Dessert", "Drink"]),
	}),
);

const DEFAULT_GID = "0";
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hashFilePath = resolve(rootDir, "last-build-hash.txt");
const fallbackMenuPath = resolve(rootDir, "src/data/menu.json");

function loadDotEnv() {
	const envPath = resolve(rootDir, ".env");

	if (!existsSync(envPath)) {
		return;
	}

	const envFile = readFileSync(envPath, "utf8");

	for (const line of envFile.split(/\r?\n/)) {
		const trimmedLine = line.trim();

		if (!trimmedLine || trimmedLine.startsWith("#")) {
			continue;
		}

		const separatorIndex = trimmedLine.indexOf("=");

		if (separatorIndex === -1) {
			continue;
		}

		const key = trimmedLine.slice(0, separatorIndex).trim();
		let value = trimmedLine.slice(separatorIndex + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		process.env[key] ??= value;
	}
}

function getSpreadsheetId() {
	return process.env.SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;
}

function getPublicCsvUrl(spreadsheetId) {
	const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export`);

	url.searchParams.set("format", "csv");
	url.searchParams.set("gid", process.env.GOOGLE_SHEETS_GID || DEFAULT_GID);

	return url.toString();
}

function parseCsv(csv) {
	const rows = [];
	let row = [];
	let cell = "";
	let inQuotes = false;

	for (let index = 0; index < csv.length; index += 1) {
		const char = csv[index];
		const nextChar = csv[index + 1];

		if (char === '"' && inQuotes && nextChar === '"') {
			cell += '"';
			index += 1;
			continue;
		}

		if (char === '"') {
			inQuotes = !inQuotes;
			continue;
		}

		if (char === "," && !inQuotes) {
			row.push(cell);
			cell = "";
			continue;
		}

		if ((char === "\n" || char === "\r") && !inQuotes) {
			if (char === "\r" && nextChar === "\n") {
				index += 1;
			}

			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
			continue;
		}

		cell += char;
	}

	if (cell.length > 0 || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}

	return rows;
}

function normalizeHeader(header) {
	return header.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function rowsToMenuItems(rows) {
	const [headerRow, ...dataRows] = rows;

	if (!headerRow) {
		return [];
	}

	const headers = headerRow.map(normalizeHeader);
	const fieldIndex = {
		name: headers.indexOf("name"),
		price: headers.indexOf("price"),
		description: headers.indexOf("description"),
		category: headers.indexOf("category"),
	};
	const missingFields = Object.entries(fieldIndex)
		.filter(([, index]) => index === -1)
		.map(([field]) => field);

	if (missingFields.length > 0) {
		throw new Error(`Google Sheet is missing required columns: ${missingFields.join(", ")}`);
	}

	return dataRows
		.filter((row) => row.some((cell) => String(cell).trim() !== ""))
		.map((row) => ({
			name: row[fieldIndex.name] ?? "",
			price: row[fieldIndex.price] ?? "",
			description: row[fieldIndex.description] || undefined,
			category: row[fieldIndex.category] ?? "",
		}));
}

function getFallbackMenuData() {
	return JSON.parse(readFileSync(fallbackMenuPath, "utf8"));
}

async function fetchMenuDataForHash() {
	const spreadsheetId = getSpreadsheetId();

	if (!spreadsheetId) {
		console.log("No spreadsheet ID provided. Using src/data/menu.json for the hash.");
		return getFallbackMenuData();
	}

	const response = await fetch(getPublicCsvUrl(spreadsheetId));

	if (!response.ok) {
		console.warn(
			`Google Sheet CSV fetch failed (${response.status} ${response.statusText}). Using src/data/menu.json for the hash.`,
		);
		return getFallbackMenuData();
	}

	const validation = MenuSchema.safeParse(rowsToMenuItems(parseCsv(await response.text())));

	if (!validation.success) {
		console.warn(
			`Google Sheet menu validation failed with ${validation.error.issues.length} issue(s). Using src/data/menu.json for the hash.`,
		);
		return getFallbackMenuData();
	}

	return validation.data;
}

async function main() {
	loadDotEnv();

	const menuData = await fetchMenuDataForHash();
	const newHash = createHash("md5").update(JSON.stringify(menuData)).digest("hex");
	const previousHash = existsSync(hashFilePath) ? readFileSync(hashFilePath, "utf8").trim() : "";

	if (newHash === previousHash) {
		console.log("No menu changes detected. Skipping deploy hook.");
		return;
	}

	const deployHookUrl = process.env.CLOUDFLARE_DEPLOY_HOOK_URL || process.env.CLOUDFLARE_HOOK_URL;

	if (!deployHookUrl) {
		console.log("Menu changes detected, but no Cloudflare deploy hook URL is set. Skipping hook.");
		return;
	}

	const response = await fetch(deployHookUrl, { method: "POST" });

	if (!response.ok) {
		throw new Error(`Cloudflare deploy hook failed: ${response.status} ${response.statusText}`);
	}

	writeFileSync(hashFilePath, `${newHash}\n`);
	console.log("Menu changed. Cloudflare deploy hook triggered.");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
