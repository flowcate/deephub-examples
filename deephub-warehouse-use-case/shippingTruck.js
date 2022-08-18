import WebSocket from "ws";
import { readFile } from "fs/promises";
import along from "@turf/along";
import length from "@turf/length";
import { lineString } from "@turf/helpers";

import { dataCollection } from "./data/dataCollection.js";
import {
  sleep,
  getTrackable,
  updateTrackable,
  deleteTrackable,
  isLoadingRamp,
  isShippingRamp,
  constructLocation,
} from "./tools.js";

// The base URL at which the DeepHub can be contacted.
const baseUrl = "http://localhost:8081/deephub/v1";

// Determine the zone id from the temporary file, which is required for location updates in local coordinates.
const zoneId = JSON.parse(await readFile("./data/zone.json")).id;

// The list of trucks currently waiting to be loaded.
const waitingTrucks = [];

// The list of product currently waiting to be loaded.
const waitingProducts = [];

// The list of job of forklifts currently loading a product onto a truck.
const activeJobs = [];

function getLoadingRamp(rampId) {
  for (const data of dataCollection) {
    if (data.loadingRampId == rampId) return data;
  }
  return null;
}

// A websocket connection to the DeepHub. This connection is used to listen for fence events, which in turn trigger various actions in this script.
const ws = new WebSocket("ws://localhost:8081/deephub/v1/ws/socket");
ws.on("open", function open() {
  console.log("open");

  // Subscribe to fence events with this websocket connection.
  ws.send(
    JSON.stringify({
      event: "subscribe",
      topic: "fence_events",
    })
  );

  try {
    updateForkliftLoop();
  } catch (err) {
    console.log(err);
  }
});

// Process a received websocket message.
ws.on("message", async function message(buffer) {
  const data = JSON.parse(buffer);
  if (data.event !== "message") return;

  for (const payload of data.payload) {
    if (!payload.trackable_id) continue;

    if (payload.event_type === "region_entry") {
      if (isLoadingRamp(payload.fence_id)) {
        // A truck entered the loading area, add the truck to the list of waiting trucks.
        const trackable = await getTrackable(baseUrl, payload.trackable_id);
        if (!trackable.properties.product) {
          waitingTrucks.push(await getTrackable(baseUrl, payload.trackable_id));
          console.log(
            "Received fence entry event for loading ramp:\n",
            payload
          );
        }
      } else if (isShippingRamp(payload.fence_id)) {
        // A product entered the shipping area, add the product to the list of waiting products.
        waitingProducts.push(await getTrackable(baseUrl, payload.trackable_id));
        console.log("Received fence entry event for shipping ramp:\n", payload);
      }
      console.log(
        "Waiting Trucks:",
        waitingTrucks.length,
        "Waiting Products:",
        waitingProducts.length
      );
    }
  }
});

function removeWaitingTruck(truckId) {
  for (const truck of waitingTrucks) {
    if (truck.id === truckId) {
      waitingTrucks.splice(waitingTrucks.indexOf(truck), 1);
      return;
    }
  }
}

function removeWaitingProduct(productId) {
  for (const product of waitingProducts) {
    if (product.id === productId) {
      waitingProducts.splice(waitingProducts.indexOf(product), 1);
      return;
    }
  }
}

function constructRoute(ramp, barcode) {
  const startPoint = ramp.forkliftRouteEnd;
  const endPoint = ramp.productRoutes[barcode][0];
  const lineStringTrack = lineString([[...startPoint], [...endPoint]]);
  const distance = length(lineStringTrack);

  const route = [];
  const steps = 8;
  for (let x = 0; x < steps + 1; x++) {
    route.push(
      along(lineStringTrack, (distance / steps) * x).geometry.coordinates
    );
  }
  return route;
}

async function searchJob() {
  for (let truck of waitingTrucks) {
    for (const product of waitingProducts) {
      if (
        truck.properties.orderNumber ===
          product.properties.reserve.orderNumber &&
        truck.properties.requestedProducts.includes(product.properties.barcode)
      ) {
        const ramp = getLoadingRamp(truck.properties.loadingRampId);
        const route = constructRoute(ramp, product.properties.barcode);

        // Update the truck to correctly reflect its current loading status.
        truck = await getTrackable(baseUrl, truck.id);

        // Start a job to load the product into the truck.
        activeJobs.push({
          truck,
          product,
          forkliftProviderId: ramp.forkliftProviderId,
          route,
          step: 0,
          isFirstWay: true,
        });

        // Remove the product which is now in the process of being loaded from the waiting list.
        removeWaitingProduct(product.id);

        // Remove the truck from the list of waiting trucks, as it is now being loaded.
        removeWaitingTruck(truck.id);

        // Only start a single job at once.
        return;
      }
    }
  }
}

async function moveForklift(jobData) {
  if (jobData.isFirstWay) {
    // The forklift is on its way to the product.
    if (jobData.step < jobData.route.length) {
      // The forklift has not yet reached the product.
      ws.send(
        constructLocation(
          jobData.route[jobData.step],
          jobData.forkliftProviderId,
          {
            zoneId: zoneId,
            crs: "local",
          }
        )
      );
      jobData.step++;
    } else {
      // The forklift has reached the product.
      // Only load the product if it has been properly stored at the shipping area already.
      const product = await getTrackable(baseUrl, jobData.product.id);
      if (!product.properties.readyToLoad) return;

      // Update the trackable to reflect it is being loaded into the truck.
      await updateTrackable(baseUrl, {
        ...product,
        location_providers: [jobData.forkliftProviderId],
        properties: {
          ...product.properties,
          moveToShipping: true,
        },
      });

      // Update / reset the job jobData for the return trip.
      jobData.step = jobData.route.length - 1;
      jobData.product = product;
      jobData.isFirstWay = false;
    }
  } else {
    // The forklift is on its way back to the truck.
    if (jobData.step >= 0) {
      // The forklift has not yet reached the truck.
      ws.send(
        constructLocation(
          jobData.route[jobData.step],
          jobData.forkliftProviderId,
          {
            zoneId: zoneId,
            crs: "local",
          }
        )
      );
      jobData.step--;
    } else {
      // The forklift has reached the truck. Add the product to the trucks trackables loaded products list.
      const truck = await updateTrackable(baseUrl, {
        ...jobData.truck,
        properties: {
          ...jobData.truck.properties,
          loadedProducts: [
            ...jobData.truck.properties.loadedProducts,
            {
              trackableId: jobData.product.id,
              barcode: jobData.product.properties.barcode,
            },
          ],
        },
      });

      // Remove the job from the list, now that it's finished.
      activeJobs.splice(activeJobs.indexOf(jobData), 1);

      // Remove the trackable for the product, now that it has been loaded into the truck.
      await deleteTrackable(baseUrl, jobData.product.id);

      // If the truck is still missing products, add it back to the list of waiting trucks.
      if (
        truck.properties.loadedProducts.length <
        truck.properties.requestedProducts.length
      )
        waitingTrucks.push(truck);
    }
  }
}

async function updateForkliftLoop() {
  const start = Date.now();

  // If a truck is waiting to be loaded and a product is available, check if its a match.
  if (waitingTrucks.length && waitingProducts.length) {
    await searchJob();
  }

  // Move all forklifts one step forward on their route.
  const updateList = [];
  for (const job of activeJobs) {
    updateList.push(moveForklift(job));
  }
  await Promise.all(updateList);

  await sleep(100 - (Date.now() - start));
  await updateForkliftLoop();
}
