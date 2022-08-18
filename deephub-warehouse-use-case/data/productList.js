import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const productDataList = [
  {
    providerId: "ac:de:23:67:10:49",
    properties: {
      product: "Product 1",
      barcode: "P-454567654",
    },
    route: JSON.parse(
      await readFile(path.join(__dirname, "./forklift_route1-1.json"))
    ),
    count: 2,
  },
  {
    providerId: "ac:de:23:67:10:50",
    properties: {
      product: "Product 2",
      barcode: "P-56783434567",
    },
    route: JSON.parse(
      await readFile(path.join(__dirname, "./forklift_route2-1.json"))
    ),
    count: 2,
  },
  {
    providerId: "ac:de:23:67:10:51",
    properties: {
      product: "Product 3",
      barcode: "P-56783872213",
    },
    route: JSON.parse(
      await readFile(path.join(__dirname, "./forklift_route3-1.json"))
    ),
    count: 3,
  },
];

export function getProductByBarcode(barcode, list = productDataList) {
  for (const product of list) {
    if (product.properties && product.properties.barcode === barcode) {
      return product;
    }
  }
  return null;
}


export function getRouteByBarcode(barcode) {
  const product = getProductByBarcode(barcode);
  if (product) {
    return product.route;
  }
  return null;
}