"use strict"

const tsv = require('../lib/tsv.js');
const pointList = new require('../lib/point_list.js')();

// pop, lat, lon
tsv.load(__dirname+'/sources/berlin_adr.tsv.br', ['float', 'float', 'float'], b => pointList.add(b[1],b[2],b[0]), function(){
	pointList.save(__dirname+'/berlin_blk.bin.br');
});
