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

type MenuPage = "grill" | "daily";

const categoryDetails: Record<MenuCategory, Omit<AstroPieMenuCategory, "id">> = {
	Grill: {
		title: { hr: "Grill ponuda", en: "Grill menu" },
		description: {
			hr: "Rostilj, lepinja, luk i poznati okusi za konkretan obrok.",
			en: "Grill dishes with flatbread, onion and familiar flavors for a proper meal.",
		},
	},
	Daily: {
		title: { hr: "Dnevna ponuda", en: "Daily menu" },
		description: {
			hr: "Kuhana jela i dnevni favoriti. Ponuda se moze mijenjati prema danu.",
			en: "Cooked dishes and daily favorites. The offer may change by day.",
		},
	},
	Fried: {
		title: { hr: "Pohana jela", en: "Fried dishes" },
		description: {
			hr: "Klasicna pohana jela s prilogom.",
			en: "Classic fried dishes with sides.",
		},
	},
	Salad: {
		title: { hr: "Salate", en: "Salads" },
		description: {
			hr: "Svjezi i peceni dodaci uz glavno jelo.",
			en: "Fresh and roasted additions for the main dish.",
		},
	},
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
		title: { hr: "Prilozi i dodaci", en: "Sides and extras" },
		description: {
			hr: "Prilozi, umaci i dodaci za zaokruziti narudzbu.",
			en: "Sides, sauces and extras to complete the order.",
		},
	},
};
const categoryOrder: MenuCategory[] = [
	"Starter",
	"Grill",
	"Daily",
	"Main",
	"Fried",
	"Salad",
	"Side",
	"Dessert",
	"Drink",
];
let menuDataPromise: Promise<AstroPieMenuData> | undefined;

const menuPageCategories: Record<MenuPage, MenuCategory[]> = {
	grill: ["Grill", "Fried", "Salad", "Side", "Starter", "Dessert", "Drink"],
	daily: ["Daily", "Main", "Fried", "Salad", "Side", "Starter", "Dessert", "Drink"],
};

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
	return header
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[\s_-]+/g, "");
}

function findHeaderIndex(headers: string[], field: string): number | undefined {
	const index = headers.indexOf(field);

	return index === -1 ? undefined : index;
}

function readOptionalCell(row: string[], index: number | undefined): string | undefined {
	if (index === undefined) {
		return undefined;
	}

	return row[index] || undefined;
}

function rowsToMenuItems(rows: string[][]): unknown[] {
	const [headerRow, ...dataRows] = rows;

	if (!headerRow) {
		return [];
	}

	const headers = headerRow.map(normalizeHeader);
	const requiredFieldIndex = {
		name: headers.indexOf("name"),
		price: headers.indexOf("price"),
		category: headers.indexOf("category"),
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
		.filter((row) => row.some((cell) => cell.trim() !== ""))
		.map((row) => ({
			name: row[requiredFieldIndex.name] ?? "",
			price: row[requiredFieldIndex.price] ?? "",
			category: row[requiredFieldIndex.category] ?? "",
			description: readOptionalCell(row, optionalFieldIndex.description),
			badges: readOptionalCell(row, optionalFieldIndex.badges),
			opis: readOptionalCell(row, optionalFieldIndex.opis),
			znacke: readOptionalCell(row, optionalFieldIndex.znacke),
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

function parseBadges(value: string | undefined): string[] {
	if (!value) {
		return [];
	}

	return value
		.split(/[;,]/)
		.map((badge) => badge.trim())
		.filter(Boolean);
}

export function getMenuPageCategoryIds(menuData: AstroPieMenuData, page: MenuPage): string[] {
	const categoryIds = menuPageCategories[page];

	return menuData.categories
		.filter((category) => categoryIds.includes(category.id as MenuCategory))
		.map((category) => category.id);
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
				hr: item.opis ?? "",
				en: item.description ?? "",
			},
			price: item.price,
			badges: {
				hr: parseBadges(item.znacke),
				en: parseBadges(item.badges),
			},
			available: true,
		})),
	};
}

export async function getAstroPieMenuData(): Promise<AstroPieMenuData> {
	menuDataPromise ??= loadAstroPieMenuData();

	return menuDataPromise;
}
