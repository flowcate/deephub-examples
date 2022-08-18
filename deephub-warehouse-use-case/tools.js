import fetch from "node-fetch";
import { dataCollection } from "./data/dataCollection.js";

export async function sleep(millis) {
  return new Promise((resolve) => setTimeout(resolve, millis));
}

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Get a random integer from the range [min,max]
export function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Return true if the given fence id belongs to a shipping ramp.
export function isShippingRamp(fenceId) {
  return dataCollection.some((data) => fenceId == data.shippingRampId);
}

// Return true if the given fence id belongs to a loading ramp.
export function isLoadingRamp(fenceId) {
  return dataCollection.some((data) => fenceId == data.loadingRampId);
}

export async function getAllFences(baseUrl) {
  const response = await fetch(`${baseUrl}/fences/summary`, {
    method: "get",
    headers: { "Content-Type": "application/json" },
  });
  return await response.json();
}

export async function getTrackable(baseUrl, id) {
  const response = await fetch(`${baseUrl}/trackables/${id}`, {
    method: "get",
    headers: { "Content-Type": "application/json" },
  });
  return await response.json();
}

export async function getAllTrackables(baseUrl) {
  const response = await fetch(`${baseUrl}/trackables/summary`, {
    method: "get",
    headers: { "Content-Type": "application/json" },
  });
  return await response.json();
}

export async function getAllTrackablesInsideFence(baseUrl, fenceId) {
  const response = await fetch(
    `${baseUrl}/fences/${fenceId}/trackables?spatial_query=true`,
    {
      method: "get",
      headers: { "Content-Type": "application/json" },
    }
  );
  return await response.json();
}

export async function updateTrackable(baseUrl, trackable) {
  const response = await fetch(`${baseUrl}/trackables/${trackable.id}`, {
    method: "put",
    body: JSON.stringify(trackable),
    headers: { "Content-Type": "application/json" },
  });
  return await response.json();
}

export async function createTrackable(baseUrl, trackable) {
  const response = await fetch(
    `${baseUrl}/trackables?force_location_update=true`,
    {
      method: "post",
      body: JSON.stringify(trackable),
      headers: { "Content-Type": "application/json" },
    }
  );
  return await response.json();
}

export async function deleteTrackable(baseUrl, id) {
  await fetch(`${baseUrl}/trackables/${id}`, {
    method: "delete",
  });
}

// Basic settings for creating a locatins object
const defaultLocationOptions = {
  zoneId: "34567ojkhvcbnmloikj3mew",
  crs: "EPSG:4326",
  providerType: "uwb",
};
// Helper function to construct a location for a given location provider with the given coordinates.
export function constructLocation(coordinates, providerId, options) {
  return JSON.stringify({
    event: "message",
    topic: "location_updates",
    payload: [
      {
        position: {
          type: "Point",
          coordinates: coordinates,
        },
        source: options.zoneId || defaultLocationOptions.zoneId,
        provider_type:
          options.providerType || defaultLocationOptions.providerType,
        crs: options.crs || defaultLocationOptions.crs,
        provider_id: providerId,
      },
    ],
  });
}
