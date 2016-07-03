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
var menu_index = null;

var instances = [];

var R = null;

var updateData = function( inst ){

	var set = inst ? [inst] : instances;
	set.forEach( function( instance ){
		if( !instance.node || !instance.field || !instance.visible ) return;
        let cmd;

        if( instance.menutype === "watch" ){
            let idx = instance.index + 1; // r indexing
            cmd = `eval( jsClientLib:::.data.env$watches[[${ idx }]]$expr, envir=jsClientLib:::.data.env$watches[[${ idx }]]$envir )`;
        }
        else {
            cmd = instance.field;
        }

		R.queued_internal( cmd ).then( function( rsp ){
			if( rsp.response && rsp.response.$data ){
                if( rsp.response.$type === "matrix" ) updateFromMatrix( rsp.response, instance );
				else updateFromFrame( rsp.response, instance );
            }
		});

	});
};

/**
 * format an R date.  From docs:
 * 
 * Dates are represented as the number of days since 1970-01-01, with negative values for earlier dates. 
 * 
 */
const format_date = function(days){

    let date = new Date();
    date.setTime( days * 86400000 ); 

    // why is month 0-based and date 1-based?
    let m = date.getUTCMonth() + 1;
    let d = date.getUTCDate();

    return `${date.getUTCFullYear()}-${(m<10?"0":"")+m}-${(d<10?"0":"")+d}`;

}

const updateFromMatrix = function(mat, instance){

//    console.info( mat );

    let rows = mat.$nrows;
    let cols = mat.$ncols;

//    console.info( rows, cols );

    let colclasses = [];
    if( mat.$data.length ){
        if( typeof mat.$data[0] === "string" )
            for( let i = 0; i< cols; i++ ) colclasses[i] = "string";
    }

    // construct a data array: column-based

    let data = new Array( cols );
    for( let i = 0; i< cols; i++ ){
        data[i] = mat.$data.splice( 0, rows );
    }

    // dimnames: 0=rows, 1=cols (always? Y)

    // console.info( data );

    let rownames = true;
    let colnames = true;
    
    if( mat.$dimnames && mat.$dimnames.$data ){
        if( mat.$dimnames.$data[0] ) rownames = mat.$dimnames.$data[0];
        if( mat.$dimnames.$data[1] ) colnames = mat.$dimnames.$data[1];
    }

    instance.node.update({ 
        data: data, 
        column_headers: colnames, 
        row_headers: rownames,
        column_classes: colclasses
    });

}

const updateFromFrame = function(df, instance){
	
    let table = [], 
        column_headers = [], 
        column_classes = [],
        row_headers;
	
	var data = df.$data;
	var cols = Object.keys( data );
	if( cols.length !== 0 ) {
	
        // convert factors -> strings. 
        // update: +Date. other classes? 

        let tstart = process.hrtime();

        let len = 0;
        let names = df.$names;
        table = names.map( function( name, idx ){
            let arr;
            column_headers.push( name );

            if( Array.isArray( df.$data[name] )){
                arr = df.$data[name];
                if( arr.length ){
                    if( typeof arr[0] === "string" ) column_classes[idx] = "string";
                }
            }
            else if( typeof df.$data[name] === "object" ){
                let obj = df.$data[name];
                if( obj.$type === "factor" ){
                    for( let i = 0; i< obj.$data.length; i++ ){
                        obj.$data[i] = obj.$levels[obj.$data[i]-1];
                    }
                    column_classes[idx] = "factor";
                }
                else if( obj.$class === "Date" ){
                    for( let i = 0; i< obj.$data.length; i++ ){
                        obj.$data[i] = format_date(obj.$data[i]);
                    }
                    column_classes[idx] = "date";
                }
                arr = obj.$data;
            }
            len = Math.max( len, arr.length );
            return arr;
        });

        row_headers = df.$rownames || true;        

        let tend = process.hrtime(tstart);

	}
    
    instance.node.update({ 
        data: table, 
        column_headers: column_headers, 
        row_headers: row_headers,
        column_classes: column_classes
    });

};

var createInstance = function( field, id, menutype, menuindex ){

    let node = document.createElement( "display-grid" );
    let instance = { 
        node: node, 
        field: field, 
        menutype: menutype,
        index: menuindex,
        visible: true,
        id: id || 0 
    };

    // drop any instances with the same id (!==0)
    instances = instances.filter( function( inst ){
        return ( inst.id === 0 || inst.id !== id );
    });

    instances.push( instance );

    let func = function(){
        if( instance.visible ){
			setImmediate( function(){
				updateData.call( this, instance );
			}, this );
        }
    };

    var rslt = {
        node: node,
        onShow: function(){
            PubSub.subscribe( 'resize', func );
            instance.visible = true;
			setImmediate( function(){
				updateData.call( this, instance );
			}, this );
        },
        onHide: function(){
            PubSub.unsubscribe( 'resize', func );
            instance.visible = false;
        },
        onUnload: function(){
            PubSub.unsubscribe( 'resize', func );
            instance.visible = false;
            instance.node = null;
        }
    };

    return rslt;

};

const hasClass = function(rclass, target){
    if( !Array.isArray( target )) target = [target];
    return target.some( function( test ){
        return ( Array.isArray( rclass ) && rclass.includes( test )) || rclass === test;
    });
}

module.exports = {

	init: function(core){
		
		R = core.R;

        let html = path.join( "packages", "table", "grid.html" );
		core.Utils.install_html_component( html );
        
		// install hooks
		
		// update: data changes
		core.Hooks.install( "update", function(){
			updateData();
		});

        core.Hooks.install( "preferences_panel", function(){
            console.info( "hook; tpp " + Settings["table.panel.position"]);
            return new PreferencesSelect({
               label: "Table panel position",
               value: Settings["table.panel.position"] || 2 ,
               setting: "table.panel.position",
               options: [ 2, 3, 4 ]
            });
        });

		var template = {
			label: "View table",
			click: function( menuitem ){
				var opts = createInstance( menu_target, 100, menuitem.menutype, menu_index );
				opts.position = Number( core.Settings["table.panel.position"] || 3) || 3; 
				opts.title = "Table view: " + menu_target;
				PubSub.publish( core.Constants.STACKED_PANE_INSERT, opts );
			}
		};

		// CM: add a menu item if it's a frame (or descends from frame)
		core.Hooks.install( "locals_context_menu", function( hook, menu ){

			// there's got to be a better way to install this
			if( !menu_item1 ){
				menu_item1 = new MenuItem(template);
                menu_item1.menutype = "locals";
				menu.append( menu_item1 );
			}
			menu_target = menu.target.name;
			menu_item1.visible = hasClass( menu.target.rclass, [ 'data.frame', 'matrix' ]);
			
		});

		core.Hooks.install( "watch_context_menu", function( hook, menu ){

			// there's got to be a better way to install this
			if( !menu_item2 ){
				menu_item2 = new MenuItem(template);
                menu_item2.menutype = "watch";
				menu.append( menu_item2 );
			}
            menu_index = menu.$index;
			menu_target = menu.target.name;
			menu_item2.visible = hasClass( menu.target.rclass, [ 'data.frame', 'matrix' ]);

		});

	}
	
};

