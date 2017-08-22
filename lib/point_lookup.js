"use strict"

var PointFile = require('./point_file.js')

function PointLookup() {
	const maxCount = 12000000;
	const gridScale = 100;

	var count = 0;
	var dataX = new Float64Array(maxCount);
	var dataY = new Float64Array(maxCount);
	var dataV = new Float64Array(maxCount);

	var grid = new Map();


	function add(x,y,v) {
		dataX[count] = x;
		dataY[count] = y;
		dataV[count] = v;

		var hash = getPointHash(x,y);
		if (grid.has(hash)) {
			grid.get(hash).push(count)
		} else {
			grid.set(hash, [count]);
		}

		count++;
	}

	function findNearby(x,y,r) {
		var ry = r*360/40074000;
		var rx = ry/Math.cos(y/180*Math.PI);
		var hashes = getPointHashes(x-rx, x+rx, y-ry, y+ry);
		var points = getPointIndexes(hashes);

		points = points.map(i => {
			return {
				distance: distance(dataX[i], dataY[i]),
				inc: v => dataV[i] += v
			}
		})

		return points;

		function distance(x1, y1) {
			var degrees2radians = Math.PI / 180;
			var dLat = degrees2radians * (y1 - y);
			var dLon = degrees2radians * (x1 - x);
			var lat1 = degrees2radians * y;
			var lat2 = degrees2radians * y1;

			var a = Math.pow(Math.sin(dLat/2), 2) + Math.pow(Math.sin(dLon/2), 2) * Math.cos(lat1) * Math.cos(lat2);

			return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))*6373000;
		}
	}

	function getPointHash(x,y) {
		return Math.floor(x*gridScale)+'_'+Math.floor(y*gridScale);
	}

	function getPointIndexes(hashes) {
		var points = [];
		hashes.forEach(hash => {
			if (!grid.has(hash)) return;
			grid.get(hash).forEach(p => points.push(p));
		})
		return points;
	}

	function getPointHashes(x0,x1,y0,y1) {
		var x0 = Math.floor(x0*gridScale);
		var x1 = Math.floor(x1*gridScale);
		var y0 = Math.floor(y0*gridScale);
		var y1 = Math.floor(y1*gridScale);
		var hashes = [];
		for (var x = x0; x <= x1; x++) {
			for (var y = y0; y <= y1; y++) {
				hashes.push(x+'_'+y);
			}
		}
		return hashes;
	}

	function saveData(filename) {
		PointFile.save(filename, count, dataX, dataY, dataV);
	}
	
	return {
		add:add,
		findNearby:findNearby,
		save:saveData
	}
}

module.exports = PointLookup;
