"use strict"

const fs = require('fs');
const turf = require('turf');
turf.flatten = require('@turf/flatten');

function RegionLookup(filename, key) {
	var geoJSON = fs.readFileSync(filename, 'utf8');
	geoJSON = JSON.parse(geoJSON);

	var regionsById = new Map();
	geoJSON.features.forEach(f => {
		f.id = f.properties[key]
		regionsById.set(f.id, f);
	});

	return {
		getRegionsLookup:getRegionsLookup
	}

	function getRegionsLookup(ids) {
		var regions = ids.map(id => regionsById.get(id));
		regions = {type:'FeatureCollection',features:regions};
		regions = turf.combine(regions);
		regions = turf.flatten(regions);

		if (regions.features.length !== 1) throw Error();
		regions = regions.features[0];

		var bbox = turf.bbox(regions);


		function isInside(x, y) {
			if (bbox[0] > x) return false;
			if (bbox[1] > y) return false;
			if (bbox[2] < x) return false;
			if (bbox[3] < y) return false;
			return turf.inside(turf.point([x, y]), regions);
		}

		return {
			isInside:isInside
		}
	}
}

module.exports = RegionLookup;