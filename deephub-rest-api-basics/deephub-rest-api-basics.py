#!/usr/bin/env python3
import time
import threading
import requests as rest
import DeepHubClasses as dh


# The URL at which the DeepHub is running. Adjust this accordingly if running the DeepHub at some other URL.
url = 'http://localhost:8081/deephub/v1'

# A constant to improve readability of the code
REVERSE = True

# An id used for identifying the zone created for this example.
zone_foreign_id = 'mathematikon.example1.zone'

# The id of the location provider of the example's truck.
provider_id_truck = 'TRUCK_GPS_HARDWARE_ID'

# The ids of the location providers of the example's forklift.
provider_id_forklift_gps = 'FORKLIFT_GPS_HARDWARE_ID'
provider_id_forklift_uwb = 'FORKLIFT_UWB_TAG_ID'

# The URL to access the example's trackable. This requires the UUID of the trackable found in the DeepHub and is set during setup.
trackable_url: str


#
# The main function running the example.
#
def main():
    # Confirm that the DeepHub can be contacted.
    if not is_healthy():
        return

    # Setup the example environment.
    print('Setting up the example.')
    setup()

    # Run the example in a loop.
    print('Running the example loop.')
    while True:
        # The pallet is loaded onto the truck, which then drives off.
        attach_trackable_to_provider(provider_id_truck)
        time.sleep(1)
        truck_thread = threading.Thread(target=send_location_updates,
                                        args=[provider_id_truck, 'gps',
                                              'truckGpsCoordinates.txt'],
                                        daemon=True)
        # The forklift drives to the delivery area.
        fork_gps_thread = threading.Thread(target=send_location_updates,
                                           args=[provider_id_forklift_gps, 'gps',
                                                 'forkliftGpsCoordinates.txt'],
                                           daemon=True)
        fork_uwb_thread = threading.Thread(target=send_location_updates,
                                           args=[provider_id_forklift_uwb, 'uwb',
                                                 'forkliftUwbCoordinates.txt'],
                                           daemon=True)
        fork_gps_thread.start()
        fork_uwb_thread.start()
        truck_thread.start()

        # Wait for both vehicles to finish their current movement.
        fork_gps_thread.join()
        fork_uwb_thread.join()
        truck_thread.join()

        # The forklift loads the pallet and drives to the drop off point.
        attach_trackable_to_provider(provider_id_forklift_uwb)
        time.sleep(1)
        fork_gps_thread = threading.Thread(target=send_location_updates,
                                           args=[provider_id_forklift_gps, 'gps',
                                                 'forkliftGpsCoordinates.txt', REVERSE],
                                           daemon=True)
        fork_uwb_thread = threading.Thread(target=send_location_updates,
                                           args=[provider_id_forklift_uwb, 'uwb',
                                                 'forkliftUwbCoordinates.txt', REVERSE],
                                           daemon=True)
        # The truck drives back to the drop off point.
        truck_thread = threading.Thread(target=send_location_updates,
                                        args=[provider_id_truck, 'gps',
                                              'truckGpsCoordinates.txt', REVERSE],
                                        daemon=True)
        fork_gps_thread.start()
        fork_uwb_thread.start()
        truck_thread.start()

        # Wait for both vehicles to finish their current movement.
        fork_gps_thread.join()
        fork_uwb_thread.join()
        truck_thread.join()


#
# Check whether a DeepHub instance is available at the given URL.
#
def is_healthy():
    try:
        return rest.get(url + "/health").status_code == 200
    except:
        print('Could not find a DeepHub instance running at', url)
        False


#
# Initialize all the example entities in the DeepHub.
#
def setup():
    global trackable_url

    # Check whether the example's entities exist already.
    zones         = rest.get (url + '/zones' + '?foreign_id=' + zone_foreign_id).json() 
    fences        = rest.get (url + '/fences').json() 
    trackables    = rest.get (url + '/trackables').json() 
    providers     = rest.get (url + '/providers').json() 

    # Setup the example's zone.
    if (len (zones) < 1):
      zone = dh.Zone()
      zone.name = 'Area'
      zone.foreign_id = zone_foreign_id
      rest.post(url + '/zones', zone.to_json())
    else:
      print('Found an example zone. Using existing setup.')

    # Setup the example's fences.
    if (len (fences) < 1):
      delivery_fence = dh.Fence(region=dh.Polygon())
      delivery_fence.name = 'Delivery'
      rest.post(url + '/fences', delivery_fence.to_json())

      drop_fence = dh.Fence(region=dh.Point())
      drop_fence.name = 'Drop'
      drop_fence.radius = 2
      rest.post(url + '/fences', drop_fence.to_json())
    else:
      print('Found example fences. Using existing setup.')

    # Setup the example's providers for the truck and forklift.
    if (len (providers) < 1):
      provider_truck_gps = dh.LocationProvider(id=provider_id_truck)
      provider_truck_gps.name = 'Truck GPS'
      provider_truck_gps.type = 'gps'
      rest.post(url + '/providers', provider_truck_gps.to_json())

      provider_forklift_gps = dh.LocationProvider(id=provider_id_forklift_gps)
      provider_forklift_gps.name = 'Forklift GPS'
      provider_forklift_gps.type = 'gps'
      rest.post(url + '/providers', provider_forklift_gps.to_json())

      provider_forklift_uwb = dh.LocationProvider(id=provider_id_forklift_uwb)
      provider_forklift_uwb.name = 'Forklift UWB'
      provider_forklift_uwb.type = 'uwb'
      rest.post(url + '/providers', provider_forklift_uwb.to_json())
    else:
      print('Found example location providers. Using existing setup.')

    # Setup the example's trackable.
    if (len (trackables) < 1):
      trackable_pallet = dh.Trackable()
      trackable_pallet.name = 'Pallet'
      trackable_pallet.radius = 1
      response = rest.post(url + '/trackables', trackable_pallet.to_json())

      # Obtain the trackables UUID from the response.
      trackable_id_pallet = response.json()['id']
      trackable_url = url + '/trackables/' + trackable_id_pallet
    else:
      print('Found example trackables. Using existing setup.')
      trackable_id_pallet = trackables[0]
      trackable_url = url + '/trackables/' + trackable_id_pallet

#
# Send location updates for the provider with the given id from the given file.
#
def send_location_updates(provider_id: str, provider_type: str, file: str, reverse: bool = False):
    location = dh.Location(provider_id=provider_id,
                           provider_type=provider_type)
    if provider_type == 'gps':
        location.crs = 'EPSG:4326'
    else:
        location.source = zone_foreign_id

    with open(file) as input:
        if reverse:
            input = reversed(list(input))
        for coordinates in [list(map(float, line.split(sep=','))) for line in input]:
            location.position = dh.Point(coordinates=coordinates)
            rest.put(url + '/providers/locations', location.to_json_list())
            time.sleep(0.05)


#
# Update the pallet trackable such that it is attached to the provider with the given id.
#
def attach_trackable_to_provider(provider_id: str):
    trackable_pallet = dh.Trackable(rest.get(trackable_url).json())
    trackable_pallet.location_providers = [provider_id]
    rest.put(trackable_url, trackable_pallet.to_json())


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print('\nStopped')
