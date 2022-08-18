import WebSocket from "ws";
import { readFile } from "fs/promises";

import {
  sleep,
  getTrackable,
  getAllTrackablesInsideFence,
  getAllFences,
  updateTrackable,
  isLoadingRamp,
  constructLocation,
} from "./tools.js";
import { getRoutesByLoadingRampId } from "./data/dataCollection.js";
import { getProductByBarcode } from "./data/productList.js";

// The base URL at which the DeepHub can be contacted.
const baseUrl = "http://localhost:8081/deephub/v1";

// List of provider ids used for the forklifts to transport products to the truck.
const forkliftProviderIds = ["ac:de:23:67:10:52", "ac:de:23:67:10:53"];

// Determine the id of the zone to be used for the transformation of local coordinates.
const zoneId = JSON.parse(await readFile("./data/zone.json")).id;

// The list of jobs for picking up products by the forklifts.
const pendingJobs = [];

// The list of active jobs for picking up products.
const activeJobs = [];

// The list of products which are currently in store.
let productsInStore = [];

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
    // If a product entered a storage place, update the list of products in store.
    if (payload.properties && payload.properties.storage_place) {
      console.log("Received fence entry event for storage area:\n", payload);
      await updateProductsInStore();
    }

    // If a new truck arrived at a loading ramp, we update the job list based on the trucks requested products.
    if (
      isLoadingRamp(payload.fence_id) &&
      payload.event_type === "region_entry" &&
      payload.trackable_id
    ) {
      const trackable = await getTrackable(baseUrl, payload.trackable_id);
      if (trackable.properties.truckId) {
        console.log("Received fence entry event for loading ramp:\n", payload);
        updatePendingJobs(trackable, payload.fence_id);
      }
    }
  }
});

async function updateProductsInStore() {
  // Get all fences which are used for storage.
  const fences = (await getAllFences(baseUrl)).filter(
    (fence) => fence.properties && fence.properties.storage_place
  );

  // Get all products which are in storage.
  const list = [];
  for (const fence of fences) {
    list.push(getAllTrackablesInsideFence(baseUrl, fence.id));
  }

  // Filter out all product which have already been reserved.
  productsInStore = (await Promise.all(list))
    .flat()
    .filter((product) => product.properties && !product.properties.reserve);
}

function updatePendingJobs(trackable, loadingRampId) {
  const productRoutes = getRoutesByLoadingRampId(loadingRampId);
  if (!productRoutes) {
    console.error("loadingRampId not found: ", loadingRampId);
    return;
  }

  for (const barcode of trackable.properties.requestedProducts) {
    pendingJobs.push({
      trackable,
      barcode,
      route: productRoutes[barcode],
    });
  }
}

// Start a forklift to pick up a product from the storage area.
async function startForklift() {
  for (const job of pendingJobs) {
    let product = getProductByBarcode(job.barcode, productsInStore);
    if (!product) continue;

    // Update the trackable corresponding to the product to confirm that it has not been reserved yet.
    product = await getTrackable(baseUrl, product.id);
    if (product.properties.reserve) {
      await updateProductsInStore();
      continue;
    }

    // Pick one of the forklifts and update the products trackable to mark it as reserved by this forklift.
    const forkliftProviderId = forkliftProviderIds.shift();
    product = await updateTrackable(baseUrl, {
      ...product,
      properties: {
        ...product.properties,
        reserve: {
          forkliftProviderId,
          orderNumber: job.trackable.properties.orderNumber,
          shippingRampId: job.trackable.properties.shippingRampId,
          loadingRampId: job.trackable.properties.loadingRampId,
        },
      },
    });

    // Create the corresponding active job.
    activeJobs.push({
      job,
      product,
      forkliftProviderId,
      step: 0,
      isFirstWay: true,
      shippingDone: false,
    });

    // Now that we have create the active jobs, remove it from the pending list.
    pendingJobs.splice(pendingJobs.indexOf(job), 1);

    console.log("Started a forklift for this job:\n", job);

    // We want to start only a single forklift. So if we did, we stop the loop.
    return;
  }
}

async function moveForklift(jobData) {
  if (jobData.isFirstWay) {
    // The forklift is on its way to the storage area.
    if (jobData.step < jobData.job.route.length) {
      // The forklift has not yet reached the products storage location.
      ws.send(
        constructLocation(
          jobData.job.route[jobData.step],
          jobData.forkliftProviderId,
          {
            zoneId: zoneId,
            crs: "local",
          }
        )
      );
      jobData.step++;
    } else {
      // The forklift has reached the products storage location.
      // Only load the product, if the product has been properly stored already.
      const product = await getTrackable(baseUrl, jobData.product.id);
      if (!product.properties.storage_place) return;

      // Update the products trackable to reflect it is being moved to the shipping area.
      await updateTrackable(baseUrl, {
        ...product,
        location_providers: [jobData.forkliftProviderId],
        properties: {
          ...product.properties,
          moveToLoad: true,
        },
      });

      // Update / reset the job data for the return trip.
      jobData.step = jobData.job.route.length - 1;
      jobData.product = product;
      jobData.isFirstWay = false;
    }
  } else {
    // The forklift is on its way back to the shipping area.
    if (jobData.step >= 0) {
      // The forklift has not yet reached the shipping area.
      ws.send(
        constructLocation(
          jobData.job.route[jobData.step],
          jobData.forkliftProviderId,
          {
            zoneId: zoneId,
            crs: "local",
          }
        )
      );
      jobData.step--;
    } else {
      // The forklift has reached the shipping area with the product. Detach the product from the forklifts location provider and mark the product as ready to loaded.
      await updateTrackable(baseUrl, {
        ...jobData.product,
        location_providers: [],
        properties: {
          ...jobData.product.properties,
          readyToLoad: true,
        },
      });

      // Remove the job from the active list and make the forklift available again.
      activeJobs.splice(activeJobs.indexOf(jobData), 1);
      forkliftProviderIds.push(jobData.forkliftProviderId);
    }
  }
}

async function updateForkliftLoop() {
  const start = Date.now();

  // If a forklift is available and there are pending jobs, start a new forklift job.
  if (forkliftProviderIds.length && pendingJobs.length) {
    await startForklift();
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
