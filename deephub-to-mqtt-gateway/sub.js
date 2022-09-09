import mqtt from "mqtt";
import sparkplug from "sparkplug-payload";

const mqttClient = mqtt.connect("mqtt://localhost");
const spPayload = sparkplug.get("spBv1.0");
/**
 *
 * @param {Number[]} payload Sparkplug B encoded Payload
 * @returns {Object} decoded JSON object
 */
function sparkplugDecode(payload_) {
  var buffer = Buffer.from(payload_);
  return spPayload.decodePayload(buffer);
}

mqttClient.on("connect", function () {
  console.log("mqtt sub connect");

  mqttClient.subscribe(
    "spBv1.0/deephub/DDATA/location_updates/#",
    function (err) {
      if (err) {
        console.error(err);
      }
    }
  );
});

mqttClient.on("message", function (topic, message) {
  // message is Buffer
  const decoded = sparkplugDecode(message);
  console.log(topic, decoded);
});
