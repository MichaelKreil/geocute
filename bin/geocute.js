#! /usr/bin/env node

"use strict"

const fs = require('fs');
const Path = require('path');
const colors = require('colors');
const ProgressBar = require('progress');
const PointList = require('../lib/point_list.js');
const RegionLookup = require('../lib/region_lookup.js');

const minResidents = 10;



var args = process.argv.slice(2);

if ((args.length < 5) || (args.length > 6)) {
	console.error('Wrong number of arguments! I need 5-6'.yellow);
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

var misses = [], sum = 0;
var hits = new Map();
var count = points.getLength();
var bar = new ProgressBar('fire points [:bar] :percent (ETA :etas)', { total:50 });

points.forEach((p,i) => {
	if (i % 100000 === 0) bar.update(i/count);

	var region1 = lookup1(p.x, p.y);
	var region2 = lookup2(p.x, p.y);

	sum += p.v;
	if (!region1 || !region2) {
		p.region1 = region1;
		p.region2 = region2;
		misses.push(p);
		return;
	}

	var key = region1.properties._index+'_'+region2.properties._index;
	if (!hits.has(key)) hits.set(key, {r1:region1, r2:region2, v:0});
	hits.get(key).v += p.v;

}, () => {
	bar.update(1);

	console.log('');

	console.log('analyse results');
	
	hits = Array.from(hits.values());
	hits.forEach(hit => {
		hit.r1.properties._count = (hit.r1.properties._count || 0) + hit.v;
		hit.r2.properties._count = (hit.r2.properties._count || 0) + hit.v;
	})
	hits = hits.map(hit => {
		var fraction = hit.v/hit.r1.properties._count;
		var error = fraction*(1-fraction);
		error = error*hit.v/hit.r2.properties._count;
		return {
			key1: hit.r1.properties[key1],
			key2: hit.r2.properties[key2],
			fraction: fraction,
			residents: hit.v,
			error: error,
			method: 'point'
		}
	})



	var missSum1 = 0, missSum2 = 0, missSum12 = 0;
	misses = misses.map(p => {
		if (!p.region1) missSum1 += p.v;
		if (!p.region2) missSum2 += p.v;
		if (!p.region1 || !p.region2) missSum12 += p.v;
		return {
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [p.x, p.y] },
			properties: {
				residents: p.v,
				region1: p.region1 ? ''+p.region1.properties[key1] : 'false',
				region2: p.region2 ? ''+p.region2.properties[key2] : 'false'
			}
		}
	})

	console.log('- misses:');
	console.log('   - in geo 1: '     +missSum1 +' ('+(100*missSum1 /sum).toFixed(3)+'%)');
	console.log('   - in geo 2: '     +missSum2 +' ('+(100*missSum2 /sum).toFixed(3)+'%)');
	console.log('   - in geo 1 or 2: '+missSum12+' ('+(100*missSum12/sum).toFixed(3)+'%)');
	if (misses.length > 0) {
		console.log('   - saving all misses as "_misses.geojson"'.yellow);
		fs.writeFileSync('_misses.geojson', JSON.stringify({type:'FeatureCollection',features:misses}), 'utf8')
	}

	console.log('- regions without hits:');
	var features1 = geo1.features.filter(f => (!f.properties._count))
	var features2 = geo2.features.filter(f => (!f.properties._count))
	console.log('   - in geo 1: '+features1.length);

	if (features1.length) {
		console.warn('Warning: Some regions in geo 1 where not hit:'.yellow);
		console.warn(colors.yellow(features1.map(f => f.properties[key1]).join(',')));
		console.warn('Solution: Estimate matrix entries based on overlapping areas.'.yellow);
		var findOverlaps = geo2.getOverlapFinder();
		var noOverlaps = features1.filter(f1 => {
			var overlaps = findOverlaps(f1);
			if (overlaps.length === 0) {
				console.warn(('Error: Can not find overlaps for '+f1.properties[key1]+' in geo2').red);
				return true;
			}
			overlaps.forEach(overlap => hits.push({
				key1: f1.properties[key1],
				key2: overlap.feature.properties[key2],
				fraction: overlap.fraction,
				residents: 0,
				error: 1,
				method: 'overlapping area'
			}))
		})
		if (noOverlaps.length > 0) {
			console.warn(('Saving non overlapping regions as _nooverlaps.geojson').red);
			fs.writeFileSync('_nooverlaps.geojson', JSON.stringify({type:'FeatureCollection',features:noOverlaps}), 'utf8');
		}
	}

	console.log('   - in geo 2: '+features2.length);
	if (features2.length) {
		console.log('ERROR: CAN\'T FIX IT, THAT THERE IS NO HITS IN GEO2!!'.red);
		console.log('SOLUTION: PANIC!'.red);
		console.log('   - saving that as "_nohits.geojson"');
		fs.writeFileSync('_nohits.geojson', JSON.stringify({type:'FeatureCollection',features:features2}), 'utf8');
	}




	console.log('save results');
	hits = hits.map(hit => [
		hit.key1,
		hit.key2,
		hit.fraction.toFixed(6),
		hit.residents.toFixed(1),
		hit.error.toFixed(6),
		hit.method
	].join('\t'))
	hits.unshift('key1_'+key1+'\tkey2_'+key2+'\tfraction\tresidents\terror\tmethod');

	fs.writeFileSync(filenameOut, hits.join('\n'), 'utf8')

	console.log('');
})
