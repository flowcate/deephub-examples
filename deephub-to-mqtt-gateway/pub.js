import WebSocket from "ws";
import mqtt from "mqtt";
import sparkplug from "sparkplug-payload";

const spPayload = sparkplug.get("spBv1.0");
const baseUrl = "//localhost:8081/deephub/v1";
const ws = new WebSocket(`ws:${baseUrl}/ws/socket`);
const mqttClient = mqtt.connect("mqtt://localhost");

mqttClient.on("connect", function () {
  console.log("mqtt pub connect");
});

/**
 * Create a sparkplug b compliant message
 * @param {string} topic the name of topic
 * @param {*} payload The payload
 * @returns a encoded sparkplug B message
 */
function createMsg(topic, payload) {
  const msg = {
    topic,
    payload,
  };

  try {
    msg.payload = sparkplugEncode(msg.payload);
  } catch (e) {
    console.error("unable to encode message", e.toString());
    return null;
  }

  return msg;
}

let seq = 0;
/**
 * @returns {Number} the next sequence number for the payload
 */
function nextSeq() {
  if (seq > 255) {
    seq = 0;
  }
  return seq++;
}

/**
 * Sparkplug Encode Payload
 * @param {object} payload object to encode
 * @returns a sparkplug B encoded Buffer
 */
function sparkplugEncode(payload) {
  // return JSON.stringify(payload); // for debugging

  // Verify that all metrics have a type (if people copy message from e.g. MQTT.FX, then the variable is not called type)
  if (payload.hasOwnProperty("metrics")) {
    if (!Array.isArray(payload.metrics)) {
      throw Error("metrics not array");
    } else {
      payload.metrics.forEach((met) => {
        if (!met.hasOwnProperty("type")) {
          throw Error("unable to encode message", {
            type: "",
            error:
              "Unable to encode message, all metrics must have a 'type' Attribute",
          });
        }
      });
    }
  }
  return spPayload.encodePayload(payload);
}

/**
 *
 * @param {String} topic name of edge_node_id
 * @param {String} deviceId name of device_id
 * @returns {String} name of topic for mqtt
 */
function createSparkplugTopic(topic, deviceId) {
  // namespace/group_id/DDATA/edge_node_id/device_id
  return `spBv1.0/deephub/DDATA/${topic}/${deviceId}`;
}

/**
 *
 * @param {Object} payload payload from location_updates event
 * @returns {Object} sparkplug payload object
 */
function createSparkplugLocationUpdates(payload) {
  return {
    timestamp: new Date(payload.timestamp_sent).getTime(),
    seq: nextSeq(),
    metrics: [
      {
        name: "position",
        type: "Template",
        value: {
          version: "1",
          isDefinition: false,
          metrics: [
            { name: "type", value: "Point", type: "string" },
            {
              type: "dataset",
              value: {
                numOfColumns: 3,
                types: ["double", "double", "double"],
                columns: ["long", "lat", "z"],
                rows: [
                  [
                    payload.position.coordinates[0],
                    payload.position.coordinates[1],
                    payload.position.coordinates[2] || null,
                  ],
                ],
              },
            },
          ],
        },
      },
      {
        name: "source",
        type: "String",
        value: payload.source,
      },
      {
        name: "provider_type",
        type: "String",
        value: payload.provider_type,
      },
      {
        name: "provider_id",
        type: "String",
        value: payload.provider_id,
      },
      {
        name: "trackables",
        type: "Template",
        value: {
          isDefinition: false,
          metrics: payload.trackables
            ? payload.trackables.map((trackableid) => {
                return {
                  name: "trackable_id",
                  value: trackableid,
                  type: "string",
                };
              })
            : [],
        },
      },
      {
        name: "timestamp_generated",
        type: "String",
        value: payload.timestamp_generated,
      },
      {
        name: "timestamp_sent",
        type: "String",
        value: payload.timestamp_sent,
      },
      {
        name: "crs",
        type: "String",
        value: payload.crs || null,
      },
      {
        name: "associated",
        type: "Boolean",
        value: payload.associated || null,
      },
      {
        name: "accuracy",
        type: "Double",
        value: payload.accuracy || null,
      },
      {
        name: "floor",
        type: "Double",
        value: payload.floor || null,
      },
      {
        name: "true_heading",
        type: "Double",
        value: payload.true_heading || null,
      },
      {
        name: "magnetic_heading",
        type: "Double",
        value: payload.magnetic_heading || null,
      },
      {
        name: "heading_accuracy",
        type: "Double",
        value: payload.heading_accuracy || null,
      },
      {
        name: "elevation_ref",
        type: "String",
        value: payload.elevation_ref || null,
      },
      {
        name: "speed",
        type: "Double",
        value: payload.speed || null,
      },
      {
        name: "course",
        type: "Double",
        value: payload.course || null,
      },
      //   {
      //     name: "properties",
      //     type: "Template",
      //     value: {
      //       version: "1",
      //       isDefinition: false,
      //       metrics: [],
      //     },
      //   },
    ],
  };
}

/**
 * send a message via mqtt
 * @param {string} topic sparkplug topic
 * @param {Object} metrics sparkplug payload object
 */
function sendToMQTT(topic, metrics) {
  const msg = createMsg(topic, metrics);
  console.log("msg", msg);

  if (mqttClient.connected) {
    mqttClient.publish(
      msg.topic,
      msg.payload,
      {
        qos: 0,
        retain: false,
      },
      function (err) {
        if (err) {
          console.error(err);
        }
      }
    );
  }
}

ws.on("open", async () => {
  console.log("ws connect");

  // registration to fence events
  //   ws.send(
  //     JSON.stringify({
  //       event: "subscribe",
  //       topic: "fence_events",
  //     })
  //   );

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
  if (data.event === "message") {
    switch (data.topic) {
      case "trackable_motions":
        break;
      case "location_updates":
        const payloadList = data.payload;
        const len = payloadList.length;
        let i = 0;
        for (; i < len; i++) {
          const payload = payloadList[i];
          sendToMQTT(
            createSparkplugTopic("location_updates", payload.provider_id),
            createSparkplugLocationUpdates(payload)
          );
        }
        break;
      case "fence_updates":
        break;
      case "collision_events":
        break;

      default:
        break;
    }
  }
});
