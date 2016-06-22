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
const Handsontable = require( path.join( __dirname, "handsontable", "handsontable.full.min.js" ));

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
		if( !instance.node || !instance.field ) return;
		R.queued_internal( instance.field ).then( function( rsp ){
			if( rsp.response && rsp.response.$data )
				updateFromFrame( rsp.response, instance );
		});
	});
};

var updateFromFrame = function(df, instance){
	
	var settings = {};
	
	var data = df.$data;
	var cols = Object.keys( data );
	if( cols.length === 0 ) {
		settings = {data:[[]]};
	}
	else {
	
		if( df.$names ) cols = df.$names;

		var rows = 0;
		if( Array.isArray( data[cols[0]] )) rows = data[cols[0]].length;
		else rows = data[cols[0]].$data.length;
		
		var factors = new Array( cols.length );
		for( var c = 0; c< cols.length; c++ ){
			factors[c] = !( Array.isArray( data[cols[c]]));
		}
		
		var col_headers = [].concat(cols);
		var table = new Array( rows );
		
		for( var r = 0; r< rows; r++ ){
			var row = new Array( cols.length );
			
			for( var c = 0; c< cols.length; c++ ){
				if( factors[c] ){
					row[c] = data[cols[c]].$levels[data[cols[c]].$data[r]-1];
				}
				else row[c] = data[cols[c]][r];
			}
			table[r] = row;
		}
		
		var row_headers = undefined;
		if( df.$rownames ){
			row_headers = df.$rownames;
		}
		else {
			row_headers = new Array( rows );
			for( var r = 0; r< rows; r++ ) row_headers[r] = r+1;
		}
		
		settings = { 
			data: table,
			stretchH: 'all',
			rowHeaders: row_headers,
		    manualColumnResize: true,
			colHeaders: col_headers,
			readOnly: true,
			readOnlyCellClassName: "x"
		};
	}

	if( !instance.table ){
		instance.table = new Handsontable( instance.node, settings );
	}
	else {
		instance.table.updateSettings(settings);
		instance.table.render();
	}
	
};

var createInstance = function( field ){

	var parentnode = document.createElement( "div" );
	parentnode.setAttribute( "style", "width: 100%; height: 100%; position: relative; ")
		
	var childnode = document.createElement( "div" );
	childnode.setAttribute( "style", "overflow: auto; top: 0px; left: 0px; bottom: 0px; right: 0px; position: absolute; " );
	
	parentnode.appendChild( childnode );

	var instance = {
		node: childnode,
		field: field	
	};

	var rslt = {

		onUnload: function(){
			if( instance.table ) instance.table.destroy();
			instance.table = null;
			for( var i = 0; i< instances.length; i++ ){
				if( instances[i] === instance ){
					instances.splice( i, 1 );
					break;
				}
			}
		},
	
		onShow: function(){
			setImmediate( function(){
				updateData.call( this, instance );
			}, this );
		},

		node: parentnode
	
	};

	instances.push( instance );

	return rslt;
	
};

module.exports = {

	init: function(core){
		
		R = core.R;

		// add the stylesheet if it's not already there
		var css = "packages/table/handsontable/handsontable.full.min.css";
		if( !document.querySelector("link[href='" + css + "']")){
			var node = document.createElement( "link" );
			node.setAttribute( "rel", "stylesheet" );
			node.setAttribute( "href", css );
			document.head.appendChild( node );
		}
		
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

				var opts = createInstance( menu_target );
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

		/*				
		core.Hooks.install( "watch_context_menu", function( hook, menu ){
	
			console.info( "WCM" );
	
			// there's got to be a better way to install this
			if( !menu_item2 ){
				menu_item2 = new MenuItem(template);
				menu.append( menu_item2 );
				// menu.insert( 0, menu_item2 );
			}
			menu_target = menu.target.name;
			menu_item2.visible = 
				((Array.isArray( menu.target.rclass ) && menu.target.rclass.includes( "data.frame" )) 
					|| menu.target.rclass === "data.frame" );	
		});
		*/
		
	}
	
};

