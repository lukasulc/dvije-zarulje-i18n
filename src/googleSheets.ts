import fallbackMenuData from "./data/menu.json";
import { MenuSchema, type MenuCategory, type MenuItem } from "./schemas";

const DEFAULT_GID = "0";

interface LocalizedText {
	hr: string;
	en: string;
}

export interface AstroPieMenuCategory {
	id: string;
	title: LocalizedText;
	description: LocalizedText;
}

export interface AstroPieMenuItem {
	id: string;
	categoryId: string;
	name: LocalizedText;
	description: LocalizedText;
	price: number;
	badges: {
		hr: string[];
		en: string[];
	};
	available: boolean;
	featured?: boolean;
}

export interface AstroPieMenuData {
	source: "sheet" | "fallback";
	currency: string;
	updatedAt: string;
	categories: AstroPieMenuCategory[];
	items: AstroPieMenuItem[];
}

const categoryDetails: Record<MenuCategory, Omit<AstroPieMenuCategory, "id">> = {
	Starter: {
		title: { hr: "Predjela", en: "Starters" },
		description: {
			hr: "Lagana jela za pocetak obroka.",
			en: "Light dishes to begin the meal.",
		},
	},
	Main: {
		title: { hr: "Glavna jela", en: "Mains" },
		description: {
			hr: "Glavna jela iz aktualne ponude.",
			en: "Main dishes from the current menu.",
		},
	},
	Dessert: {
		title: { hr: "Deserti", en: "Desserts" },
		description: {
			hr: "Slatki zavrsetak obroka.",
			en: "A sweet finish to the meal.",
		},
	},
	Drink: {
		title: { hr: "Pica", en: "Drinks" },
		description: {
			hr: "Pica iz aktualne ponude.",
			en: "Drinks from the current menu.",
		},
	},
	Side: {
		title: { hr: "Prilozi", en: "Sides" },
		description: {
			hr: "Prilozi uz glavna jela.",
			en: "Sides with main dishes.",
		},
	},
};
const categoryOrder: MenuCategory[] = ["Starter", "Main", "Dessert", "Drink", "Side"];
let menuDataPromise: Promise<AstroPieMenuData> | undefined;

function getEnv(name: string): string | undefined {
	return import.meta.env[name] ?? process.env[name];
}

function getSpreadsheetId(): string | undefined {
	return getEnv("SPREADSHEET_ID") || getEnv("GOOGLE_SPREADSHEET_ID");
}

function getPublicCsvUrl(spreadsheetId: string): string {
	const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export`);

	url.searchParams.set("format", "csv");
	url.searchParams.set("gid", getEnv("GOOGLE_SHEETS_GID") || DEFAULT_GID);

	return url.toString();
}

function parseCsv(csv: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
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

function normalizeHeader(header: string): string {
	return header.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function rowsToMenuItems(rows: string[][]): unknown[] {
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
		.filter((row) => row.some((cell) => cell.trim() !== ""))
		.map((row) => ({
			name: row[fieldIndex.name] ?? "",
			price: row[fieldIndex.price] ?? "",
			description: row[fieldIndex.description] || undefined,
			category: row[fieldIndex.category] ?? "",
		}));
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function toNumber(value: string | number): number {
	return typeof value === "number" ? value : Number(value);
}

export function getFallbackMenuData(): AstroPieMenuData {
	return {
		source: "fallback",
		currency: fallbackMenuData.currency,
		updatedAt: fallbackMenuData.updatedAt,
		categories: fallbackMenuData.categories,
		items: fallbackMenuData.items.map((item) => ({
			...item,
			price: toNumber(item.price),
		})),
	};
}

export async function getValidatedSheetMenuItems(): Promise<MenuItem[] | undefined> {
	const spreadsheetId = getSpreadsheetId();

	if (!spreadsheetId) {
		return undefined;
	}

	const response = await fetch(getPublicCsvUrl(spreadsheetId));

	if (!response.ok) {
		throw new Error(`Google Sheet CSV fetch failed: ${response.status} ${response.statusText}`);
	}

	const validation = MenuSchema.safeParse(rowsToMenuItems(parseCsv(await response.text())));

	if (!validation.success) {
		// log issues so a developer can fix the sheet.
		console.warn(
			`Google Sheet menu validation failed with ${validation.error.issues.length} issue(s):`,
			validation.error.issues,
		);
		throw new Error(
			`Google Sheet menu validation failed with ${validation.error.issues.length} issue(s).`,
		);
	}

	return validation.data;
}

async function loadAstroPieMenuData(): Promise<AstroPieMenuData> {
	let items: MenuItem[] | undefined;

	try {
		items = await getValidatedSheetMenuItems();
	} catch (error) {
		console.warn(
			`Google Sheet menu could not be used. Falling back to src/data/menu.json. ${error instanceof Error ? error.message : String(error)
			}`,
		);
		return getFallbackMenuData();
	}

	if (!items) {
		return getFallbackMenuData();
	}

	const usedCategories = categoryOrder.filter((category) =>
		items.some((item) => item.category === category),
	);

	return {
		source: "sheet",
		currency: "EUR",
		updatedAt: new Date().toISOString().slice(0, 10),
		categories: usedCategories.map((id) => ({
			id,
			...categoryDetails[id],
		})),
		items: items.map((item, index) => ({
			id: `${slugify(item.name) || "menu-item"}-${index + 1}`,
			categoryId: item.category,
			name: { hr: item.name, en: item.name },
			description: {
				hr: item.description ?? "",
				en: item.description ?? "",
			},
			price: item.price,
			badges: { hr: [], en: [] },
			available: true,
		})),
	};
}

export async function getAstroPieMenuData(): Promise<AstroPieMenuData> {
	menuDataPromise ??= loadAstroPieMenuData();

	return menuDataPromise;
}
