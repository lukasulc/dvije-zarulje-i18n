import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const MENU_CATEGORY_VALUES = [
	"Starter",
	"Main",
	"Dessert",
	"Drink",
	"Side",
	"Grill",
	"Daily",
	"Fried",
	"Salad",
];

const menuCategoryAliases = {
	starter: "Starter",
	starters: "Starter",
	predjela: "Starter",
	predjelo: "Starter",
	main: "Main",
	mains: "Main",
	glavnajela: "Main",
	glavnojelo: "Main",
	dessert: "Dessert",
	desserts: "Dessert",
	deserti: "Dessert",
	desert: "Dessert",
	drink: "Drink",
	drinks: "Drink",
	pica: "Drink",
	grill: "Grill",
	grillmenu: "Grill",
	grillponuda: "Grill",
	rostilj: "Grill",
	daily: "Daily",
	dailymenu: "Daily",
	dnevna: "Daily",
	dnevnaponuda: "Daily",
	fried: "Fried",
	frieddishes: "Fried",
	pohana: "Fried",
	pohanajela: "Fried",
	salad: "Salad",
	salads: "Salad",
	salate: "Salad",
	side: "Side",
	sides: "Side",
	prilog: "Side",
	prilozi: "Side",
	priloziidodaci: "Side",
};

function normalizeMenuCategory(value) {
	if (typeof value !== "string") {
		return value;
	}

	const normalized = value
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "");

	return menuCategoryAliases[normalized] ?? value;
}

const MenuSchema = z.array(
	z.object({
		price: z.coerce.number().positive(),
		category: z.preprocess(normalizeMenuCategory, z.enum(MENU_CATEGORY_VALUES)),
		name: z.string().trim().min(1),
		description: z.string().trim().optional(),
		badges: z.string().trim().optional(),
		opis: z.string().trim().optional(),
		znacke: z.string().trim().optional(),
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
	return header
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[\s_-]+/g, "");
}

function findHeaderIndex(headers, field) {
	const index = headers.indexOf(field);

	return index === -1 ? undefined : index;
}

function readOptionalCell(row, index) {
	if (index === undefined) {
		return undefined;
	}

	return row[index] || undefined;
}

function rowsToMenuItems(rows) {
	const [headerRow, ...dataRows] = rows;

	if (!headerRow) {
		return [];
	}

	const headers = headerRow.map(normalizeHeader);
	const requiredFieldIndex = {
		price: headers.indexOf("price"),
		category: headers.indexOf("category"),
		name: headers.indexOf("name"),
	};
	const optionalFieldIndex = {
		description: findHeaderIndex(headers, "description"),
		badges: findHeaderIndex(headers, "badges"),
		opis: findHeaderIndex(headers, "opis"),
		znacke: findHeaderIndex(headers, "znacke"),
	};
	const missingFields = Object.entries(requiredFieldIndex)
		.filter(([, index]) => index === -1)
		.map(([field]) => field);

	if (missingFields.length > 0) {
		throw new Error(`Google Sheet is missing required columns: ${missingFields.join(", ")}`);
	}

	return dataRows
		.filter((row) => row.some((cell) => String(cell).trim() !== ""))
		.map((row) => ({
			price: row[requiredFieldIndex.price] ?? "",
			category: row[requiredFieldIndex.category] ?? "",
			name: row[requiredFieldIndex.name] ?? "",
			description: readOptionalCell(row, optionalFieldIndex.description),
			badges: readOptionalCell(row, optionalFieldIndex.badges),
			opis: readOptionalCell(row, optionalFieldIndex.opis),
			znacke: readOptionalCell(row, optionalFieldIndex.znacke),
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
	const changed = newHash !== previousHash;

	if (process.env.GITHUB_OUTPUT) {
		appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
		appendFileSync(process.env.GITHUB_OUTPUT, `hash=${newHash}\n`);
	}

	if (!changed) {
		console.log("No menu changes detected. Skipping deploy.");
		return;
	}

	writeFileSync(hashFilePath, `${newHash}\n`);
	console.log("Menu changes detected. Build and deploy should run.");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
