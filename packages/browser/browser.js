
var path = require("path");
var PubSub = require( "pubsub-js" );

/** inject stylesheet into help pages */
var help_stylesheet = null;

module.exports = {

	init: function(core){

		var html = path.join( "packages", "browser", "browser.html" );
		core.Utils.install_html_component( html );

		core.Hooks.install( "browser", function(hook, url){

			if( core.Settings["browser.panel"])
			{
				var browser = document.getElementById( "browser-pane" );
				if( !browser ){

					browser = document.createElement( "browser-component" );
					browser.id = "browser-pane";
					browser.cache = core.Utils.file_cache;

					// don't destroy if the panel closes
					browser.setAttribute( "data-preserve", true );
			
					// close box
					browser.addEventListener( "close", function(e){
						//sidePanel.pop();
						PubSub.publish( "side-panel-pop", browser );
					});
					
					// on load, possibly inject stylesheet
					browser.addEventListener( 'load-commit', function(e){
						var url = e.url || e.detail.url;
						if( url && url.match( /^http\:\/\/127\.0\.0\.1\:\d+\/(?:library|doc)\// )){
							if( help_stylesheet && help_stylesheet !== "default" ){
								var ss = path.join( help_styles.dir, help_stylesheet + ".css" );
								browser.inject_stylesheet( ss );
							}
						}
					});

				}

				/** 
				 * this must be done _after_ the parent has been changed 
				 * or it will crash hard (this is a bug in electron or polymer?)
				 */
				browser._onShow = function(){
					browser.open( url );
				};

				PubSub.publish( "side-panel-attach", { node: browser });
				return true;
				
			}
			return false;

		});

		return Promise.resolve();
	}

};