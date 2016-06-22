
"use strict";

var fs = require( "fs" );

/**
 * utility: cache file contents and refresh on mtime.
 */
var FileCache = function(){
	
	var store = {};
	
	var cache = function( path ){
		return new Promise( function( resolve, reject ){
			fs.readFile( path, { encoding: "utf8" }, function( err, contents ){
				if( err ) reject( err );
				if( !contents ) contents = "";
				store[path] = { 
					contents: contents, 
					cache_time: new Date().getTime()
				};
				resolve( contents );
			});
		});
	};
	
	this.ensure = function( path ){
		return new Promise( function( resolve, reject ){
			var cached = store[path];
			if( typeof cached !== "undefined" ){
				fs.stat( path, function(err, stats){
					if( err ) reject( err );
					if( stats.mtime.getTime() > cached.cache_time ){
						cache( path ).then( function( contents ){
							resolve(contents);
						}).catch( function( err ){ reject(err); });
					}
					else {
						resolve( cached.contents );
					}
				});
			}
			else {
				cache( path ).then( function( contents ){
					resolve(contents);
				}).catch( function( err ){ reject(err); });
			}
		});
	};

};

module.exports = FileCache;

