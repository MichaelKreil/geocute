"use strict"

const fs = require('fs');
const zlib = require('zlib');

var x0 =  5.8;
var y0 = 47.3;
var x1 = 15.1;
var y1 = 55.1;
var xs = 65535/(x1-x0);
var ys = 65535/(y1-y0);


function load(filename) {
	var buffer = fs.readFileSync(filename);
	var count = Math.round(buffer.length/6);
	if (buffer.length !== 6*count) throw Error();

	return {
		count:count,
		dataX:readUint16(0*count, v => v/xs + x0),
		dataY:readUint16(2*count, v => v/ys + y0),
		dataV:readUint16(4*count, v => v/10)
	}

	function readUint16(offset, map) {
		var input = new Uint16Array(count);
		var output = new Float64Array(count);
		buffer.copy(Buffer.from(input.buffer), 0, offset, offset+2*count);
		for (var i = 0; i < count; i++) output[i] = map(input[i]);
		return output;
	}
}

function save(filename, count, dataX, dataY, dataV) {
	console.log('   round');
	dataX = makeUint16(dataX, v => Math.round((v-x0)*xs));
	dataY = makeUint16(dataY, v => Math.round((v-y0)*ys));
	dataV = makeUint16(dataV, v => Math.round(v*10));

	function makeUint16(input, map) {
		var output = new Uint16Array(count);
		for (var i = 0; i < count; i++) output[i] = map(input[i]);
		return output;
	}

	console.log('   sort');
	hilbertSort();

	console.log('   consolidate');
	consolidate();

	console.log('   save');

	var size = 6*count;
	var buffer = new Buffer(size);

	Buffer.from(dataX.buffer).copy(buffer, 0*count, 0, 2*count);
	Buffer.from(dataY.buffer).copy(buffer, 2*count, 0, 2*count);
	Buffer.from(dataV.buffer).copy(buffer, 4*count, 0, 2*count);

	fs.writeFileSync(filename, zlib.gzipSync(buffer, {level:9}));

	function hilbertSort() {
		var index = new Uint32Array(count);
		var hash  = new Uint32Array(count);

		const hilbertOrder   = [[1,2,0,3],[0,3,1,2],[2,1,3,0],[3,0,2,1],[3,2,0,1],[0,1,3,2],[2,3,1,0],[1,0,2,3]];
		const hilbertSubCell = [[0,0,4,7],[5,6,1,1],[2,2,5,6],[4,7,3,3],[3,4,0,4],[1,5,2,5],[6,1,6,2],[7,3,7,0]];

		for (var i = 0; i < count; i++) {
			index[i] = i;
			hash[i] = getHilbertHash(dataX[i], dataY[i])
		}

		function getHilbertHash(x,y) {
			var cell = 0;
			var hash = 0;

			for (var i = 0; i < 16; i++) {
				var id = (x >>> 15) + 2*(y >>> 15);

				hash = hash*4 + hilbertOrder[cell][id];
				cell = hilbertSubCell[cell][id];

				x = (x & 0x7FFF) << 1;
				y = (y & 0x7FFF) << 1;
			}

			return hash;
		}

		index.sort((a,b) => hash[a]-hash[b])

		dataX = Uint16Array.from(index, i => dataX[i]);
		dataY = Uint16Array.from(index, i => dataY[i]);
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