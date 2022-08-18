import fetch from "node-fetch";

// The base URL at which the DeepHub can be contacted.
const baseUrl = "http://localhost:8081/deephub/v1";

/**
 * delete all trackables
 * @param {string} baseUrl The base URL at which the DeepHub
 */
export async function deleteTrackables(baseUrl) {
  await fetch(`${baseUrl}/trackables`, {
    method: "delete",
  });
}

deleteTrackables(baseUrl);
