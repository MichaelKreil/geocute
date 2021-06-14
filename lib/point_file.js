"use strict"

const fs = require('fs');
const zlib = require('zlib');

var x0 =  0, x1 = 20;
var y0 = 40, y1 = 60;
var xs = 20000000/(x1-x0);
var ys = 20000000/(y1-y0);

function load(filename) {
	var buffer = fs.readFileSync(filename);
	buffer = zlib.gunzipSync(buffer);
	
	var count = Math.round(buffer.length/10);
	if (buffer.length !== 10*count) throw Error('Size error in "'+filename+'"');

	return {
		count:count,
		dataX:readUint32(0*count, v => v/xs + x0),
		dataY:readUint32(4*count, v => v/ys + y0),
		dataV:readUint16(8*count, v => v/10)
	}

	function readUint16(offset, map) {
		var input = new Uint16Array(count);
		buffer.copy(Buffer.from(input.buffer), 0, offset, offset+2*count);
		return Float64Array.from(input, map);
	}

	function readUint32(offset, map) {
		var input = new Uint32Array(count);
		buffer.copy(Buffer.from(input.buffer), 0, offset, offset+4*count);
		return Float64Array.from(input, map);
	}
}

function save(filename, count, dataX, dataY, dataV) {
	console.log('   round');

	console.log('      x');
	dataX = Uint32Array.from(dataX, v => Math.round((v-x0)*xs));
	console.log('      y');
	dataY = Uint32Array.from(dataY, v => Math.round((v-y0)*ys));
	console.log('      v');
	dataV = Uint16Array.from(dataV, v => Math.round(v*10));

	console.log('   sort');
	hilbertSort();

	console.log('   consolidate');
	consolidate();

	console.log('   save');

	var size = 10*count;
	var buffer = Buffer.alloc(size);

	Buffer.from(dataX.buffer).copy(buffer, 0*count, 0, 4*count);
	Buffer.from(dataY.buffer).copy(buffer, 4*count, 0, 4*count);
	Buffer.from(dataV.buffer).copy(buffer, 8*count, 0, 2*count);

	fs.writeFileSync(filename, zlib.gzipSync(buffer, {level:9}));

	function hilbertSort() {
		var index = new Uint32Array(count);
		var hash  = new Array(count);

		const hilbertOrder   = [[1,2,0,3],[0,3,1,2],[2,1,3,0],[3,0,2,1],[3,2,0,1],[0,1,3,2],[2,3,1,0],[1,0,2,3]];
		const hilbertSubCell = [[0,0,4,7],[5,6,1,1],[2,2,5,6],[4,7,3,3],[3,4,0,4],[1,5,2,5],[6,1,6,2],[7,3,7,0]];

		for (var i = 0; i < count; i++) {
			index[i] = i;
			hash[i] = getHilbertHash(dataX[i], dataY[i])
		}

		function getHilbertHash(x,y) {
			var cell = 0;
			var hash = 0;

			for (var i = 0; i < 25; i++) {
				var id = (x >>> 24) + 2*(y >>> 24);

				hash = hash*4 + hilbertOrder[cell][id];
				cell = hilbertSubCell[cell][id];

				x = (x & 0xFFFFFF) << 1;
				y = (y & 0xFFFFFF) << 1;
			}

			if (hash !== Math.round(hash)) throw Error();
			return hash;
		}

		index.sort((a,b) => hash[a]-hash[b])

		dataX = Uint32Array.from(index, i => dataX[i]);
		dataY = Uint32Array.from(index, i => dataY[i]);
		dataV = Uint16Array.from(index, i => dataV[i]);
	}

	function consolidate() {
		var i1 = -1, lastX = -1, lastY = -1;

		for (var i0 = 0; i0 < count; i0++) {
			if (dataV[i0] === 0) continue;
			if ((dataX[i0] === lastX) && (dataY[i0] === lastY)) {
				dataV[i1] += dataV[i0];
				continue;
			}
			lastX = dataX[i0];
			lastY = dataY[i0];
			i1++;
			if (i0 !== i1) {
				dataX[i1] = dataX[i0];
				dataY[i1] = dataY[i0];
				dataV[i1] = dataV[i0];
			}
		}
		count = i1+1;
	}
}

module.exports = {
	save: save,
	load: load
}
