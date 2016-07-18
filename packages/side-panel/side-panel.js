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

//const subPanels = [];
//const widthCache = [];

const sidePanels = {};
const sidePanelWidth = {};

const PARENT_ID = "shell-layout";
const CACHE_NODE_ID = "orphans";

var SubPanel = function( parent_node, target_index, panel_id, cache ){

	let history = [];
//    let parent_node = document.getElementById(parent_selector) || 
//        document.querySelector( parent_selector );

    // target index is the desired index of the panel, but previous indexes
    // may not exist.  so we need to figure out what exists, and then use that
    // to determine an insert index.
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

        // widthCache[target_index] = cached_size;
        
        node.setSize({ size: 0, hide: true });


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

            let size = 0; // widthCache[target_index] ? widthCache[target_index] : 0;
            let inst = this;

            node.setSize({ 
                size: size, 
                balance: !size,
                callback: function(){
                    if( content._onShow ) content._onShow.call(inst);
                    if( opts.shown ) opts.shown.call(inst);
                }
            });

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
            let side = opts.side;
            if( side !== "left" ) side = "right";

            if( !sidePanels[side] ){

                let width = sidePanelWidth[side] ? sidePanelWidth[side] : 33;
                let parent = document.getElementById(PARENT_ID);
                let node = parent.insertPane( 0, side === "left" ? 0 : -1 );

                parent.setSize({
                    target: node,
                    take_from: "center-pane",
                    size: width
                });

                node.id = side + "-layout-pane";

                let splitter = document.createElement( "split-panel" );
                splitter.direction = "horizontal";
                node.appendChild( splitter );
                sidePanels[side] = { node: node, splitter: splitter, count: 0, subPanels: [] };

            }

            if( !sidePanels[side].subPanels[index] ){
                sidePanels[side].subPanels[index] = new SubPanel( sidePanels[side].splitter, index, "side-panel-" + side + "-" + index, CACHE_NODE_ID );
                sidePanels[side].count++;
            }

            sidePanels[side].subPanels[index].attach(opts);

		});

		PubSub.subscribe( core.Constants.SIDE_PANEL_POP, function(channel, opts){
            
            let index = opts ? opts.panel || 0 : 0;
            let side = opts ? opts.side : 0;
            if( side !== "left" ) side = "right";

            if( !sidePanels[side] ) return;

            sidePanels[side].count--;

            if( !sidePanels[side].subPanels[index] ) return;

			sidePanels[side].subPanels[index].pop();

            sidePanels[side].splitter.removePane( "side-panel-" + side + "-" + index );
            sidePanels[side].subPanels[index] = null;

            if( sidePanels[side].count === 0 ){
                sidePanelWidth[side] = sidePanels[side].node.split;
                let parent = document.getElementById(PARENT_ID);
                parent.setSize({
                    target: sidePanels[side].node,
                    size: 0,
                    hide: true,
                    take_from: "center-pane" 
                }).then( function(){
                    parent.removePane( sidePanels[side].node );
                    sidePanels[side] = null;
                });
            }

//            document.getElementById( PARENT_ID ).removePane( "side-panel-" + index );
		})

		return Promise.resolve();
	}
}

