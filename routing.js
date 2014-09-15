/*
In good part inspired by Leo Horie's Mithirl https://github.com/lhorie/mithril.js
*/
/**
Provides routing services.

The module exports a single function which should be called to 
fetch the [Router](../classes/Router.html) class.

The function must be passed a reference to the DOM `window` object
or a reasonable substitute.
For modules to be loaded through Browserify, 
this is usually `global.window`.  For modules loaded both through
Browserify or node, assuming a suitable emulator, it can be
done like this:
 
```   
var vDOM = require('virtual-dom')(global.window || require('dom-window-emulator'));
```

@module core
@submodule core-routing
*/

/**
Provides routing services to Parcela

@class Router
@static
*/


module.exports = function (window) {
	"use strict";
	
	var winLoc = window.location,
		document = window.document;
	
	var rootApp = require('virtual-dom')(window).rootApp;
	require('lang-ext');
	
	

	var r = {
		/**
		Current routing mode.  Can be one of the following, allowing paths of the format shown:
		
		* `'pathname'`: http://server/path/to/page
		* `'hash'`: http://server/#/path/to/page
		* **`'search'`**: http://server/?/path/to/page
		
		See the user guide for further discussion about the different modes.
		
		@property mode
		@type String
		@default 'search'
		*/
		mode: 'search',
		
		/**
		Routing table. Contains a hash map, indexed by the url, 
		with the sub-Class of Parcel that should be instantiated to handle the route.
		
		@property routes
		@type Hash table
		@default {}
		*/
		routes: {},
		
		/**
		DOM element where the application will be rendered.  Defaults to the `document.body`.
		
		@property rootNode
		@type DOM reference
		@default document.body
		*/
		rootNode: document.body,
		
		/**
		Default route to use when the url given by the browser does not match any 
		in the routing table
		
		@property defaultRoute
		@type String
		@default '/'
		*/
		defaultRoute: '/',

		_modes: {pathname: "", hash: "#", search: "?"},
		_routeParams: {}, 
		_currentRoute:null,
		_redirect: function() {}, 
		_computePostRedrawHook: null,

		_buildQueryString: function (object, prefix) {
			if (!object) return null;
			var str = [];
			object.each(function (prop) {
				var key = prefix ? prefix + "[" + prop + "]" : prop, value = object[prop];
				str.push(
					typeof value == "object" ? 
					r._buildQueryString(value, key) : 
					encodeURIComponent(key) + "=" + encodeURIComponent(value)
				);
			});
			return str.join("&");
		},
		

		_parseQueryString: function (str) {
			var params = {};
	
			var decodeSpace = function (string) {
				return decodeURIComponent(string.replace(/\+/g, " "));
			};
			str.split('&').forEach(function (pair) {
				pair = pair.split("=");
				params[decodeSpace(pair[0])] = pair[1] ? decodeSpace(pair[1]) : (pair.length === 1 ? true : "");
			});
			return params;
		},
		
		_routeByValue: function (path) {
			r._routeParams = {};
			var routes = r.routes, matches;

			var queryStart = path.indexOf("?");
			if (queryStart !== -1) {
				r._routeParams = r._parseQueryString(path.substr(queryStart + 1, path.length));
				path = path.substr(0, queryStart);
			}
			if (r.mode === 'pathname') {
				r._routeParams = r._parseQueryString(winLoc.search.substr(1));
			}
				
			r._routeParams.route = path;

			return routes.some(function (config, route) {
				if (route == path) {
					rootApp(config.parcel, r.rootNode, r._routeParams);
					return true;
				}
				/*jshint -W084 */
				if (matches = config.rx.exec(path)) {
				/*jshint +W084 */
					
					config.names.forEach(function (name, i) {
						r._routeParams[name] = decodeURIComponent(matches[i +1]);
					});
					rootApp(config.parcel, r.rootNode, r._routeParams);
					return true;
				}
			});
		},

		_setScroll: function () {
			if (r.mode != "hash" && winLoc.hash) {
				winLoc.hash = winLoc.hash;
			} else window.scrollTo(0, 0);
		},
		getCurrent: function () {
			return r._currentRoute;
		},
		
		/**
		Determines the routing configuration for an application.
		It will immediately act on the given routes, running the corresponding parcel.
		This method is for conveniency, all the properties it sets are public.
		
		```
		ITSA.Router.setRoutes(
			{
				'/item/:id': ItemParcel,
				'/itemList': ItemList
			},
			'/itemList'
		);
		```
		In this case we define two routes, the first one with a parameter `id`,
		each handled by a different Parcel. The default is the second route.
		No `rootNode` has been specified, thus the parcel will be rendered
		in the `document.body`.
		

		@method setRoutes
		@chainable
		@param routes {Object} A route table as described in [routes](#property_routes)
		@param [mode] {String} One of `search`, `hash` of `pathname` to set the [mode](#property_mode) property.
		@param [defaultRoute] {String} url of the route to execute if the current location doesn't match any of the above.
		     defaults to '/'
		@param [rootNode] {DOM Element} Where to render the given Parcel. Defaults to `document.body`.
		*/
		setRoutes: function (routes, mode, defaultRoute, rootNode) {
			routes.each(function (parcel, route) {
				r.setRoute(route, parcel);
			});
			if (mode !== undefined) {
				if (mode in r._modes) {
					r.mode = mode;
				} else {
					rootNode = defaultRoute;
					defaultRoute = mode;
				}
				if (defaultRoute !== undefined && defaultRoute.appendChild) {
					rootNode = defaultRoute;
					defaultRoute = null;
				}
			}
					
			
			r.rootNode = rootNode || document.body;
			r.defaultRoute = defaultRoute || '/';

			var normalizeRoute = function (route) {
				return route.slice(r._modes[r.mode].length);
			};
			r._redirect = function(source) {
				var path = r._currentRoute = normalizeRoute(source);
				if (!r._routeByValue(path)) {
					r.navigate(r.defaultRoute, true);
				}
			};
			var listener = r.mode == "hash" ? "onhashchange" : "onpopstate";
			window[listener] = function () {
				if (r._currentRoute != normalizeRoute(winLoc[r.mode])) {
					r._redirect(winLoc[r.mode]);
				}
			};
			r._computePostRedrawHook = r._setScroll;
			window[listener]();
			return r;
		},
		
		/**
		Returns the value of a parameter from the url when the route had variable parts.
		For a route such as `'/item/:id'` if the browser navigates to `/item/123`,
		`getParam('id')` should return `123`.
		
		@method getParam
		@param name {String} Name of the parameter to read
		@return {String} value of the parameter or undefined if not found.
		*/
		getParam: function (name) {
			return r._routeParams[name];
		},
		
		/**
		Navigates to the given route. Query parameters can be passed.  
		The new route can either be added to the browser history or replace the current entry.
		If the route is not found in the routing table, the [defaultRoute](#property_defaultRoute)
		will be used.
		
		@method navigate
		@chainable
		@param route {String} url of the route to navigate to
		@param [params] {Hash Map} parameters to be added to the query
		@param [replace] {Boolean} if true, the given route will replace the current one in the browser history
		*/
		navigate: function (route, params, replace) {
			r._currentRoute = route;
			if (typeof params !== "object") {
				replace = params;
				params = null;
			}

			var querystring = r._buildQueryString(params);
			if (querystring) {
				r._currentRoute += (r._currentRoute.indexOf("?") === -1 ? "?" : "&") + querystring;
			}
			
			if (window.history.pushState) {
				r._computePostRedrawHook = function() {
					window.history[replace === true ? "replaceState" : "pushState"]
						(null, document.title, r._modes[r.mode] + r._currentRoute);
					r._setScroll();
				};
				r._redirect(r._modes[r.mode] + r._currentRoute);
			}
			else winLoc[r.mode] = r._currentRoute;
			return r;
		},
		
		
		/**
		Helper method to set or replace a route in the routing table.
		
		@method setRoute
		@chainable
		@param route {String |regex} url template of the route to set or replace 
			or a regular expression that should match the route.
		@param parcel {Parcel} sub-class of Parcel to instantiate to handle this route
		*/
		setRoute: function (route, parcel) {
			var names = [], name, match = /:([^\/\*]+)/g;
			while ((name = match.exec(route)) !== null) {
				names.push(name[1]);
			}
			r.routes[route] = {
				parcel:parcel, 
				rx: new RegExp("^" + route.replace(/:\w+\*/g, "(.*?)").replace(/:\w+/g, "([^\\/]+)") + "\/?$"),
				names: names
			};
		},

		/** 
		Removes the given route from the routing table.
		@method removeRoute
		@chainable
		@param route {String} route to remove
		*/
		removeRoute: function (route) {
			delete r.routes[route];
			return r;
		}
	};

	/* *
	Shortcut to the [Router.setRoutes](#method_setRoutes) method.
	
	```
	ITSA.Router(
		{
			'/item/:id': ItemParcel,
			'/itemList': ItemList
		},
		'/itemList'
	);
	```

	**Important** If this method is used, 
	it should be used before any of the other methods in this static class are used.
	
	@method ()
	@chainable
	@param routes {Object} A route table as described in [routes](#property_routes)
		@param [mode] {String} One of `search`, `hash` of `pathname` to set the [mode](#property_mode) property.
		@param [defaultRoute] {String} url of the route to execute if the current location doesn't match any of the above.
		     defaults to '/'
		@param [rootNode] {DOM Element} Where to render the given Parcel. Defaults to `document.body`.
	*/
	
	return function () {
		return r.setRoutes.apply(r, arguments);
	}.merge(r);
};

