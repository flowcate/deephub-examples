import WebSocket from "ws";
import { randomUUID } from "crypto";

import {
  sleep,
  shuffle,
  getRandomInt,
  getTrackable,
  createTrackable,
  deleteTrackable,
  isLoadingRamp,
  constructLocation,
} from "./tools.js";
import { productDataList } from "./data/productList.js";
import { dataCollection } from "./data/dataCollection.js";

// The base URL at which the DeepHub can be contacted.
const baseUrl = "http://localhost:8081/deephub/v1";

// Create a modifiable copy of the data collection.
// It acts as a list of potential trucks which can be sent on route to the facility.
// If a truck is sent on route, it will be removed from this list.
// If a truck finished its route, it will be added back to this list.
const trucks = [...dataCollection];

// A list of trucks and their associated data, like requested products, which route it is on, and whether it is fully loaded.
// These trucks are actively on route.
const truckDataList = [];

// A list of products in the process of being loaded onto the truck.
const transitingProducts = [];

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
    updateTruckLoop();
  } catch (err) {
    console.log(err);
  }
});

// Process a received websocket message.
// This will listen for fence events of trucks and trackables to determine whether a truck has arrived at the facility or a product is in the process of being loaded.
ws.on("message", async function message(buffer) {
  const data = JSON.parse(buffer);
  if (data.event !== "message") return;

  for (const payload of data.payload) {
    if (!isLoadingRamp(payload.fence_id)) continue;

    // If a product enters the loading ramp, add it to the list of transiting products.
    if (payload.trackable_id) {
      console.log("Product entered loading ramp: ", payload);
      transitingProducts.push(payload.trackable_id);
    }

    // Check if the message received is a fence event for the loading ramp of a truck.
    const truckData = getTruckDataByProviderId(payload.provider_id);
    if (truckData && truckData.truck.loadingRampId === payload.fence_id) {
      if (payload.event_type === "region_entry") {
        // Create a trackable to be attached to the trucks location provider.
        // This trackable contains the list of products requested by the truck.
        // Furthermore it contains the list of products already loaded to the truck.
        truckData.trackable = await createTrackable(baseUrl, {
          radius: 0.5,
          type: "virtual",
          location_providers: [truckData.truck.providerId],
          properties: {
            truckId: truckData.truck.truckId,
            orderNumber: randomUUID(),
            requestedProducts: truckData.requestedProducts,
            loadedProducts: [],
            shippingRampId: truckData.truck.shippingRampId,
            loadingRampId: truckData.truck.loadingRampId,
          },
        });
        console.log("A trucks entered the facility: ", truckData);
      } else if (payload.event_type === "region_exit") {
        // The truck has left the facility after it was fully loaded.
        // We can now remove the trackable attached to the trucks location provider.
        if (truckData.trackable) {
          console.log("A trucks left the facility: ", truckData);
          await deleteTrackable(baseUrl, truckData.trackable.id);
        }
      }
    }
  }
});

// Check the list of transiting products for removed products. These have been loaded onto the truck.
async function checkForDeletedProducts() {
  const len = transitingProducts.length;
  let i = 0;
  for (; i < len; i++) {
    const requestResult = await getTrackable(baseUrl, transitingProducts[i]);

    // The product has been deleted. Remove it from the transiting products list and update the truck that it has loaded this product.
    if (requestResult.type === "not found") {
      transitingProducts.splice(i, 1);
      await updateTrucks();
      return;
    }

    // The request returned something other than a product.
    if (!requestResult.properties.product) {
      transitingProducts.splice(i, 1);
      return;
    }
  }
}

async function updateTrucks() {
  for (const truckData of truckDataList) {
    if (!truckData.trackable) continue;

    // Update the trackable associated with the truck.
    // If the lists of requested and loaded products have equal length, all requested product have been loaded.
    truckData.trackable = await getTrackable(baseUrl, truckData.trackable.id);
    if (
      truckData.trackable.properties &&
      truckData.trackable.properties.requestedProducts &&
      truckData.trackable.properties.loadedProducts &&
      truckData.trackable.properties.requestedProducts.length ===
        truckData.trackable.properties.loadedProducts.length
    ) {
      truckData.fullyLoaded = true;
    }
  }
}

function getTruckDataByProviderId(providerId) {
  for (const truckData of truckDataList) {
    if (truckData.truck.providerId === providerId) {
      return truckData;
    }
  }
  return null;
}

// Create a randomized list of products to be packed.
function createProductList() {
  const requestedProducts = [];
  const len = getRandomInt(4, 6);
  let i = 0;
  for (; i < len; i++) {
    const list = shuffle(productDataList);
    requestedProducts.push(list[0].properties.barcode);
  }

  return requestedProducts;
}

async function startTrucks() {
  while (trucks.length) {
    const truck = trucks.shift();
    const requestedProducts = createProductList();
    truckDataList.push({
      truck,
      requestedProducts,
      step: 0,
      isFirstWay: true,
      fullyLoaded: false,
    });
  }
}

async function moveTruck(truckData) {
  if (truckData.isFirstWay) {
    // The truck is on its way to the facility.
    if (truckData.step < truckData.truck.route1.length) {
      // The truck has not yet reached the facility. Update its location.
      ws.send(
        constructLocation(
          truckData.truck.route1[truckData.step],
          truckData.truck.providerId,
          {
            providerType: "gps",
          }
        )
      );
      truckData.step++;
    } else {
      // The truck has just reached the facility. Update and reset the truck data accordingly.
      truckData.isFirstWay = false;
      truckData.step = 0;
    }
  } else {
    // The truck has already reached the facility. It will wait until it is fully loaded.
    if (truckData.fullyLoaded) {
      if (truckData.step < truckData.truck.route1.length) {
        // The truck is departing but has not reached the end of its route. Update its location.
        ws.send(
          constructLocation(
            truckData.truck.route2[truckData.step],
            truckData.truck.providerId,
            {
              providerType: "gps",
            }
          )
        );
        truckData.step++;
      } else {
        // The truck has reached the end of its route. Remove its data from the list of truck data.
        truckDataList.splice(truckDataList.indexOf(truckData), 1);
        // Push back the trucks data collection to the trucks array for the truck to be reinitialized.
        trucks.push(truckData.truck);
      }
    }
  }
}

async function updateTruckLoop() {
  const start = Date.now();

  // If there are data collections for a truck available, initialize these trucks.
  if (trucks.length) {
    startTrucks();
  }

  // If there are products in transit, check whether they have been loaded (according trackable was removed).
  if (transitingProducts.length) {
    await checkForDeletedProducts();
  }

  // Move all trucks one step forward on their route.
  const updateList = [];
  for (const truckData of truckDataList) {
    updateList.push(moveTruck(truckData));
  }
  await Promise.all(updateList);

  await sleep(100 - (Date.now() - start));
  await updateTruckLoop();
}
