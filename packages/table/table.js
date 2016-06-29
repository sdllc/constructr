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


var path = require( "path" );

const PubSub = require( "pubsub-js" );

const electron = require('electron');
const remote = electron.remote;
const Menu = remote.Menu;
const MenuItem = remote.MenuItem;

var menu_item1 = null;
var menu_item2 = null;
var menu_target = null;

var instances = [];

var R = null;

var updateData = function( inst ){

	var set = inst ? [inst] : instances;
	set.forEach( function( instance ){
		if( !instance.node || !instance.field || !instance.visible ) return;
		R.queued_internal( instance.field ).then( function( rsp ){
            console.info( rsp );
			if( rsp.response && rsp.response.$data ){
				updateFromFrame( rsp.response, instance );
            }
		});
	});
};

var updateFromFrame = function(df, instance){
	
    let table;
	
	var data = df.$data;
	var cols = Object.keys( data );
	if( cols.length === 0 ) {
		table = [];
	}
	else {
	
        // organize the data so that we have an array
        // of columns.  the first entry in each column
        // is the header.  the first column is a list 
        // of row numbers (or row names, I guess).
        // other than that, convert factors -> strings.

        let tstart = process.hrtime();

        let len = 0;
        let names = df.$names;
        table = names.map( function( name ){
            let arr = [name];
            if( Array.isArray( df.$data[name] )){
                arr = arr.concat( df.$data[name] );
            }
            else if( typeof df.$data[name] === "object" ){
                for( let i = 0; i< df.$data[name].$data.length; i++ ){
                    df.$data[name].$data[i] = df.$data[name].$levels[df.$data[name].$data[i]-1];
                }
                arr = arr.concat( df.$data[name].$data );
            }
            len = Math.max( len, arr.length );
            return arr;
        });
        
        if( df.$rownames ){
            df.$rownames.unshift(" ");
            table.unshift( df.$rownames );
        }
        else {
            let header = new Array(len);
            header[0] = " ";
            for( let i = 1; i< len; i++ ) header[i] = i;
            table.unshift( header );
        }

        let tend = process.hrtime(tstart);

	}
    
    instance.node.updateData( table );

};

var createInstance = function( field, id ){

    let node = document.createElement( "display-grid" );
    let instance = { 
        node: node, 
        field: field, 
        visible: true,
        id: id || 0 
    };

    // drop any instances with the same id (!==0)
    instances = instances.filter( function( inst ){
        return ( inst.id === 0 || inst.id !== id );
    });

    instances.push( instance );

    var rslt = {
        node: node,
        onShow: function(){
            instance.visible = true;
			setImmediate( function(){
				updateData.call( this, instance );
			}, this );
        },
        onHide: function(){
            console.info( "table hide" );
            instance.visible = false;
        },
        onUnload: function(){
            console.info( "table unload (not really deleting yet)" );
            instance.visible = false;
            instance.node = null;
        }
    };

    return rslt;

};

module.exports = {

	init: function(core){
		
		R = core.R;

        let html = path.join( "packages", "table", "virtual-list-grid.html" );
		core.Utils.install_html_component( html );
        html = path.join( "packages", "table", "grid.html" );
		core.Utils.install_html_component( html );

		// install hooks
		
		// update: data changes
		core.Hooks.install( "update", function(){
			updateData();
		});

        core.Hooks.install( "preferences_panel", function(){
            console.info( "hook; tpp " + Settings["table_panel_position"]);
            return new PreferencesSelect({
               label: "Table panel position",
               value: Settings["table_panel_position"] || 2 ,
               setting: "table_panel_position",
               options: [ 2, 3, 4 ]
            });
        });

		var template = {
			label: "View table",
			click: function(){
				var opts = createInstance( menu_target, 100 );
				opts.position = Number( core.Settings["table_panel_position"] || 3) || 3; 
				opts.title = "Table view: " + menu_target;
				PubSub.publish( core.Constants.STACKED_PANE_INSERT, opts );
			}
		};

		// CM: add a menu item if it's a frame (or descends from frame)
		core.Hooks.install( "locals_context_menu", function( hook, menu ){

			// there's got to be a better way to install this
			if( !menu_item1 ){
				menu_item1 = new MenuItem(template);
				menu.append( menu_item1 );
			}
			menu_target = menu.target.name;
			menu_item1.visible = 
				((Array.isArray( menu.target.rclass ) && menu.target.rclass.includes( "data.frame" )) 
					|| menu.target.rclass === "data.frame" );	
			
		});

	}
	
};

