"use strict"

const fs = require('fs');
const zlib = require('zlib');
const turf = require('@turf/turf');

function RegionLookup(filename) {
	let geoJSON;
	if (filename.endsWith('.gz')) {
		geoJSON = fs.readFileSync(filename);
		geoJSON = zlib.gunzipSync(geoJSON);
		geoJSON = geoJSON.toString('utf8');
	} else if (filename.endsWith('.br')) {
		geoJSON = fs.readFileSync(filename);
		geoJSON = zlib.brotliDecompressSync(geoJSON);
		geoJSON = geoJSON.toString('utf8');
	} else {
		geoJSON = fs.readFileSync(filename, 'utf8');
	}
	geoJSON = JSON.parse(geoJSON);

	geoJSON.features.forEach((f,i) => f.properties._index = i);

	return {
		getInsideChecker:getInsideChecker,
		getOverlapFinder:getOverlapFinder,
		getLookup:getLookup,
		features:geoJSON.features,
		geoJSON:geoJSON
	}

	function getInsideChecker(ids, key) {
		let regions = geoJSON.features.filter(f => ids.indexOf(f.properties[key]) >= 0);

		regions = {type:'FeatureCollection',features:regions};
		regions = turf.combine(regions);
		regions = turf.flatten(regions);

		if (regions.features.length !== 1) console.warn('found "'+regions.features.length+'" inside');
		regions = regions.features[0];

		const bbox = turf.bbox(regions);

		function isInside(x, y) {
			if (bbox[0] > x) return false;
			if (bbox[1] > y) return false;
			if (bbox[2] < x) return false;
			if (bbox[3] < y) return false;
			return turf.inside(turf.point([x, y]), regions);
		};

		return isInside
	};

	function getOverlapFinder() {
		geoJSON.features.forEach(f => {
			f.properties._bbox = turf.bbox(f);
		})
		return function (f2) {
			const bbox2 = turf.bbox(f2);
			const area2 = turf.area(f2);
			const result = [];

			geoJSON.features.forEach(f1 => {
				const bbox1 = f1.properties._bbox;
				if (bbox2[0] > bbox1[2]) return false;
				if (bbox2[1] > bbox1[3]) return false;
				if (bbox2[2] < bbox1[0]) return false;
				if (bbox2[3] < bbox1[1]) return false;

				let difference;
				try {
					difference = turf.difference(f2,f1);
				} catch (e) {
					console.dir(f1, { colors: true, depth: 10 });
					console.dir(f2, { colors: true, depth: 10 });
					console.log(e);
					process.exit();
				}

				let area12 = area2;
				if (difference) area12 -= turf.area(difference);
				
				if (area12 < 1e-6) return false;

				result.push({
					fraction: area12/area2,
					feature: f1
				})
			})

			return result;
		};
	};

	function getLookup(reducePolygon) {
		const n = 300;
		const pad = 1e-6;
		const b = turf.bbox(geoJSON);
		const x0 = b[0]-pad;
		const y0 = b[1]-pad;
		const xs = n/(b[2]-b[0] + 2*pad);
		const ys = n/(b[3]-b[1] + 2*pad);

		const lookup = new Map();

		geoJSON.features.forEach(f => {

			const bbox = turf.bbox(f);
			f.bbox = bbox;
			
			const xi0 = Math.floor((bbox[0]-x0)*xs);
			const yi0 = Math.floor((bbox[1]-y0)*ys);
			const xi1 = Math.floor((bbox[2]-x0)*xs);
			const yi1 = Math.floor((bbox[3]-y0)*ys);

			for (const xi = xi0; xi <= xi1; xi++) {
				for (const yi = yi0; yi <= yi1; yi++) {
					const gridbox = [
						(xi-0.01)/xs+x0,
						(yi-0.01)/ys+y0,
						(xi+1.01)/xs+x0,
						(yi+1.01)/ys+y0
					]
					const clip = turf.bboxClip(f, gridbox);
					if (isEmpty(clip)) continue;

					const key = xi+'_'+yi;
					if (!lookup.has(key)) lookup.set(key, []);
					clip.original = f;
					lookup.get(key).push(clip);

					function isEmpty(f) {
						const g = f.geometry;
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
		});

		return function(x,y) {
			const xi = Math.floor((x-x0)*xs);
			const yi = Math.floor((y-y0)*ys);
			const key = xi+'_'+yi;

			if (!lookup.has(key)) return false;

			let features = lookup.get(key);
			features = features.filter(f => turf.inside(turf.point([x,y]), f));
			features = features.map(f => f.original);
			
			if (features.length > 1) {
				console.warn('   Error: found "'+features.length+'" hits for one point!');
				console.warn('   Reason: Shitty geometry!');
				console.warn('   Solution: Choosing the smallest geometry!');
				features.forEach(f => {
					f.properties._area = turf.area(f);
				});
				features.sort((a,b) => a.properties._area - b.properties._area);
				features.forEach((f,index) => {
					const log = [];
					Object.keys(f.properties).forEach(key => {
						if (key[0] === '_') return;
						log.push(key+': '+f.properties[key]);
					})
					console.warn('      { '+log.join(', ')+'}'+((index === 0) ? ' <===' : ''));
				});
				return features[0];
			}
			if (features.length === 0) return false;

			return features[0];
		};

	};

};

module.exports = RegionLookup;
