
"use strict";

const path = require( "path" );
const PubSub = require( "pubsub-js" );

/**
 * show a dialog and return result/cancel via promise
 * 
 * fields title, cancel-button, cancel-text, accept-button, 
 * accept-text are passed directly to dialog (there are defaults).
 * 
 * validate() is a function that is called on accept events, 
 * if validate returns false it prevents closing the dialog.
 * 
 * content is added to the dialog, this should be an html node.
 * content will get removed the next time this function is called,
 * so manage that node if you need to.
 */
function show_dialog(core, opts){
	
	opts = opts || {};

	var on_cancel = function(){
		dialog.removeEventListener( "cancel", on_cancel );
		dialog.removeEventListener( "accept", on_accept );
		dialog.show(false);
		setImmediate( function(){ 
			if( opts.complete ) opts.complete(false);
		});
	};
	
	var on_accept = function(){
		if( opts.validate && !opts.validate.call(dialog)) return;
		dialog.removeEventListener( "cancel", on_cancel );
		dialog.removeEventListener( "accept", on_accept );
		dialog.show(false);
		setImmediate( function(){ 
			if( opts.complete ) opts.complete(true);
		});
	};
	
	var dialog = document.getElementById( "dialog" );
	if( !dialog ){
		dialog = document.createElement( "html-dialog" );
		dialog.id = "dialog";
		dialog.addEventListener( "cancel", function(e){
			dialog.show(false);	
		});
		dialog.show(false);
		document.body.appendChild( dialog );
	}

	dialog.addEventListener( "cancel", on_cancel );
	dialog.addEventListener( "accept", on_accept );

	// content
	
	dialog.clear();
	if( opts.content ) dialog.appendChild( opts.content );

	// set fields or defaults
	
	['cancel-button', 'accept-button'].map( function( a ){
		if( typeof opts[a] !== "undefined" ) dialog[a] = opts[a];
		else dialog[a] = true;
	})
	
	dialog['cancel-text'] = opts['cancel-text'] || "Cancel";
	dialog['accept-text'] = opts['accept-text'] || "Accept";
	
	dialog.title = opts.title || "Dialog";
	
	// ok, show
	
	dialog.show();
		
}

module.exports = {

	init: function(core){

		let html = path.join( "packages", "html-dialog", "dialog.html" );
		core.Utils.install_html_component( html );

		Object.assign( core.Constants, {
			DIALOG_SHOW: "dialog-show"
		});

		PubSub.subscribe( core.Constants.DIALOG_SHOW, function( channel, opts ){
			show_dialog( core, opts );
		});

	}

};