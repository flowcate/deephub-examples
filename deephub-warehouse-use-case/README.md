# DeepHub® Warehouse Operation Example with Node.js

This example highlights several processes of a modern factory:

- A product has been produced and must be transported to a storage location on-site.
- A truck enters a loading zone and must be loaded with specific goods.
- Forklifts pick up the goods from their storage location and bring them to a shipping ramp.
- A hydraulic hand pallet truck brings goods from the shipping ramp to the loading zone where the truck is parked.

## Requirements

- The DeepHub is expected to be running based on [deephub-basic-setup](https://github.com/flowcate/deephub-basic-setup).
  - DeepHub: http://localhost:8081/deephub/version
  - DeepHub UI: http://localhost:8081/deephub-ui/buildinfo.json
- You will need [nodejs](https://nodejs.org/)

## Install node Modules

```
npm i
```

## init project

```
node ./addZone.js
node ./addFences.js
node ./addProviders.js
```

## Start the Example

Start all processes at once.

```
// start all processes
npm run start

// stop all processes
npm run stop
```

Start all processes individually.

```
# First delete all trackables to ensure a clean environment ()
curl -X DELETE localhost:8081/deephub/v1/trackables

# Then start each of the processes in separate terminals
node ./production.js
node ./storagePlace.js
node ./shippingTruck.js
node ./pickTruck.js
node ./moveTruck.js
```
