import { z } from "zod";

export const MENU_CATEGORY_VALUES = [
	"Starter",
	"Main",
	"Dessert",
	"Drink",
	"Side",
	"Grill",
	"Daily",
	"Fried",
	"Salad",
] as const;

type MenuCategoryValue = (typeof MENU_CATEGORY_VALUES)[number];

const menuCategoryAliases: Record<string, MenuCategoryValue> = {
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

function normalizeMenuCategory(value: unknown): unknown {
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

export const MenuCategorySchema = z.preprocess(
	normalizeMenuCategory,
	z.enum(MENU_CATEGORY_VALUES),
);

export const MenuItemSchema = z.object({
	name: z.string().trim().min(1, "Menu item name is required"),
	price: z.coerce.number().positive("Menu item price must be a positive number"),
	category: MenuCategorySchema,
	description: z.string().trim().optional(),
	badges: z.string().trim().optional(),
	opis: z.string().trim().optional(),
	znacke: z.string().trim().optional(),
});

export const MenuSchema = z.array(MenuItemSchema);

export type MenuCategory = z.infer<typeof MenuCategorySchema>;
export type MenuItem = z.infer<typeof MenuItemSchema>;
