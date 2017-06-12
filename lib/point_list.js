"use strict"

var PointFile = require('./point_file.js')

function PointList() {
	const maxCount = 12000000;

	var count = 0;
	var dataX = new Float64Array(maxCount);
	var dataY = new Float64Array(maxCount);
	var dataV = new Float64Array(maxCount);

	function add(x,y,v) {
		dataX[count] = x;
		dataY[count] = y;
		dataV[count] = v;
		count++;
	}

	function saveData(filename) {
		PointFile.save(filename, count, dataX, dataY, dataV);
	}

	function setData(data) {
		count = data.count;
		dataX = data.dataX;
		dataY = data.dataY;
		dataV = data.dataV;
	}
	
	return {
		add:add,
		setData:setData,
		save:saveData
	}
}

PointList.load = function load(filename) {
	var list = new PointList();
	var result = PointFile.load(filename);
	list.setData(result);
	return list;
}

module.exports = PointList;