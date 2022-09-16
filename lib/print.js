module.exports = function(prefix){
	return function(){
		if (!!arguments[0]) process.stderr.write(prefix+" ");
		console.error.apply(null, arguments);
	};
}