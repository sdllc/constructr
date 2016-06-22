/**
 * pager broken out into separate file.  pager is very simple, just writes 
 * text to shell (FIXME: optionally to panel).
 * 
 * update: reimplemented as singleton
 * 
 */
"use strict";

const fs = require( "fs" );
const PubSub = require( "pubsub-js" );

var Pager = function(){

	this.init = function(opts){

		opts.source.on( 'pager', function(obj){

			var data = obj.$data;

			// can be one or many? use the loop

			if( typeof( data.files ) === "string" ){
				data.files = [data.files];
				data.title = [data.title];
				data['delete.file'] = [data['delete.file']];
			}

			if( opts.debug ) console.info( data );

			if( typeof( data.files ) === "object" ){
				for( var i = 0; i< data.files.length; i++ ){

					var title = null;
					if( data.title[i] && data.title[i].trim().length ){
						title = "\n" + data.title[i] + "\n" + Array( data.title[i].length + 1 ).join('=') + "\n";
					}
					
					if( data.files[i] ){
						fs.readFile( data.files[i], { encoding: "utf8" }, function(err, contents){
							
							if( title ) opts.text( title, "pager pager-title", true );
							
							if( contents && contents.length ){
								opts.text( "\n" + contents, "pager pager-text", true );
							}
							
							opts.text( "\n", undefined, true );
							
							if( data['delete.file'][i] ){
								console.info( "unlink", data.files[i] );
								fs.unlink( data.files[i] );
							}
						});
					}

				}
			}

		});
	};
	
};

module.exports = {
	
	init: function( core ){
		new Pager().init({
			source: core.R,
			text: function(){
				var args = [];
				for( var i = 0; i< arguments.length; i++ ) args[i] = arguments[i];
				PubSub.publish( core.Constants.SHELL_MESSAGE, args );
			}
		});
		return Promise.resolve();
	}

};
