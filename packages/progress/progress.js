/**
 * progress bar(s)
 * 
 * reimplemented as a singleton, which handles its own events.
 * we need to bind an event source potentially after construction,
 * so there's an init() method. 
 */

var ProgressBar = function(opts){
	
	opts = opts || { min: 0, max: 1, initial: 0, label: undefined };
	if( typeof opts.value === "undefined" ) opts.value = opts.initial || 0;
	opts.range = opts.max - opts.min;
	
	this.render = function(){
		var p = Math.round( 100 * ( opts.value - opts.min ) / opts.range );
		progress.setAttribute( 'style', `width: ${p}%` );	
		if( opts.label ){
			if( typeof opts.label === "function" ){
				label.textContent = opts.label.call( this, p );
			}	
			else {
				label.textContent = `${opts.label}: ${p}%`;
			}
		}
		else label.textContent = `${p}%`;

	}
	
	this.value = function (){
		if( arguments.length ){
			opts.value = arguments[0];
			this.render();
		}
		return opts.value;
	}

	this.max = function (){
		if( arguments.length ){
			opts.max = arguments[0];
			opts.range = opts.max - opts.min;
			this.render();
		}
		return opts.max;
	}

	this.min = function (){
		if( arguments.length ){
			opts.min = arguments[0];
			opts.range = opts.max - opts.min;
			this.render();
		}
		return opts.min;
	}

	this.label = function(){
		if( arguments.length ){
			opts.label = arguments[0];
			this.render();
		}
		return opts.label;
	}

	this.node = document.createElement( "div" );
	this.node.className = "progress-bar";

	var progress = document.createElement( "div" );
	progress.className = "progress-bar-progress";
	this.node.appendChild( progress );

	var label = document.createElement( "div" );
	label.className = "progress-bar-label";
	this.node.appendChild( label );

	if( opts.style ) this.node.setAttribute( 'style', data.$data.style );
	else if( opts.width ){
		var width = opts.width;
		if( typeof opts.width === "number" ) width = opts.width + "em";
		this.node.setAttribute( 'style', `width: ${width};` );
	}
	
	this.render();
		
};

var progress_bars = {};

var handler = function(func, data){
	
	console.info( data );
	if( typeof data.$data.key === "undefined" ) return; // should be an error?
			
	var key = data.$data.key.toString();
	var ref = progress_bars[key];

	if( !ref && !data.$data.closed ){
		progress_bars[key] = new ProgressBar( data.$data );
		ref = progress_bars[key];
		if( func ) func.call( this, ref.node );
	}
	else if( ref ){
		ref.value(data.$data.value);
		if( data.$data.closed ){
			delete(progress_bars[key]);
		}
	}
	
}

module.exports = {

	init: function(core){
		core.R.on( 'progress.bar', handler.bind( this, function(node){
			core.shell.insert_node( node, true );
		}));
		return Promise.resolve()
	},

	createProgressBar: function(opts){
		return new ProgressBar( opts );
	}

};