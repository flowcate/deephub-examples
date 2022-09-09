import WebSocket from "ws";
import { InfluxDB, Point } from "@influxdata/influxdb-client";

const url = "http://localhost:8086";
const token = "GhKHzZPXed8jrr3ArUL9QvLDghnayXfdD4BQ8BG";
const org = "flowcate";
const bucket = "deephub";
const baseUrl = "//localhost:8081/deephub/v1";

const ws = new WebSocket(`ws:${baseUrl}/ws/socket`);
/**
 * Instantiate the InfluxDB client
 * with a configuration object.
 **/
const influxDB = new InfluxDB({ url, token });

/**
 * Create a write client from the getWriteApi method.
 * Provide your `org` and `bucket`.
 * expecting point timestamps in nanoseconds (can be also 's', 'us', 'ns')
 **/
const writeApi = influxDB.getWriteApi(org, bucket, "ms");

/**
 * create the points for the batch sending
 * @param {object} payload the payload from deephub ws connection
 */
function createPoints(payload) {
  const len = payload.length;
  let i = 0;
  for (; i < len; i++) {
    const element = payload[i];
    const coordinates = element.position.coordinates;

    // create point with measurement
    const point = new Point("location_updates");
    // add values
    point.floatField("longitude", coordinates[0]);
    point.floatField("latitude", coordinates[1]);

    // add tags
    point.tag("provider_id", element.provider_id);
    point.tag("provider_type", element.provider_type);
    // add timestamp
    point.timestamp(new Date(element.timestamp_generated).getTime());

    console.log(point);
    writeApi.writePoint(point);
  }
}

/**
 * on shutdown
 */
async function onShutdown() {
  try {
    await writeApi.close();
    ws.close();
  } catch (error) {
    console.error("ERROR: ", error);
  }
  process.exit(0);
}
process.on("SIGINT", onShutdown);
process.on("SIGTERM", onShutdown);

ws.on("open", async () => {
  console.log("ws connect");

  // registration to location updates
  ws.send(
    JSON.stringify({
      event: "subscribe",
      topic: "location_updates",
    })
  );
});

ws.on("message", async (buffer) => {
  const data = JSON.parse(buffer);
  if (data.event === "message" && data.topic == "location_updates") {
    // create the points for the batch sending
    createPoints(data.payload);
    try {
      // sending to influxDB
      await writeApi.flush(true);
    } catch (error) {
      console.error("ERROR: ", error);
    }
  }
});
