/*
 * Visualization source
 */
define([
        'jquery',
        'underscore',
        'leaflet',
        'api/SplunkVisualizationBase',
        'api/SplunkVisualizationUtils',
        '../contrib/leaflet.migrationLayer'
        ],
        function(
            $,
            _,
            L,
            SplunkVisualizationBase,
            vizUtils
        ) {    

        var TILE_PRESETS = {
            'satellite_tiles': {
                minZoom: 1,
                maxZoom: 19,
                url: 'http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            },
            'openstreetmap_tiles': {
                minZoom: 1,
                maxZoom: 19,
                url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            
            },
            'light_tiles': {
                minZoom: 1,
                maxZoom: 19,
                url: 'http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
            }, 
            'dark_tiles': {
                minZoom: 1,
                maxZoom: 19,
                url: 'http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
            },
            'splunk': {
                minZoom: 1,
                maxZoom: 19,
                url: '/splunkd/__raw/services/mbtiles/splunk-tiles/{z}/{x}/{y}'
            },
            'splunk_dark': {
                minZoom: 1,
                maxZoom: 19,
                url: '/splunkd/__raw/services/mbtiles/splunk-tiles-dark/{z}/{x}/{y}'
            }
        };

        const REQUIRED_FIELDS = ["start_lat", "start_lon", "end_lat", "end_lon"];

    // Extend from SplunkVisualizationBase
    return SplunkVisualizationBase.extend({

        maxResults: 50000,
        COLORS: vizUtils.getColorPalette('splunkCategorical'),

        initialize: function() {
            SplunkVisualizationBase.prototype.initialize.apply(this, arguments);
            $(this.el).addClass('missile-map');
            this.isInitializedDom = false;
        },

        // Optionally implement to format data returned from search. 
        // The returned object will be passed to updateView as 'data'
        formatData: function(data) {
            var dataResults = data.results;
            if (!dataResults || dataResults.length === 0 || dataResults[0].length === 0) {
                return;
            }

            var dataFields = data.fields;

            // Variables to handle format changes
            var config = this.getCurrentConfig();
            var staticColor = this._getEscapedProperty('staticColor', config) || "#65a637";
            var lineThickness = parseInt(this._getEscapedProperty('lineThickness', config) || 1);

            // Verify required fields availability from search
            REQUIRED_FIELDS.forEach(field => {
                let match = dataFields.filter(function (f) {
                    return f.name === field;
                });
                if (match.length <= 0) {
                    throw new SplunkVisualizationBase.VisualizationError(
                        'This visualization requires the following fields [' + REQUIRED_FIELDS + ']. Please check your SPL search.'
                    );
                }
            });

            let formatted = dataResults.map(function (d) {
                var end_lat = parseFloat(d.end_lat);
                var end_lon = parseFloat(d.end_lon);
                var start_lat = parseFloat(d.start_lat);
                var start_lon = parseFloat(d.start_lon);
                var color = !("color" in d) ? staticColor : vizUtils.escapeHtml(d.color);
                var animate = !("animate" in d) ? true : vizUtils.normalizeBoolean(d.animate);
                var pulse_at_start = !("pulse_at_start" in d) ? false : vizUtils.normalizeBoolean(d.pulse_at_start);
                var weight = !("weight" in d) || (lineThickness != this.activeLineThickness) ? lineThickness : d.weight;
                var start_label = !("start_label" in d) ? "" : d.start_label;
                var end_label = !("end_label" in d) ? "" : d.end_label;

                if (animate === true && !this.animated) {
                    this.animated = animate;
                }

                return {
                    "from": [start_lon, start_lat],
                    "to": [end_lon, end_lat],
                    "labels": [start_label, end_label],
                    "color": color,
                    "animate": animate,
                    "pulse_at_start": pulse_at_start,
                    "weight": weight
                };
            });

            let retVal = {
                "fields": REQUIRED_FIELDS.filter(field => { return field.startsWith("start"); }),
                "formatted": formatted,
                "raw": data
            }
            retVal.fields.push("start_label");

            return retVal;
        },
  
        // Implement updateView to render a visualization.
        //  'data' will be the data object returned from formatData or from the search
        //  'config' will be the configuration property object
        updateView: function(data, config) {
            if (!data) {
                return this;
            }

            var tileset = this._getEscapedProperty('tileSet', config) || 'splunk'
            var tileConfig  = TILE_PRESETS[tileset];
            var url         = tileConfig.url,
                maxZoom     = tileConfig.maxZoom,
                minZoom     = tileConfig.minZoom,
                attribution = tileConfig.attribution;

            var customTileset = this._getEscapedProperty('customTileSet', config) || ''
            if (customTileset) {
                url = customTileset;
                maxZoom = 19;
                minZoom = 1;
                attribution = "";
            }

            var updateTiles = url !== this.activeTileset;

            var that = this;
            var formatted = data.formatted;
            var animated = this.animated = false;

            var lat         = this._getEscapedProperty('mapLatitude', config) || 35,
                lon         = this._getEscapedProperty('mapLongitude', config) || -95,
                zoom        = this._getEscapedProperty('mapZoom', config) || 5

            var showLabels  = Splunk.util.normalizeBoolean(this._getEscapedProperty('showLabels', config) || true);

            if (this.lat != lat || this.lon != lon || this.zoom != zoom) updateBounds = true;
            else updateBounds = false;

            var lineThickness = parseInt(this._getEscapedProperty('lineThickness', config) || 1);
            var updateLineWidth = lineThickness != this.activeLineThickness;
            var updateShowLabels = (this.activeShowLabels !== undefined) ? 
                                        (showLabels != this.activeShowLabels) : false; 
            var scrollWheelZoom = Splunk.util.normalizeBoolean(this._getEscapedProperty('scrollWheelZoom', config) || true)

            this.useDrilldown = this._isEnabledDrilldown(config);

    		if (!this.isInitializedDom) {
                var map = this.map = L.map(this.el, { zoomSnap: 0.1, scrollWheelZoom: scrollWheelZoom }).setView([lat, lon], zoom);

                this.tileLayer = L.tileLayer(url, {
                    attribution: attribution
                }).addTo(map);

                var migrationLayer = this.migrationLayer = new L.migrationLayer({ map: map, arcLabel: false, arcWidth: lineThickness });
                migrationLayer.addTo(map);

    			this.isInitializedDom = true;
    		} else {
                if (updateTiles || updateLineWidth || updateBounds || updateShowLabels) {

                    this.migrationLayer.destroy();
                    var migrationLayer = this.migrationLayer = new L.migrationLayer({ map: this.map, arcLabel: false, arcWidth: lineThickness });
                    migrationLayer.addTo(this.map);

                    this.map.removeLayer(this.tileLayer);
                    this.tileLayer = L.tileLayer(url, {
                        attribution: attribution
                    }).addTo(this.map);

                    if (updateBounds) {
                        this.map.setView([lat, lon], zoom);
                        this.lat = lat;
                        this.lon = lon;
                        this.zoom = zoom;
                    }

                    if (minZoom <= maxZoom) {
                        this.map.options.maxZoom = maxZoom;
                        this.map.options.minZoom = minZoom;

                        if (this.map.getZoom() > maxZoom) {
                            this.map.setZoom(maxZoom);
                        }
                        else if (this.map.getZoom() < minZoom) {
                            this.map.setZoom(minZoom);
                        } else {
                            this.map.fire('zoomend');
                        }
                    }
                    this.activeTileset = url;
                    this.activeLineThickness = lineThickness;
                    this.activeShowLabels = showLabels;
                }
            }

            // Creating a LayerGroup to contain all markers providing new features to the map
            if (this.markersGroup) {
                this.markersGroup.clearLayers();
            }
            var markersGroup = this.markersGroup = L.layerGroup();
            this.map.addLayer(markersGroup);
            
            // NOTE
            // Since start markers will have drilldown functionality, we draw end markers before start ones 
            // to let drilldown be available on the top layer

            // Get unique end markers only
            const markersDest = [...new Map(formatted.map(v => [v.to[0], v] && [v.to[1], v])).values()];
            markersDest.forEach(element => {
                // Add transparent end markers to the layer group to provide tooltips
                let text = "Lat: " + element.to[1] + "\nLon: " + element.to[0];
                let markerText = element.labels[1] === "" ? text : element.labels[1];
                let marker = L.marker([element.to[1], element.to[0]])
                    .setOpacity(0)
                    .bindTooltip(markerText, {
                        offset: L.point({ x: -10, y: 20 }),
                        permanent: 'true'
                    })
                    .addTo(markersGroup);
                // Show/hide tooltips
                if (showLabels) {
                    marker.openTooltip();
                } else {
                    marker.closeTooltip();
                }
            });

            // Get unique start markers only
            const markersSrc = [...new Map(formatted.map(v => [v.from[0], v] && [v.from[1], v])).values()];
            markersSrc.forEach(element => {
                // Add transparent start markers to the layer group to provide tooltips and drilldown functionalities
                let text = "Lat: " + element.from[1] + "\nLon: " + element.from[0];
                let markerText = element.labels[0] === "" ? text : element.labels[0];
                let marker = L.marker([element.from[1], element.from[0]])
                    .setOpacity(0)
                    .bindTooltip(markerText, {
                        offset: L.point({ x: -10, y: 20 }),
                        permanent: 'true'
                    })
                    .addTo(markersGroup);
                // Show/hide tooltips
                if (showLabels) {
                    marker.openTooltip();
                } else {
                    marker.closeTooltip();
                }
                // Bind to drilldown
                marker.on("click", that._drilldown.bind(this, element));
            });

            this.migrationLayer.setData(formatted);

            if (animated) this.migrationLayer.play();
            else this.migrationLayer.pause(); // Save CPU if nothing animating

            return this;
        },

        _isEnabledDrilldown: function (config) {
            return (config['display.visualizations.custom.drilldown'] &&
                config['display.visualizations.custom.drilldown'] === 'all');
        },

        _drilldown: function (data) {
            var fields = this.getCurrentData().fields;
            var drilldownDescription = {
                action: SplunkVisualizationBase.FIELD_VALUE_DRILLDOWN,
                data: {}
            };

            // Mapping data
            let d = {
                "start_label": data.labels[0],
                "start_lon": data.from[0],
                "start_lat": data.from[1]
            }

            fields.forEach(field => {
                drilldownDescription.data[field] = d[field];
            })

            this.drilldown(drilldownDescription);
        },

        // Search data params
        getInitialDataParams: function() {
            return ({
                outputMode: SplunkVisualizationBase.RAW_OUTPUT_MODE,
                count: this.maxResults
            });
        },

        // Override to respond to re-sizing events
        reflow: function() {
            if (this.map) {
                this.map.invalidateSize();
            }
        },

        _getEscapedProperty: function(name, config) {
            var propertyValue = config[this.getPropertyNamespaceInfo().propertyNamespace + name];
            return vizUtils.escapeHtml(propertyValue);
        }
    });
});
