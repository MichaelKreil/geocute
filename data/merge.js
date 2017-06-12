"use strict"

const async = require('async');
const PointList = require('../lib/point_list.js');
const RegionLookup = require('../lib/region_lookup.js');

var result = new PointList();
var regionLookup = new RegionLookup('./merge/bundeslaender.geojson');

var config = [
	{ids:['Berlin'], source:'./berlin/berlin.bin.gz'}
]
config.push({
	default:true,
	source:'./deutschland/deutschland.bin.gz',
	ids: Array.prototype.concat.apply([],config.map(c => c.ids))
})

async.eachSeries(
	config,
	(entry, cbConfig) => {
		console.log('parse "'+entry.source+'"');

		var pointList = PointList.load(entry.source);
		var lookup = regionLookup.getInsideChecker(entry.ids, 'GEN');
		pointList.forEach(p => {
			var isInside = lookup.isInside(p.x, p.y);
			var use = entry.default ? !isInside : isInside;
			if (use) result.add(p.x,p.y,p.v);
		})
		
		cbConfig();
	},
	saveData
);

function saveData() {
	console.log('save deutschland.bin.gz');
	result.save('deutschland.bin.gz');
}