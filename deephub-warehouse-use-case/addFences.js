import fetch from "node-fetch";
import { writeFile } from "fs/promises";

// CONFIG
const baseUrl = "http://localhost:8081/deephub/v1";

const fences = [
  {
    name: "Loading Ramp 1",
    region: {
      type: "Polygon",
      coordinates: [
        [
          [8.675219484517527, 49.41717852643718, 0],
          [8.675259202879204, 49.41717881225491, 0],
          [8.675259538155615, 49.41712402501173, 0],
          [8.675219652155704, 49.417123915955166, 0],
          [8.675219484517527, 49.41717852643718, 0],
        ],
      ],
    },
    properties: null,
    crs: "EPSG:4326",
    elevation_ref: "floor",
  },
  {
    name: "Finished Products",
    region: {
      type: "Polygon",
      coordinates: [
        [
          [8.675234403469858, 49.41812130527984, 0],
          [8.675899910072332, 49.41812531393424, 0],
          [8.675902991121347, 49.41804113212086, 0],
          [8.675231322420842, 49.41804514078239, 0],
          [8.675234403469858, 49.41812130527984, 0],
        ],
      ],
    },
    properties: {
      isProductionArea: true,
    },
    crs: "EPSG:4326",
    elevation_ref: "floor",
  },
  {
    name: "Shipping Ramp 1",
    region: {
      type: "Polygon",
      coordinates: [
        [
          [8.675198693705937, 49.417206152412085, 0],
          [8.675276235844393, 49.41720590871748, 0],
          [8.675275486645262, 49.41717910232534, 0],
          [8.675197944505896, 49.41717885863115, 0],
          [8.675198693705937, 49.417206152412085, 0],
        ],
      ],
    },
    properties: null,
    crs: "EPSG:4326",
    elevation_ref: "floor",
  },
  {
    name: "Storage Area",
    region: {
      type: "Polygon",
      coordinates: [
        [
          [8.674609460507725, 49.418113742292746, 0],
          [8.675040231289415, 49.418113742292746, 0],
          [8.675044077457358, 49.417963618258334, 0],
          [8.675978696206641, 49.41796361825834, 0],
          [8.675978696206641, 49.41736561962991, 0],
          [8.674605614339754, 49.41736311752848, 0],
          [8.674609460507725, 49.418113742292746, 0],
        ],
      ],
    },
    properties: {
      storage_place: true,
    },
    crs: "EPSG:4326",
    elevation_ref: "floor",
  },
];

const fencesList = [];
// add a fences
const len = fences.length;
let i = 0;
for (; i < len; i++) {
  const fence = fences[i];
  const response = await fetch(`${baseUrl}/fences`, {
    method: "post",
    body: JSON.stringify(fence),
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json();

  fencesList.push(data);
}

await writeFile("./data/fences.json", JSON.stringify(fencesList, null, 2));
