
"use strict";

const PubSub = require( "pubsub-js" );

var SidePanel = function( selector, cache ){

	var history = [];
	var node = document.querySelector(selector);
	var orphans = document.querySelector(cache);

	var cached_size = 0;

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
				
		var parent = node.parentNode;
		while( parent && parent.tagName !== "SPLIT-PANEL" ) parent = parent.parentNode;
		if( parent ){
			parent.setSize({
				target: node,
				size: 0,
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
					size: cached_size ? cached_size : 33
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

var sidePanel = null;

module.exports = {
	init: function( core ){

		Object.assign( core.Constants, {
			SIDE_PANEL_ATTACH: "side-panel-attach",
			SIDE_PANEL_POP: "side-panel-pop"
		});

		sidePanel = new SidePanel("#side-panel", "#orphans");

		PubSub.subscribe( core.Constants.SIDE_PANEL_ATTACH, function(channel, opts){
			sidePanel.attach(opts);
		});

		PubSub.subscribe( core.Constants.SIDE_PANEL_POP, function(channel, node){
			sidePanel.pop();
		})

		return Promise.resolve();
	}
}


