import { z } from "zod";

export const MenuCategorySchema = z.enum(["Starter", "Main", "Dessert", "Drink", "Side"]);

export const MenuItemSchema = z.object({
	name: z.string().trim().min(1, "Menu item name is required"),
	price: z.coerce.number().positive("Menu item price must be a positive number"),
	description: z.string().trim().optional(),
	category: MenuCategorySchema,
});

export const MenuSchema = z.array(MenuItemSchema);

export type MenuCategory = z.infer<typeof MenuCategorySchema>;
export type MenuItem = z.infer<typeof MenuItemSchema>;
