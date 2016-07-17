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

const sidePanels = [];
const widthCache = [];

const PARENT_ID = "shell-layout";
const CACHE_NODE_ID = "orphans";


var SidePanel = function( parent_selector, target_index, panel_id, cache ){

	let history = [];
    let parent_node = document.getElementById(parent_selector) || 
        document.querySelector( parent_selector );

    // target index is the desired index of the panel, but previous indexes
    // may not exist.  so we need to figure out what exists, and then use that
    // to determine an insert index.

    /* 
    let insert_index = -1;
    let sps = parent_node.querySelectorAll( "split-pane" );
    for( let i = 0; i< sps.length; i++ ){
        let id = sps[i].id;
        let m = id.match( /side-panel-(\d+)$/);
        if(m && m[1] > target_index ){
            insert_index = i;
            break;
        }
    }
    */
    // TEST: LEFT SIDE
    let insert_index = 0;
    let sps = parent_node.querySelectorAll( "split-pane" );
    for( let i = 0; i< sps.length; i++ ){
        let id = sps[i].id;
        if( id === "center-pane" ){
            console.info( "@CP", i );
            insert_index = Math.max( 0, i-1 );
            break;
        }
        let m = id.match( /side-panel-(\d+)$/);
        if( m && m[1] > target_index ){

            console.info( "STOP on", id, i );

            insert_index = i;
            break;
        }
    }

    // console.info( "inserting at index", insert_index );

    let node = parent_node.insertPane(0, insert_index);
    if( panel_id ) node.id = panel_id;

	let orphans = document.getElementById(cache) || document.querySelector(cache);
	let cached_size = 0;

	this.pop = function( adding ){

		var children = node.getEffectiveChildren ? node.getEffectiveChildren() : node.children;
		if( !children.length ) return;
		
		var child = children[0];
		node.removeChild(child);
				
		// hold on to this?
		if( !child.hasAttribute( "data-preserve" )
			|| child.getAttribute( "data-preserve" ) === "false" ){
			if( child._onUnload ) child._onUnload.call(this);
		}
		else {

			orphans.appendChild(child);
			if( child._onHide ) child._onHide.call(this);
		
			// push onto history stack -- FIXME: ID or node?
			if( adding ) history.push( child.id );
		}

		// is there something on history, which we need to insert?
		
		// ...
		
		// grab the current size, then close the panel

		cached_size = node.split;
		
		if( adding ) return; // don't need to close it

        widthCache[target_index] = cached_size;
        
		var parent = node.parentNode;
		while( parent && parent.tagName !== "SPLIT-PANEL" ) parent = parent.parentNode;
		if( parent ){
			parent.setSize({
				target: node,
				size: 0,
                take_from: "center-pane",
				hide: true
			});
		}
				
	};

	this.attach = function(opts, toggle){
		
		var content = null;
		
		if( typeof opts.node === "string" ) content = document.querySelector( opts.node );
		else content = opts.node;
		if( !content ) throw( "Can't resolve node", opts.node );
		
		// if there is a child, remove it.  call any unload 
		// function that's provided (if you remove it; not if you
		// hide it?) 

		var attached = false;
		var children = node.getEffectiveChildren ? node.getEffectiveChildren() : node.children;
		if( children.length ){
			var child = children[0];
			if( child === content ){
				attached = true;
			}
			else {
				this.pop( true );
			}
		}


		// now attach this child and call any open callback
		
		if( !attached ){

			// if it's attached to a non-polymer node, attaching
			// to a polymer node seems to destroy it.  so remove 
			// it from the parent first.  FIXME: do this inside?
			
			if( content.parentNode ){
				content.parentNode.removeChild( content );
			}
			node.appendChild( content );
			
		}

		// if we've just removed the content, and set width to zero,
		// then width will be zero.  no point in measuring it.
				
		// and show if not visible
		if( node.split < 10 ){
			
			// find parent splitter. 
			var parent = node.parentNode;
			while( parent && parent.tagName !== "SPLIT-PANEL" ) parent = parent.parentNode;
			if( parent ){
				parent.setSize({
					target: node,
                    take_from: "center-pane",
					//size: cached_size ? cached_size : 33
                    size: widthCache[target_index] ? widthCache[target_index] : 33
				}).then( function(){
					if( content._onShow ) content._onShow.call(this);
					if( opts.shown ) opts.shown.call(this);
				});
			}
			
		}
		else {

			if( attached && toggle ){
				this.pop();
			}
			else {
				if( content._onShow ) content._onShow.call(this);
				if( opts.shown ) opts.shown.call(this);
			}
		}
		
	};

};

module.exports = {
	init: function( core ){

		Object.assign( core.Constants, {
			SIDE_PANEL_ATTACH: "side-panel-attach",
			SIDE_PANEL_POP: "side-panel-pop"
		});

		PubSub.subscribe( core.Constants.SIDE_PANEL_ATTACH, function(channel, opts){
            let index = opts.panel || 0;
            if( !sidePanels[index] ) sidePanels[index] = new SidePanel( PARENT_ID, index, "side-panel-" + index, CACHE_NODE_ID );
            sidePanels[index].attach(opts);
		});

		PubSub.subscribe( core.Constants.SIDE_PANEL_POP, function(channel, opts){
            let index = opts ? opts.panel || 0 : 0;
            if( !sidePanels[index] ) return; 
			sidePanels[index].pop();
            document.getElementById( PARENT_ID ).removePane( "side-panel-" + index );
            sidePanels[index] = null;
		})

		return Promise.resolve();
	}
}


