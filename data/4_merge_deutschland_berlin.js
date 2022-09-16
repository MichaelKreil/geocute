"use strict"

const async = require('async');
const PointList = require('../lib/point_list.js');
const RegionLookup = require('../lib/region_lookup.js');

const result = new PointList();
const regionLookup = new RegionLookup(__dirname+'/sources/bundeslaender.geojson.br');

const config = [{
	ids: ['Berlin'],
	source: __dirname+'/berlin_blk.bin.br'
}];

config.push({
	default: true,
	source: __dirname+'/deutschland.bin.br',
	ids: Array.prototype.concat.apply([],config.map(c => c.ids))
});

async.eachSeries(
	config,
	(entry, cbConfig) => {
		console.log('parse "'+entry.source+'"');

		const pointList = PointList.load(entry.source);
		const lookup = regionLookup.getInsideChecker(entry.ids, 'GEN');
		pointList.forEach(p => {
			const isInside = lookup(p.x, p.y);
			const use = entry.default ? !isInside : isInside;
			if (use) result.add(p.x,p.y,p.v);
		});
		cbConfig();
	},
	saveData
);

function saveData() {
	console.log('save deutschland_berlin_blk.bin.br');
	result.save(__dirname+'/deutschland_berlin_blk.bin.br');
};
