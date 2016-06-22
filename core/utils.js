
const DataCache = require( "./data-cache.js" );
const FileCache = require( "./file-cache.js" );

module.exports = {

	escape_backslashes: function(s, count){
		count = count || 1;
		var repl = "";
		for( var i = 0; i< count; i++ ) repl += '\\';
		return s.replace( /\\/g, repl );
	},

	/**
	 * add an import to document head.  will remove/re-add.
	 */
	install_html_component: function( href ){

		var nodes = document.querySelectorAll( "link[rel='import']");
		for( var i = 0; i< nodes.length; i++ ){
			if( nodes[i].href === href ) nodes[i].parentElement.removeChild(nodes[i]);
		}
		var node = document.createElement( "link" );
		node.setAttribute( "rel", "import" );
		node.setAttribute( "href", href );
		document.querySelector( "head" ).appendChild( node );
		
	},

	/**
	 * patch for file paths when running in a hybrid asar packed/unpacked
	 * environment.  we generally use __dirname to map paths, but that will
	 * fail for our unpacked binaries.
	 * 
	 * broken out to normalize.
	 */
	patch_asar_path: function( original_path ){

		// (1) should almost certainly not be /g.
		// (2) is it guaranteed to be "app.asar"? 
		
		return original_path.replace( /app\.asar/g, "app.asar.unpacked" );

	},

	init: function(R){
		this.data_cache = new DataCache(R);
		this.file_cache = new FileCache();
		return this;
	}

};


