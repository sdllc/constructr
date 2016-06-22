/**
 * this is a layer on top of electron's existing menu template
 * scheme that adds a few features we specifically want.
 */

"use strict";

const PubSub = require( "pubsub-js" );
const fs = require( "fs" );
const path = require( "path" );
const Menu = require('electron').remote.Menu;

/**
 * (1) remove any elements that have a "platform" attribute which
 *     does not match the current platform.
 * 
 *     UPDATE: we now also support !platform (gyp style)
 * 
 * (2) translate elements with a platform suffix if the platform
 *     matches.
 * 
 * (3) if an element has a "message" attribute, construct a click
 *     function.
 */
function build_menu_template( src, name, click ){
	
	if( !click ) click = function(message){ 
		PubSub.publish( "menu-click", {
			menu: name,
			message: message,
			item: arguments[1],
			focusedWindow: arguments[2]
		}); 
	};
	
	var platform_key = "-" + process.platform;
	return src.filter( function( entry ){
		
		var keys = Object.keys( entry );		
		keys.forEach( function( key ){
			if( key.endsWith( platform_key )){
				entry[key.substr( 0, key.length - platform_key.length )] = entry[key];
			}
		});
		
		for( var key in entry ){
			if(( key === "platform" && entry[key] !== process.platform )
				|| ( key === "!platform" && entry[key] === process.platform )){
				return undefined;
			}
			else {
				switch( key ){
				case "submenu":
					entry[key] = build_menu_template( entry[key], name, click );
					break;
				case "message":
					entry.click = click.bind( this, entry.message );
					break;
				}
			}
		}
		return entry;
	});

}

var MenuTemplate = function(path){

	try {
		this._template = fs.readFileSync(path, { encoding: "utf8" });
		if( this._template ){
			this._template = JSON.parse( this._template );
			var keys = Object.keys( this._template );
			keys.forEach( function( key ){
				this[key] = Menu.buildFromTemplate( build_menu_template( 
					this._template[key], key
				));
			}, this);
		}
	}
	catch( e ){
		console.error(e);
	}
	
};

module.exports = MenuTemplate;
