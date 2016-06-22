/**
 * Copyright (c) 2016 Structured Data, LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to 
 * deal in the Software without restriction, including without limitation the 
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or 
 * sell copies of the Software, and to permit persons to whom the Software is 
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in 
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

"use strict";

const PubSub = require( "pubsub-js" );

/**
 * open the stacked ("tools") pane.  if arguments are passed to
 * this function (beyond core), it will pass them to the attach() 
 * method.
 */
const open_stacked_pane = function( core, args ){

	let stacked = document.getElementById( "stacked-panel" );

	if( !stacked ){
		stacked = document.createElement( "stacked-panel" );
		stacked.setAttribute( "data-preserve", true );
		Object.assign( stacked, {
			id: "stacked-panel", 
			hidden: false,
			_onShow: function(){
				if( stacked.hidden ){
					stacked.hidden = false;
					stacked.signal_children( !stacked.hidden );
				}
			},
			_onHide: function(){
				if( !stacked.hidden ){
					stacked.hidden = true;
					stacked.signal_children( !stacked.hidden );
				}
			},
			_onUnload: function(){

			}
		});
	}
	
	PubSub.publish( core.Constants.SIDE_PANEL_ATTACH, { node: stacked });

	if( args ){
		let x = stacked.attach.apply( stacked, args );
		if( x ){
			var a = x.getAttribute( "data-preserve" );
			if( a && a !== "false" ){
				document.getElementById( "orphans" ).appendChild(x);
			}
			else if( x._onUnload ) x._onUnload.call(this);
		}
	}

	return stacked;
};

/**
 * remove a sub-panel from the stacked ("tools") pane.  if that
 * was the last panel in the stacked pane, close it.
 */
const remove_from_stacked_pane = function(core, node){

	let stacked = document.getElementById( "stacked-panel" );
	if( !stacked ) return;	
	stacked.remove( node );
	if( node.hasAttribute( "data-preserve" )
		&& node.getAttribute( "data-preserve" ) !== "false" ){
		let cache = document.getElementById( "orphans" );
		cache.appendChild( node );
	}
	if( stacked.is_empty()) PubSub.publish( core.Constants.SIDE_PANEL_POP );
	
};

module.exports = {

	init: function( core ){

		Object.assign( core.Constants, {
			STACKED_PANE_SHOW: "stacked-pane-show",
			STACKED_PANE_REMOVE: "stacked-pane-remove",
			STACKED_PANE_INSERT: "stacked-pane-insert"
		});

		// remove node
		PubSub.subscribe( core.Constants.STACKED_PANE_REMOVE, function( channel, node ){
			remove_from_stacked_pane( core, node );
		});

		// open stacked pane, and optionally add node
		PubSub.subscribe( core.Constants.STACKED_PANE_SHOW, function( channel, opts ){
			open_stacked_pane.call( this, core, opts );
		});

		// create a sub-panel and attach a node.  same as show, except 
		// you don't have to build the panel.
		PubSub.subscribe( core.Constants.STACKED_PANE_INSERT, function( channel, opts ){

			let panel = document.createElement( "div" );
			panel.className = "panel";
				
			let header = document.createElement( "panel-header" );
			header.title = opts.title || "Panel";
				
			var closelistener = function(){
				header.removeEventListener( "close", closelistener );
				remove_from_stacked_pane( core, panel );
			};

			header.addEventListener( "close", closelistener );
			panel.appendChild( header );
			panel.appendChild( opts.node );
			
			panel._onShow = opts.onShow || function(){};
			panel._onHide = opts.onHide || function(){};
			panel._onUnload = opts.onUnload || function(){};
			
			open_stacked_pane( core, [ panel, opts.position || 0 ]);
				
		});

	}

};