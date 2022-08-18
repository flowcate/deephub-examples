import fetch from "node-fetch";
import { writeFile } from "fs/promises";

// CONFIG
const baseUrl = "http://localhost:8081/deephub/v1";

const zone = {
  ground_control_points: [
    [8.674605503102864, 49.41712227384992],
    [0, 0],
    [8.675984252227366, 49.41712614613228],
    [100, 0],
    [8.675972405760728, 49.41892510943864],
    [100, 200],
    [8.674593606239739, 49.4189212369118],
    [0, 200],
  ],
  type: "uwb",
  floor: 0,
  need_transformation: true,
  name: "Location Heidelberg UWB",
};

// add a zone
const response = await fetch(`${baseUrl}/zones`, {
  method: "post",
  body: JSON.stringify(zone),
  headers: { "Content-Type": "application/json" },
});
const data = await response.json();

await writeFile("./data/zone.json", JSON.stringify(data, null, 2));

// console.log(data);
