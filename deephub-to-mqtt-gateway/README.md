# DeepHub® to MQTT Gateway with Sparkplug in Node.js

This example is intended to show how quickly you can get data from the DeepHub to an MQTT broker via WebSocket. The data is converted from JSON to Sparkplug.

## Requirements

- The DeepHub is expected to be running based on [deephub-basic-setup](https://github.com/flowcate/deephub-basic-setup).
  - DeepHub: http://localhost:8081/deephub/version
  - DeepHub UI: http://localhost:8081/deephub-ui/buildinfo.json
- You will need [nodejs](https://nodejs.org/) and [docker compose](https://docs.docker.com/compose/install/)
- Start a system that generates location updates, e.g. one of the examples provided within this repo (parallel directory):
  - "deephub-rest-api-basics" or
  - "deephub-warehouse-use-case"

## Install node Modules

```
npm i
```

## Running the Example

### Start your Example

This MQTT example requires some location updates to be processed by the DeepHub.
You can either send these location updates yourself, or you can start one of the examples mentioned in [requirements](#requirements)

### Docker Compose

Start the MQTT server via Docker Compose.

```
docker-compose up
```

### MQTT

Start subscribing to MQTT.

```
node ./sub.js
```

Start publishing to MQTT.

```
node ./pub.js
```

#### Note

If your DeepHub instance is processing location updates, you should now see them in the console output for the `node ./sub.js` process. If you don't, you may use one of the simulation examples mentioned above to generate location updates.

## For the sake of simplicity, these aspects have not been implemented

- the "properties" field for locations updates
- trackable motions
- fence events
- collision events
