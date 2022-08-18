import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fences = JSON.parse(
  await readFile(path.join(__dirname, "./fences.json"))
);

// A collection of data for ramps, trucks, routes, products, and forklifts.
export const dataCollection = [
  {
    truckId: "T-3468712",
    route1: JSON.parse(await readFile("./data/truck1-1.json")),
    route2: JSON.parse(await readFile("./data/truck1-2.json")),
    providerId: "ac:de:23:67:10:46",
    loadingRampId: fences[0].id,
    shippingRampId: fences[2].id,
    productRoutes: {
      "P-454567654": JSON.parse(
        await readFile(path.join(__dirname, "./forklift_route1-2.json"))
      ),
      "P-56783434567": JSON.parse(
        await readFile(path.join(__dirname, "./forklift_route2-2.json"))
      ),
      "P-56783872213": JSON.parse(
        await readFile(path.join(__dirname, "./forklift_route3-2.json"))
      ),
    },
    forkliftProviderId: "ac:de:23:67:10:54",
    forkliftRouteEnd: [45.88021454776586, 3.665376852481671],
  },
];

export function getRoutesByLoadingRampId(loadingRampId) {
  for (const data of dataCollection) {
    if (data.loadingRampId === loadingRampId) {
      return data.productRoutes;
    }
  }
  return null;
}
