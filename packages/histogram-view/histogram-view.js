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

const electron = require('electron');
const remote = electron.remote;
const Menu = remote.Menu;
const MenuItem = remote.MenuItem;

var path = require( "path" );

const DEFAULT_PANEL_POSITION = 3;

const createInstance = function(opts, src){

    let node = document.createElement("histogram-view");
    node.data = opts.data.$data.histogram;

    let on_locals = function(ch, locals){
        console.info( opts, locals );
        let name = opts.name;

        if( !locals.$data.fields.$data[name] 
            || !locals.$data.fields.$data[name].$data    
            || !locals.$data.fields.$data[name].$data.histogram ){
                node.data = null;
                return;
        }

        node.data = locals.$data.fields.$data[name].$data.histogram;
    }

    return {
        node: node,
        title: "Histogram view: " + opts.name,

        onShow: function(){
            console.info( "hv show" );
            if( src === "locals" ){
                PubSub.subscribe( "locals", on_locals );
            }
        },
        onHide: function(){
            console.info( "hv hide" );
            if( src === "locals" ){
                PubSub.unsubscribe( "locals", on_locals );
            }
        },
        onUnload: function(){
            console.info( "hv unload" );
        }

    };
};

module.exports = {

	init: function(core){

        let html = path.join( "packages", "histogram-view", "histogram.html" );
        core.Utils.install_html_component( html );

        core.Hooks.install( "locals_click", function( hook, opts ){
            // ...
            return false;    
        });

		let menuitem = new MenuItem({
			label: "View histogram",
			click: function( menuitem ){

                var opts = createInstance( menuitem.menu_target, "locals" );
                opts.position = Number( core.Settings["histogram.panel.position"] || DEFAULT_PANEL_POSITION) || DEFAULT_PANEL_POSITION; 
				PubSub.publish( core.Constants.STACKED_PANE_INSERT, opts );
			}
		});

		// CM: add a menu item if it's a frame (or descends from frame)
		core.Hooks.install( "locals_context_menu", function( hook, menu ){
            menuitem.menu_target = menu.target;
			menu.insert( 3, menuitem );
			menuitem.visible = !!menu.target.data.$data.histogram; 
		});

    }

};