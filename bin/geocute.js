#! /usr/bin/env node

"use strict"

const fs = require('fs');
const Path = require('path');
const ProgressBar = require('progress');
const PointList = require('../lib/point_list.js');
const RegionLookup = require('../lib/region_lookup.js');

const minResidents = 10;



var args = process.argv.slice(2);

if ((args.length < 5) || (args.length > 6)) {
	console.error('Wrong number of arguments! I need 5-6');
	console.error('Usage:');
	console.error('  geocute geo1 key1 geo2 key2 [pointlist] output');
	console.error('    - geo1: filename of source GeoJSON');
	console.error('    - key1: property name of the key in source GeoJSON');
	console.error('    - geo2: filename of target GeoJSON');
	console.error('    - key2: property name of the key in target GeoJSON');
	console.error('    - pointlist: (optional) name of list of points to through at the data. Can be:');
	console.error('      - "../data/deutschland.bin.gz": (default) based on telephone book entries');
	console.error('      - "../data/berlin_blk.bin.gz": Berlin only, based on "statistische Blöcke"');
	console.error('      - "../data/berlin_adr_ew.bin.gz": Berlin only, based on "Sonderauswertung RBS-Adressen"');
	console.error('    - output: filename of resulting TSV file');
	console.error('Examples:');
	console.error('  If you want to calculate a matrix for converting from "gemeinden" to "wahlkreise", type:');
	console.error('     node geocute gemeinden.geojson AGS wahlkreise.geojson wkr_nr matrix.tsv');
	console.error('  If you want to convert from "wahlbezirk" to "plz" using "Sonderauswertung RBS-Adressen", type:');
	console.error('     node geocute wahlbezirk.geojson WBZ plz.geojson plz ../data/berlin_adr.bin.gz matrix.tsv');
	process.exit();
}

var pointListFilename = '../data/deutschland.bin.gz';

var filename1   = args.shift();
var key1        = args.shift();
var filename2   = args.shift();
var key2        = args.shift();

if (args.length > 1) pointListFilename = args.shift();

var filenameOut = args.shift();



console.log('load points');
var points = PointList.load(Path.resolve(__dirname, pointListFilename));



console.log('load regions "'+filename1+'"');
var geo1 = new RegionLookup(filename1);

console.log('load regions "'+filename2+'"');
var geo2 = new RegionLookup(filename2);



console.log('generate lookups "'+filename1+'"');
var lookup1 = geo1.getLookup(true);

console.log('generate lookups "'+filename2+'"');
var lookup2 = geo2.getLookup(true);



console.log('fire points');

var missSum1 = 0, missSum2 = 0, sum = 0, ignoredSum = 0;
var hits = new Map();
var count = points.getLength();
var bar = new ProgressBar('   [:bar] :percent (ETA :etas)', { total:50 });

points.forEach((p,i) => {
	if (i % 100000 === 0) bar.update(i/count);

	var region1 = lookup1(p.x, p.y);
	var region2 = lookup2(p.x, p.y);

	sum += p.v;
	if (!region1) missSum1 += p.v;
	if (!region2) missSum2 += p.v;
	if (!region1 || !region2) return;

	var key = region1.properties._index+'_'+region2.properties._index;
	if (!hits.has(key)) hits.set(key, {r1:region1, r2:region2, v:0});
	hits.get(key).v += p.v;

}, () => {
	bar.update(1);

	console.log('\n');

	console.log('save results');

	hits = Array.from(hits.values());
	hits = hits.filter(hit => {
		if (hit.v < minResidents) {
			ignoredSum += hit.v;
			return false;
		}
		hit.r1.properties._count = (hit.r1.properties._count || 0) + hit.v;
		hit.r2.properties._count = (hit.r2.properties._count || 0) + hit.v;

		return true;
	})

	console.log('- misses in geo 1: '+(100*missSum1/sum).toFixed(3)+'%');
	console.log('- misses in geo 2: '+(100*missSum2/sum).toFixed(3)+'%');
	console.log('- ignored residents: '+(100*missSum2/sum).toFixed(3)+'%');

	hits = hits.map(hit => {
		var fraction = hit.v/hit.r1.properties._count;
		var error = fraction*(1-fraction);
		error = error*hit.v/hit.r2.properties._count;
		return [
			hit.r1.properties[key1],
			hit.r2.properties[key2],
			fraction.toFixed(6),
			hit.v.toFixed(1),
			error.toFixed(6)
		].join('\t')
	})
	hits.unshift('key1_'+key1+'\tkey2_'+key2+'\tfraction\tresidents\terror');

	fs.writeFileSync(filenameOut, hits.join('\n'), 'utf8')
})
