import fetch from "node-fetch";

// CONFIG
const baseUrl = "http://localhost:8081/deephub/v1";

const providers = [
  {
    id: "ac:de:23:67:10:46",
    type: "gps",
    name: "Truck 1",
  },
  {
    id: "ac:de:23:67:10:47",
    type: "uwb",
    name: "Forklift 1",
  },
  {
    id: "ac:de:23:67:10:48",
    type: "uwb",
    name: "Forklift 2",
  },
  {
    id: "ac:de:23:67:10:49",
    type: "uwb",
    name: "Product 1",
  },
  {
    id: "ac:de:23:67:10:50",
    type: "uwb",
    name: "Product 2",
  },
  {
    id: "ac:de:23:67:10:51",
    type: "uwb",
    name: "Product 3",
  },
  {
    id: "ac:de:23:67:10:52",
    type: "uwb",
    name: "Forklift 3",
  },
  {
    id: "ac:de:23:67:10:53",
    type: "uwb",
    name: "Forklift 4",
  },
  {
    id: "ac:de:23:67:10:54",
    type: "uwb",
    name: "Pallet Truck, ramp 1",
  },
];

try {
  // Creates a new location providers
  const len = providers.length;
  let i = 0;
  for (; i < len; i++) {
    const response = await fetch(`${baseUrl}/providers`, {
      method: "post",
      body: JSON.stringify(providers[i]),
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    // console.log(data);
  }
} catch (err) {
  console.log(err);
}
