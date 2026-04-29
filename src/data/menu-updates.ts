import { createHash } from "node:crypto";
import { getAstroPieMenuData } from "../googleSheets";

export async function getCurrentMenuHash(): Promise<string> {
	const menuItems = await getAstroPieMenuData();

	return createHash("md5").update(JSON.stringify(menuItems)).digest("hex");
}
