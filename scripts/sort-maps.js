import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const mapsPath = fileURLToPath(new URL("../src/data/maps.json", import.meta.url));
const maps = JSON.parse(await readFile(mapsPath, "utf8"));

if (!Array.isArray(maps) || maps.some((map) => typeof map.name !== "string")) {
  throw new TypeError("maps.json must contain an array of maps with string names.");
}

const featuredMapOrder = new Map(
  ["Main Babe", "New Babe+", "Ghost of the Babe"].map((id, index) => [id, index]),
);

maps.sort((a, b) => {
  const aOrder = featuredMapOrder.get(a.id);
  const bOrder = featuredMapOrder.get(b.id);

  if (aOrder !== undefined || bOrder !== undefined) {
    if (aOrder === undefined) return 1;
    if (bOrder === undefined) return -1;
    return aOrder - bOrder;
  }

  return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
});

await writeFile(mapsPath, `${JSON.stringify(maps, null, 2)}\n`);

console.log(`Sorted ${maps.length} maps by name.`);
