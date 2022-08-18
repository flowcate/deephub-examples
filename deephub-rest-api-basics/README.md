# DeepHub® Example: REST API with Python
This example will introduce the very basics of how to use Python to communicate with the DeepHub via REST requests.
The example thereby covers:
- Checking the health of a DeepHub instance.
- Creating objects via REST.
- Retrieving objects via REST.
- Updating objects via REST.
- Sending location updates via REST.
- Observing the output on the DeepHub UI.


### The Example Case
A pallet being moved by a truck and a forklift, alternately.
The truck and forklift are each represented by a location provider.
The pallet is represented by a trackable.
Location updates are sent for each of the location providers, while the trackable is updated regularly with the according provider id.


## Requirements
- The DeepHub is expected to be running based on [deephub-basic-setup](https://github.com/flowcate/deephub-basic-setup).
  - DeepHub: http://localhost:8081/deephub/version
  - DeepHub UI: http://localhost:8081/deephub-ui/buildinfo.json
- In addition, [python3](https://www.python.org/) and the following Python packages are required:
  - [ujson](https://pypi.org/project/ujson/)
  - [requests](https://pypi.org/project/requests/)

With many Python installations, you should be able to install these packages with:
<br>`python -m pip install ujson requests`


## Running the Example
To start the example, all that is required is executing the provided example Python file:
<br>`python deephub-rest-api-basics.py`

The example can be stopped by sending a SIGINT to the process, typically by pressing `Ctrl+C`.

Once started, you will see the output of the example in the [DeepHub UI](http://localhost:8081/deephub-ui/map/system/live/(show//left:list)?lng=8.6755311&lat=49.4162116&zoom=19.24).


## Explaining the Code
The import section of example1.py contains one noteworthy entry, that is:
```python
import DeepHubClasses as dh
```
This imports minimalist class definitions for entities like zones, fences, trackables, and so on.
These classes can be constructed from and serialized to Json.
The implementation is thereby focused on simplicity for the context of this example.
As such, these classes only scratch the surface of what the DeepHub has to offer.
Since these implementations are mostly Python specific, we will not discuss them in further detail.
Have a look at [DeepHubClasses.py](DeepHubClasses.py) if you want to know more.

The first and most important variable is the url at which the DeepHub is running.
```python
url = 'http://localhost:8081/deephub/v1'
```
Adjust this accordingly if you are not running the [deephub-basic-setup](https://github.com/flowcate/deephub-basic-setup).

The main function will then setup the example and run an endless loop sending location updates and attaching the trackable to the respective location providers.
The key aspects of how this is done are highlighted below.


### Checking the Health
One of the first functions to be called is a check to confirm the url of the DeepHub, using the `/health` API.
```python
def is_healthy():
    try:
        return rest.get(url + "/health").status_code == 200
    except:
        print('Could not find a DeepHub instance running at', url)
        False
```
The health API does not answer with any data on a GET request, but instead only the return code is checked.
If it is 200, then the DeepHub is answering and we return True.
If the return code differs or the connection failed for some other reason (exception), we return False.


### Creating an Object
During setup the example needs to create multiple objects in the DeepHub.
```python
zone = dh.Zone()
zone.name = 'Area'
zone.foreign_id = zone_foreign_id
rest.post(url + '/zones', zone.to_json())
```
We start by creating a python object dh.Zone.
Then, we set the properties we want, in this case *name* and *foreign_id*.
And finally, we send a POST request to `/zones` with the Json string of the zone we want to create.
This is all we need to create a zone in the DeepHub.
All objects are then created in this manner.

Creating the Trackable uses some further functionality:
```python
response = rest.post(url + '/trackables', trackable_pallet.to_json())
# Obtain the trackables UUID from the response.
trackable_id_pallet = response.json()['id']
trackable_url = url + '/trackables/' + trackable_id_pallet
```
We will need this trackable's id to update it later.
Therefore, we store the response of the POST request to obtain the id of the trackable that has been created in the DeepHub.


### Retrieving and Updating an Object
In this example, the pallet is moved over from a truck to a forklift.
In the DeepHub, this is represented by the trackable being associated with the respective location provider.
To implement the hand over from one to the other, we therefore have to update the *location_providers* property of the trackable.
```python
def attach_pallet_to_provider(provider_id: str):
    trackable_pallet = dh.Trackable(rest.get(trackable_url).json())
    trackable_pallet.location_providers = [provider_id]
    rest.put(trackable_url, trackable_pallet.to_json())
```
We use the previously determined trackable_url to retrieve the current trackable with a GET request and construct dh.Trackable object.
We then update the *location_providers* property to the new provider id, before updating the trackable in the DeepHub with a PUT request.


### Sending Location Updates
There are multiple ways how location updates can be sent to the DeepHub.
In this example we use PUT requests to `/providers/locations`.
This API endpoint expects a list of location objects and processes them in a batch.
As such, the request syntax is very similar to the previously discussed updating of an object.
```python
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
            time.sleep(0.1)
```
We start by creating a dh.Location object with the id of the provider we want to update.
If the provider is of type GPS, the coordinate reference system (crs) of the locations is EPSG:4326.
Otherwise the crs is local.
The coordinates for the locations are stored in separate files as comma separated values.
Then, line by line, the coordinates are taken from the file to update the dh.Location object.
Finally, we send the location update as a PUT request and wait a short moment.


### First Run Check
The setup function starts by checking whether the example has been run in the past.
```python
if len(rest.get(url + '/zones' + '?foreign_id=' + zone_foreign_id).json()) > 0:
        trackable_id_pallet = rest.get(url + '/trackables').json()[0]
        trackable_url = url + '/trackables/' + trackable_id_pallet
        return
```
It does so by querying the DeepHub for a zone with a given *foreign_id* by adding the query parameter `?foreign_id=mathematikon.example1.zone` to the request.
If this returns a zone, we determine the id of the Trackable.
For simplicity, we assume that the first Trackable is the one we want.
With this id, construct the trackable_url as mentioned above, and leave the setup function.
