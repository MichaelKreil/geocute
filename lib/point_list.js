"use strict"

const fs = require('fs');
const PointFile = require('./point_file.js');

function PointList() {
//	const maxCount = 12000000;
	const maxCount = 22200000;

	let count = 0;
	let dataX = new Float64Array(maxCount);
	let dataY = new Float64Array(maxCount);
	let dataV = new Float64Array(maxCount);

	function add(x,y,v) {
		dataX[count] = x;
		dataY[count] = y;
		dataV[count] = v;
		count++;
	};

	function saveData(filename) {
		PointFile.save(filename, count, dataX, dataY, dataV);
	};

	function exportTSV(filename) {
		let result;
		for (let i = 0; i < count; i++) {
			if ((i % 1000000 === 0) || (i === count-1)) {
				if (i === 0) {
					fs.writeFileSync(filename, '', 'utf8');
				} else {
					fs.appendFileSync(filename, result.join('\n')+'\n', 'utf8');
				}
				result = [];
			}
			result.push(dataX[i]+'\t'+dataY[i]+'\t'+dataV[i]);
		}
	};

	function setData(data) {
		count = data.count;
		dataX = data.dataX;
		dataY = data.dataY;
		dataV = data.dataV;
	};

	function forEach(cbEntry, cbFinished) {
		if (cbFinished) {
			//async
			let i0 = 0;
			next();
			function next() {
				let i1 = Math.min(i0+10000,count);
				for (var i = i0; i < i1; i++) cbEntry({ x: dataX[i], y: dataY[i], v: dataV[i] }, i);
				i0 = i1;
				if (i0 >= count) {
					if (typeof cbFinished === 'function') cbFinished();
				} else {
					setTimeout(next,1);
				}
			}
		} else {
			//sync
			for (let i = 0; i < count; i++) cbEntry({ x: dataX[i], y: dataY[i], v: dataV[i] }, i);
		}
	};

	function getLength() {
		return count;
	};
	
	return {
		add: add,
		setData: setData,
		save: saveData,
		exportTSV: exportTSV,
		forEach: forEach,
		getLength: getLength,
	};
};

PointList.load = function load(filename) {
	const list = new PointList();
	const result = PointFile.load(filename);
	list.setData(result);
	return list;
};

module.exports = PointList;
