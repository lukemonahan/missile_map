# Missile Map

This visualisation will show connected arcs on a map. Each arc is defined by two geographic points, and can have a color assigned. Additionally the arcs can be animated, with the pulsing animation being either at the start or the end of the arc.

Globally, the arc thickness, default color and map tileset can be chosen, as well as the starting map position and zoom.

This visualisation is based upon leaflet.migrationLayer by react-map: https://github.com/react-map/leaflet.migrationLayer

Some use cases could be:

 * Show data replication links between sites and their status
 * Show a representation of incoming attacks or requests

 Note: If any lines are animated this will result in heightened browser CPU usage.

# Search and data formatting

The visualisation looks for fields of the following names:

  * start_lat: The starting point latitude (required)
  * start_lon: The starting point longitude (required)
  * end_lat: The ending point latitude (required)
  * end_lon: The ending point latitude (required)
  * color: The color of the arc in hex format (optional, default "#FF0000")
  * animate: Whether to animate this arc (optional, default "false")
  * pulse_at_start: When animated, set to true to cause the pulse to be at the start of the arc instead of the end (optional, default "false")
  * weight: The line weight of the arc (optional, default 1).
  * start_label: A label to put at the start of the arc. If multiple arcs start at the same point, then this should be the same for each of those arcs to display properly
  * end_label: A label to put at the end of the arc. If multiple arcs end at the same point, then this should be the same for each of those arcs to display properly.

 The fields must be named in this way, but they are not order dependent.

 An example dataset is distributed as a lookup to experiment with.

 ```
 | inputlookup missilemap_testdata
 ```

 # Customisation options

The following options are available to customise:

 * Lines
 	* Default color: The color to use for a line when no "color" field is present in the data (default: #65a637)
 	* Weight: The weight to use for a line when no "weight" field is present in the data (default: 1)
 * Map
 	* Tile set: The map tiles to use
 	* Custom tile set: If you wish to use a tile set not in the preset list (e.g. http://tile.stamen.com/toner/{z}/{x}/{y}.png)
 	* Latitude: Starting latitude to load
 	* Longitude: Starting longitude to load
 	* Zoom: Starting zoom level to load
  * Show Labels: Toggle to show/hide custom labels (default), latitude and longitude labels, or no labels

## Drilldown
To enrich your dashboards with some interactivity, [enable drilldown in your dashboard panel](https://docs.splunk.com/Documentation/Splunk/latest/Viz/DrilldownIntro#Access_the_drilldown_editor)

```xml
    <option name="drilldown">all</option>
    <drilldown>
      <set token="latitude">$row.start_lat$</set>
      <set token="longitude">$row.start_lon$</set>
      <set token="label">$row.start_label$</set>
    </drilldown>
```

Assuming the configuration above, by clicking on any arc startpoint in your map, that bunch of tokens will be set. Those tokens can then be used within your dashboard in another panel or visualisation.

The map exposes via drilldown the following field values: `start_lat`, `start_lon` and `start_label`


# Support contact

This visualisation was developed at Tesserent.

http://tesserent.com
luke.monahan@tesserent.com

# Software credits

LeafletJS: http://leafletjs.com/
Used under BSD license (https://github.com/Leaflet/Leaflet/blob/master/LICENSE)

leaflet.migrationLayer: https://github.com/react-map/leaflet.migrationLayer
Used under MIT license (https://github.com/react-map/leaflet.migrationLayer/blob/master/LICENSE)

# Authors
Luke Monahan <luke.monahan@tesserent.com>
Erica Pescio <epescio@splunk.com>
