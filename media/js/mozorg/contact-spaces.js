/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
    "use strict";

    function accordion() {
      $('.accordion .submenu').hide();
//      $('.accordion .submenu:first').show().parent().addClass('open'); // open first submenu
      $('.accordion .hasmenu > a').on('click', function(e) {
        e.preventDefault();
        var next = $(this).next();
        if((next.is('.submenu')) && (next.is(':visible'))) {
            next.slideUp().parent().removeClass('open');
        }
        if((next.is('.submenu')) && (!next.is(':visible'))) {
            $('.accordion .submenu:visible').slideUp().parent().removeClass('open');
            next.slideDown().parent().addClass('open');
        }
      });
    }
    // Call it once onload to initialize
    accordion();

})();

(function($) {
    "use strict";

    var map = null;
    var xhr = null;
    var initContentId = null;
    var initialTabStateId = null;
    var contentCache = [];
    var topPane = null;
    var topLayer = null;

    // Community Layers
    var northAmerica;
    var latinAmerica;
    var europe;
    var asiaSouthPacific;
    var antarctica;
    var africaMiddleEast;
    var hispano;
    var francophone;
    var communityLayers;
    var layers = {};

    var mozMap = {
        /*
         * Initialize mapbox and set default control values.
         * This should only be called once on page load.
         */
        init: function () {
            var touch = L.Browser.touch || L.Browser.msTouch;
            // use mozilla map style layer.
            map = L.mapbox.map('map', 'mozilla-webprod.e91ef8b3', {
                zoomControl: !touch
            });
            // disable map zoom on scroll.
            map.scrollWheelZoom.disable();
            // set initial page nav state
            mozMap.setInitialPageNavState();
            // initialize spaces markers
            mozMap.initSpacesMarkers();
            // initialize community layers
            mozMap.initCommunityLayers();
            // set the initial map state on page load.
            mozMap.setMapState();
            // set initial map content
            mozMap.setInitialContentState();
            // bind events on tab navigation
            mozMap.bindTabNavigation();
            // init history.js
            mozMap.bindHistory();
            // split the label layer for more control
            mozMap.splitLabelLayer();
            // disable dragging for touch devices
            if (touch) {
                // disable drag and zoom handlers
                map.dragging.disable();
                map.touchZoom.disable();
                map.doubleClickZoom.disable();
                // disable tap handler, if present.
                if (map.tap) map.tap.disable();
            }
        },

        /*
         * Sets the initial active tab and nav items on page load
         * using the id and data-tab attribute of the entry section element
         */
        setInitialPageNavState: function () {
            var $entry = $('#entry-container .entry');
            var tab = $entry.data('tab');
            var id = $entry.attr('id');

            //set the current tab navigation item
            $('ul.category-tabs li[data-id="' + tab + '"]').addClass('current');

            // set the current list menu navigation item
            if (tab === 'spaces') {
                $('#nav-spaces, #meta-spaces').show();
                $('#nav-spaces li[data-id="' + id + '"]').addClass('current');
            } else if (tab === 'communities') {
                $('#nav-communities, #meta-communities').show();
                $('#nav-communities li[data-id="' + id + '"]').addClass('current');
            }
        },

        /*
         * Initialize history.js for pushState support
         */
        bindHistory: function () {
            // Bind to statechange event. Note: We are using statechange instead of popstate
            History.Adapter.bind(window, 'statechange', function () {
                // Note: We are using History.getState() instead of event.state
                var state = History.getState();
                var current = mozMap.getMapState();

                // check if we need to change the map state
                if (current !== state.data.tab) {
                    mozMap.updateTabState(state.data.tab);
                }

                if (state.data.tab === 'spaces') {
                    // Hide community nav+meta and show spaces nav+meta
                    $('#nav-communities, #meta-communities').fadeOut(100, function(){ $('#nav-spaces, #meta-spaces').show(); });
                    // Update current nav item to the active space
                    mozMap.updateSpaceNavItem(state.data.id);
                    // Show the space based on event state url
                    mozMap.showSpace(state.url, state.data.id);
                } else if (state.data.tab === 'communities') {
                    // Hide spaces nav+meta and show community nav+meta
                    $('#nav-spaces, #meta-spaces').fadeOut(100, function(){ $('#nav-communities, #meta-communities').show(); });
                    // Update community region on the map
                    mozMap.updateCommunityNavItem(state.data.id);
                    mozMap.showCommunityContent(state.url, state.data.id);
                }
            });
        },

        /*
         * Bind the main tab navigation for toggling spaces
         * and communities. Only needs to be called once
         */
        bindTabNavigation: function () {
            $('.category-tabs li a').on('click', mozMap.onTabNavigationClick);
        },

        /*
         * When tab navigation is clicked we need to do push state
         */
        onTabNavigationClick: function (e) {
            e.preventDefault();
            var itemId = $(this).parent().data('id');
            var itemUrl = this.href;
            var state = mozMap.getMapState();

            // Push the new url and update browser history
            History.pushState({
                id: itemId,
                tab: itemId
            }, document.title, itemUrl);
        },

        /*
         * Stores initial content id and tab id on page load
         */
        setInitialContentState: function () {
            // store initial content data id on page load
            var state = mozMap.getMapState();
            if (state === 'spaces') {
                initContentId = $('#nav-spaces li.current').data('id');
                // Show spaces nav+meta
                $('#nav-spaces, #meta-spaces').show();
                //show the current space marker
                mozMap.showSpace();
            } else if (state === 'communities') {
                initContentId = $('#nav-communities li.current').data('id');
                // Show community nav+meta
                $('#nav-communities, #meta-communities').show();
                // show the community region
                mozMap.showCommunityContent();
            }
            //store ref to initial tab state
            initialTabStateId = state;
        },

        /*
         * Get the current map state
         * Return values are either 'spaces' or 'communities'
         */
        getMapState: function () {
            return $('ul.category-tabs li.current').data('id');
        },

        /*
         * Sets the map state based on the active category tab.
         * Determined using data-id attribute and .current list item.
         */
        setMapState: function () {
            var state = mozMap.getMapState();
            if (state === 'spaces') {
                //clear commuity layers
                mozMap.clearCommunityLayers();
                // unbind click events on community nav
                mozMap.unbindCommunityNav();
                // add spaces marker layer.
                mozMap.addSpacesMarkers();
                // bind click events on spaces nav
                mozMap.bindSpacesNav();
                // hide community legend
                mozMap.hideMapLegend();
                // reposition markers above the labels
                mozMap.setLabelLayerIndex(1);
            } else if (state === 'communities') {
                // remove spaces markers
                mozMap.removeSpacesMarkers();
                // unbind click events on spaces nav
                mozMap.unbindSpacesNav();
                // bind click events on community nav
                mozMap.bindCommunityNav();
                // hide community legend
                mozMap.showMapLegend();
                // reposition labels above community layer
                mozMap.setLabelLayerIndex(7);
            }
        },

        /*
         * Creates spaces markers and then hide them using setFilter()
         */
        initSpacesMarkers: function () {
            map.markerLayer.setGeoJSON(window.mozSpaces);
            map.markerLayer.setFilter(function () {
                return false;
            });
        },

        /*
         * Creates a marker layer for office spaces and binds events.
         * Sets an initial panned out view of the world map.
         */
        addSpacesMarkers: function () {
            map.markerLayer.setFilter(function () {
                return true;
            });

            // disable keyboard focus on markers as it messes up panning :(
            // all content is still accessible via keyboard nonetheless
            map.markerLayer.eachLayer(function (marker) {
                L.Util.setOptions(marker, {
                    keyboard: false
                });
            });
            map.markerLayer.on('click', mozMap.onMarkerClick);
            map.markerLayer.on('mouseover', mozMap.openMarkerPopup);
            map.markerLayer.on('mouseout', mozMap.closeMarkerPopup);
            map.setView([37.4, 0], 2);
        },

        /*
         * Removes spaces markers from the map and unbinds events.
         */
        removeSpacesMarkers: function () {
            map.markerLayer.setFilter(function () {
                return false;
            });
            map.markerLayer.off('click', mozMap.onMarkerClick);
            map.markerLayer.off('mouseover', mozMap.openMarkerPopup);
            map.markerLayer.off('mouseout', mozMap.closeMarkerPopup);
            map.setView([37.4, 0], 2);
        },

        /*
         * Creates a custom marker popup with localized text from template nav
         */
        openMarkerPopup: function (e) {
            var id = e.layer.feature.properties.id;
            var $name = $('#nav-spaces li[data-id="' + id + '"]').text();

            e.layer.bindPopup($name, {
                closeButton: false,
                maxWidth: 300
            });

            e.layer.openPopup();
        },

        /*
         * Closes and unbinds the popup
         */
        closeMarkerPopup: function (e) {
            e.layer.closePopup();
            e.layer.unbindPopup();
        },

        /*
         * Programatically finds a marker and clicks it
         * Param: @id marker string identifier
         */
        doClickMarker: function (id) {
            map.markerLayer.eachLayer(function (marker) {
                if (marker.feature.properties.id === id) {
                    marker.fireEvent('click');
                    return;
                }
            });
            // if there's no marker id we set the default zoomed out view
            if (!id) {
                map.setView([37.4, 0], 2);
            }
        },

        /*
         * Bind click events on spaces navigation menu.
         */
        bindSpacesNav: function () {
            $('#nav-spaces li a').on('click', mozMap.onSpacesNavClick);
        },

        /*
         * Unbind click events on spaces navigation menu.
         */
        unbindSpacesNav: function () {
            $('#nav-spaces li a').off('click', mozMap.onSpacesNavClick);
        },

        /*
         * Bind events on top level community navigation menu
         */
        bindCommunityNav: function () {
            $('#nav-communities li.region > a').on('click', mozMap.onCommunityNavClick);
        },

        /*
         * Unbind events on top level community navigation menu
         */
        unbindCommunityNav: function () {
            $('#nav-communities li.region > a').off('click', mozMap.onCommunityNavClick);
        },

        /*
         * Update current spaces nav item and then show the space
         */
        onSpacesNavClick: function (e) {
            e.preventDefault();
            var itemId = $(this).parent().data('id');
            var tabId = 'spaces';
            History.pushState({
                id: itemId,
                tab: tabId
            }, document.title, this.href);
        },

        /*
         * Update top level community nav item and show the region layer
         */
        onCommunityNavClick: function (e) {
            e.preventDefault();
            var itemId = $(this).parent().data('id');
            var tabId = 'communities';
            History.pushState({
                id: itemId,
                tab: tabId
            }, document.title, this.href);
        },

        /*
         * Clears all community map layers
         */
        clearCommunityLayers: function () {
            communityLayers.clearLayers();
        },

        /*
         * Updates the spaces navigation current ite,
         * Param: @id space string identifier
         */
        updateSpaceNavItem: function (id) {
            // return if the tab navigation has been clicked,
            // as we just want to show the landing page
            if (id === 'spaces') {
                $('#nav-spaces li.current').removeClass('current');
                return;
            }

            $('#nav-spaces li.current').removeClass('current');

            if (!id) {
                // if 'id' is undefined then statechange has fired before our first
                // pushState event, so set current item back to the initial content
                // data id when the page loaded.
                $('#nav-spaces li[data-id="' + initContentId + '"]').addClass('current');
            } else {
                $('#nav-spaces li[data-id="' + id + '"]').addClass('current');
            }
        },

        /*
         * Updates the spaces navigation current ite,
         * Param: @id space string identifier
         */
        updateCommunityNavItem: function (id) {
            // return if the tab navigation has been clicked,
            // as we just want to show the landing page
            if (id === 'communities') {
                $('#nav-communities li.current').removeClass('current');
                return;
            }

            $('#nav-communities li.current').removeClass('current');

            if (!id) {
                // if 'id' is undefined then statechange has fired before our first
                // pushState event, so set current item back to the initial content
                // data id when the page loaded.
                $('#nav-communities li[data-id="' + initContentId + '"]').addClass('current');
            } else {
                $('#nav-communities li[data-id="' + id + '"]').addClass('current');
            }
        },

        /*
         * Updates the current active tab and then updates the map state.
         * Param: @tab tab string identifier (e.g. 'spaces' or 'communities').
         */
        updateTabState: function (tab) {
            $('ul.category-tabs li.current').removeClass('current');
            if (!tab) {
                // if 'tab' is undefined then statechange has fired before our first
                // pushState event, so set active tab back to the initial state when
                // the page loaded.
                $('ul.category-tabs li[data-id="' + initialTabStateId + '"]').addClass('current');
            } else {
                $('ul.category-tabs li[data-id="' + tab + '"]').addClass('current');
            }
            mozMap.setMapState();
        },

        /*
         * Focuses map on the marker and shows a popup tooltip
         */
        onMarkerClick: function (e) {
            var $itemId = $('#nav-spaces li.current').data('id');
            var markerId = e.layer.feature.properties.id;

            // if the user clicks on a marker that is not related to the current space
            // we need to do push state to update the page content.
            if (markerId !== $itemId) {
                var url = $('#nav-spaces li[data-id="' + markerId + '"] a').attr('href');
                History.pushState({
                    id: markerId,
                    tab: 'spaces'
                }, document.title, url);
                return;
            }

            // pan to center the marker on the map
            map.setView(e.layer.getLatLng(), 12, {
                animate: true
            });
        },

        /*
         * Show the current active space information.
         * Determined using data-id attribute and .current list item.
         */
        showSpace: function (url, cacheId) {
            var current = $('#nav-spaces li.current');
            // get the current space id and href based on the nav
            var id = current.data('id');
            var contentUrl = url || current.attr('href');

            // if the content is already cached display it
            if (contentCache.hasOwnProperty(cacheId)) {
                $('#entry-container').html(contentCache[cacheId]);
                // programatically find the right marker and click it
                console.log('from ajax');
                mozMap.doClickMarker(cacheId);
            } else if (id === $('section.entry').attr('id')) {
                // if we're already on the right page, just center
                // the marker
                console.log('right page');
                mozMap.doClickMarker(id);
            } else {
                console.log('request content');
                // request content via ajax
                mozMap.requestContent(id, contentUrl);
            }
        },

        /*
         * Toggles community layers on the map
         * Params: @id string region identifier
         */
        showCommunityRegion: function (id) {
            if (layers.hasOwnProperty(id)) {
                mozMap.clearCommunityLayers();
                communityLayers.addLayer(layers[id]);
            }
        },

        /*
         * Show the current active community information.
         * Determined using data-id attribute and .current list item.
         */
        showCommunityContent: function (url, cacheId) {
            var current = $('#nav-communities li.current');
            // get the current space id and href based on the nav
            var id = current.data('id');
            var contentUrl = url || current.attr('href');

            if (contentCache.hasOwnProperty(cacheId)) {
                // if the content is already cached display it
                $('#entry-container').html(contentCache[cacheId]);
                mozMap.showCommunityRegion(cacheId);
            } else if (id === $('section.entry').attr('id')) {
                // if we're already on the right page,
                // just show the map layer
                mozMap.showCommunityRegion(id);
            } else {
                // request content via ajax
                mozMap.requestContent(id, contentUrl);
            }
        },

        /*
         * Initializes geo-json community layers ready for drawing
         */
        initCommunityLayers: function () {

            // create each geoJson layer
            northAmerica = L.geoJson(window.mozNorthAmerica, {
                style: mozMap.styleLayer('#5cb6e0')
            });
            latinAmerica = L.geoJson(window.mozLatinAmerica, {
                style: mozMap.styleLayer('#f36261')
            });
            europe = L.geoJson(window.mozEurope, {
                style: mozMap.styleLayer('#7dc879')
            });
            asiaSouthPacific = L.geoJson(window.mozAsiaSouthPacific, {
                style: mozMap.styleLayer('#c883c5')
            });
            antarctica = L.geoJson(window.mozAntarctica, {
                style: mozMap.styleLayer('#a1b2b7')
            });
            africaMiddleEast = L.geoJson(window.mozAfricaMiddleEast, {
                style: mozMap.styleLayer('#eb936e')
            });
            hispano = L.geoJson(window.mozHispano, {
                style: mozMap.styleLayer('white', '#666', 0.1, 5),
                stroke: false
            });
            francophone = L.geoJson(window.mozFrancophone, {
                style: mozMap.styleLayer('white', '#666', 0.1, 5),
                stroke: false
            });

            // create an empty layer group and add it to the map
            communityLayers = new L.FeatureGroup();
            communityLayers.addTo(map);

            // Store a lookup key for each layer object
            layers = {
                'north-america': northAmerica,
                'latin-america': latinAmerica,
                'europe': europe,
                'asia': asiaSouthPacific,
                'antarctica': antarctica,
                'africa': africaMiddleEast,
                'hispano': hispano,
                'francophone': francophone
            };
        },

        /*
         * Styles a geo-json community layer
         */
        styleLayer: function (fill, outline, opacity, dash) {
            return {
                fillColor: fill,
                weight: 1,
                opacity: 1,
                color: outline || 'white',
                fillOpacity: opacity || 0.7,
                dashArray: dash || 'none',
                clickable: false
            };
        },

        /*
         * Shows the community map legend and bind click events
         */
        showMapLegend: function () {
            var $legend = $('#map .legend');
            $legend.fadeIn('fast');
            $legend.on('click', 'li a', mozMap.onMapLegendClick);
        },

        /*
         * Hides the community map legend and unbind click events
         */
        hideMapLegend: function () {
            var $legend = $('#map .legend');
            $legend.fadeOut('fast');
            $legend.off('click', 'li a', mozMap.onMapLegendClick);
        },

        /*
         * Find the corresponding nav item based on data-id in the legend
         * and fire a click event on it.
         */
        onMapLegendClick: function (e) {
            e.preventDefault();
            var itemId = $(this).parent().data('id');
            var tabId = 'communities';

            // for non-meta communities we do push state as
            // they have their own url's.
//            if (itemId !== 'francophone' && itemId !== 'hispano') {
                History.pushState({
                    id: itemId,
                    tab: tabId
                }, document.title, this.href);
//           }
        },

        /*
         * Split label layer on the map so we can set it's z-index dynamically
         * Hat tip to Alex Barth @ MapBox
         */
        splitLabelLayer: function () {
            topPane = map._createPane('leaflet-top-pane', map.getPanes().mapPane);
            topLayer = L.mapbox.tileLayer('mozilla-webprod.map-f1uagdlz');
            topLayer.on('ready', function() {
                var state = mozMap.getMapState();

                //add the split layers
                topLayer.addTo(map);
                topPane.appendChild(topLayer.getContainer());

                //set the initial z-index state for label layer
                if (state === 'spaces') {
                    topLayer.setZIndex(1);
                } else if (state === 'communities') {
                    topLayer.setZIndex(7);
                }
            });
        },

        /*
         * Sets the z-index of the labellayer so we can position country
         * names above community layers or under markers
         */
        setLabelLayerIndex: function (zIndex) {
            var i = parseInt(zIndex, 10);
            if (topLayer) {
                topLayer.setZIndex(i);
            }
        },

        /*
         * Requests content for displaying current space information
         * Params: @id space identifier string, @url url to request
         */
        requestContent: function (id, url) {
            //abort previous request if one exists
            if (xhr && xhr.readystate !== 4) {
                xhr.abort();
            }

            //get the page content
            xhr = $.ajax({
                url: url,
                type: 'get',
                dataType: 'html',
                success: function(data) {
                    // pull out data we need
                    var content = $(data).find('section.entry');
                    var mapId = content.attr('id');
                    // add content to the cache for future retrieval
                    contentCache[mapId] = content;
                    // update content in the page
                    $('#entry-container').html(content);
                    // programatically find the right marker and click it
                    mozMap.doClickMarker(id);

                    mozMap.showCommunityRegion(id);
                }
            });
        }
    };

    //initialize mapbox
    mozMap.init();
})(jQuery);
