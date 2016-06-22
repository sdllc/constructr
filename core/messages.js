/**
 * load messages from json file.  placeholder for i18n.
 */

const fs = require( "fs" );

/** array -> multiline string */
var concatenate_strings = function( obj ){
	var keys = Object.keys(obj);
	keys.forEach( function( key ){
		var val = obj[key];
		if( Array.isArray( val )) obj[key] = val.join( "\n" );
		else if( typeof val === "object" ) obj[key] = concatenate_strings(val);
	});
	return obj;
}

/** singleton */
var Messages = function(){
	this.load = function(path){
		var contents = fs.readFileSync( path, { encoding: "utf8" });
		if( !contents ) return {};
		try { 
			contents = JSON.parse( contents );
			return concatenate_strings( contents );
		}
		catch( e ){
			console.err( e );
		}
		return {};
	};
};

module.exports = new Messages();

