
"use strict";

const PubSub = require( "pubsub-js" );
const ipcRenderer = require('electron').ipcRenderer;

/**
 * download a file, using electron utilities and 
 * (optionally) adding a progress bar.
 */
const download_file = function(core, opts){
	
	return new Promise( function( resolve, reject ){
		
		let progressbar = null;

		if( !opts.quiet ){
			PubSub.publish( core.Constants.SHELL_MESSAGE, [ `\n${core.Messages.TRYING_URL}: ${opts.url}\n` ]);
			progressbar = core.Packages.progress.createProgressBar({
				label: function(p){
					return ( p >= 100 ) ? core.Messages.DOWNLOAD_COMPLETE : `${core.Messages.DOWNLOADING}: ${p}%`;
				}, 
				min: 0, max: 1, value: 0, width: 30
			});
			PubSub.publish( core.Constants.SHELL_INSERT_NODE, [progressbar.node, true]);
		}

		ipcRenderer.on( 'download-progress', function( event, args ){
			if( progressbar ){
				if( progressbar.max() === 1 ) progressbar.max( args.total );
				progressbar.value( args.received );
			}
		});

		ipcRenderer.on( 'download-complete', function( event, args ){
			
			if( args.state !== "completed" ){
				PubSub.publish(Constants.SHELL_MESSAGE, [
					`\n${core.Messages.DOWNLOAD_FAILED}: ${args.state}\n` 
				]);
			}

			ipcRenderer.removeAllListeners( "download-complete" );
			ipcRenderer.removeAllListeners( "download-progress" );
			
			resolve( args.state === "completed" ? 0 : -1 );

		});
		
		ipcRenderer.send( "download", opts );
		
	});
		
};

module.exports = {
	init: function(core){
		core.Hooks.install( "sync-request-p", function(hook, req){
			let cmd = req.command ? req.command : req.$data ? req.$data.command : null;
			if( cmd === "download" ){
				return download_file( core, req.$data.arguments.$data );
			}
			return null;
		});
	}
};

