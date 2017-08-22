"use strict"

const async = require('async');
const PointList = require('../lib/point_list.js');
const RegionLookup = require('../lib/region_lookup.js');

var result = new PointList();
var regionLookup = new RegionLookup('sources/bundeslaender.geojson.gz');

var config = [
	{ids:['Berlin'], source:'berlin_blk.bin.gz'}
]
config.push({
	default:true,
	source:'deutschland.bin.gz',
	ids: Array.prototype.concat.apply([],config.map(c => c.ids))
})

async.eachSeries(
	config,
	(entry, cbConfig) => {
		console.log('parse "'+entry.source+'"');

		var pointList = PointList.load(entry.source);
		var lookup = regionLookup.getInsideChecker(entry.ids, 'GEN');
		pointList.forEach(p => {
			var isInside = lookup(p.x, p.y);
			var use = entry.default ? !isInside : isInside;
			if (use) result.add(p.x,p.y,p.v);
		})

		cbConfig();
	},
	saveData
);

function saveData() {
	console.log('save deutschland_berlin_blk.bin.gz');
	result.save('deutschland_berlin_blk.bin.gz');
}
