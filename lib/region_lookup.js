"use strict"

const fs = require('fs');

function RegionLookup(filename, key) {
	var geoJSON = fs.readFileSync(filename, 'utf8');
	geoJSON = JSON.parse(geoJSON);
	geoJSON.features.forEach(f => f.id = f.properties[key]);
}

module.exports = RegionLookup;