"use strict"

const fs = require('fs');
const zlib = require('zlib');
const turf = require('turf');
turf.flatten = require('@turf/flatten');
turf.bboxClip = require('@turf/bbox-clip');

function RegionLookup(filename) {
	var geoJSON;
	if (filename.endsWith('.gz')) {
		geoJSON = fs.readFileSync(filename);
		geoJSON = zlib.gunzipSync(geoJSON);
		geoJSON = geoJSON.toString('utf8');
	} else {
		geoJSON = fs.readFileSync(filename, 'utf8');
	}
	geoJSON = JSON.parse(geoJSON);

	geoJSON.features.forEach((f,i) => f.index = i);

	return {
		getInsideChecker:getInsideChecker,
		getLookup:getLookup,
		features:geoJSON.features,
		geoJSON:geoJSON
	}

	function getInsideChecker(ids, key) {
		var regions = geoJSON.features.filter(f => ids.indexOf(f.properties[key]) >= 0);

		regions = {type:'FeatureCollection',features:regions};
		regions = turf.combine(regions);
		regions = turf.flatten(regions);

		if (regions.features.length !== 1) console.warn('found "'+regions.features.length+'" inside');
		regions = regions.features[0];

		var bbox = turf.bbox(regions);

		function isInside(x, y) {
			if (bbox[0] > x) return false;
			if (bbox[1] > y) return false;
			if (bbox[2] < x) return false;
			if (bbox[3] < y) return false;
			return turf.inside(turf.point([x, y]), regions);
		}

		return isInside
	}

	function getLookup() {
		var x0 =  5.8, xs = 35;
		var y0 = 47.3, ys = xs/0.64;

		var lookup = new Map();

		geoJSON.features.forEach(f => {

			var bbox = turf.bbox(f);
			f.bbox = bbox;
			
			var xi0 = Math.floor((bbox[0]-x0)*xs);
			var yi0 = Math.floor((bbox[1]-y0)*ys);
			var xi1 = Math.floor((bbox[2]-x0)*xs);
			var yi1 = Math.floor((bbox[3]-y0)*ys);

			for (var xi = xi0; xi <= xi1; xi++) {
				for (var yi = yi0; yi <= yi1; yi++) {
					var gridbox = [
						(xi  )/xs+x0,
						(yi  )/ys+y0,
						(xi+1)/xs+x0,
						(yi+1)/ys+y0
					]
					if (isEmpty(turf.bboxClip(f, gridbox))) continue;

					var key = xi+'_'+yi;
					if (!lookup.has(key)) lookup.set(key, []);
					lookup.get(key).push(f);

					function isEmpty(f) {
						var g = f.geometry;
						if (g.type === 'MultiPolygon') {
							g.coordinates = g.coordinates.filter(c => c.length > 0);
							return (g.coordinates.length === 0)
						}
						if (g.type === 'Polygon') {
							return (g.coordinates.length === 0)
						}
						console.dir(g, {colors:true});
						throw Error('Well, that was unexpected!');
					}
				}
			}
		})

		return function (x,y) {
			var xi = Math.floor((x-x0)*xs);
			var yi = Math.floor((y-y0)*ys);
			var key = xi+'_'+yi;

			if (!lookup.has(key)) return false;

			var features = lookup.get(key);
			features = features.filter(f => turf.inside(turf.point([x,y]), f));
			
			if (features.length > 1) {
				console.warn('found "'+features.length+'" hits');
				return false;
			}
			if (features.length === 0) false;

			return features[0];
		}

	}
}

module.exports = RegionLookup;
