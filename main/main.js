'use strict';

// installer 
if (require('electron-squirrel-startup')) return;

const path = require( "path" );
const electron = require('electron');
const electronwindowstate = require('electron-window-state');

// const ipcMain = require('electron').ipcMain;
// const app = electron.app;
// const BrowserWindow = electron.BrowserWindow;

const {ipcMain} = electron;
const {app} = electron;
const {BrowserWindow} = electron;

let win;

// handle command line arguments
//
// --r-home=X 
//

/** 
 * this moved to renderer, at least for now; if you need 
 * to process args in main just turn it back on
 *
process.argv.forEach( function( arg ){
	var m = arg.match( /--r-home=(.*?)$/ );
	if( m ){
		var p = path.resolve(untildify(m[1]));
		console.info( "P", p );
		process.env.R_HOME = p;
	}
	else console.info( "nope", arg );
});
*/

var download = function(win, opts = {}){
	
	var url = opts.url;
	var dest = opts.destfile;
	
	var listener = function(event, item, webContents){
		
		var totalBytes = item.getTotalBytes();
		var filePath = dest || path.join(app.getPath('downloads'), item.getFilename());

		// NOTE: this fails with unix-y paths.  R is building these paths incorrectly

		if( process.platform === "win32" ){
			filePath = filePath.replace( /\//g, "\\" );
		}
		item.setSavePath(filePath);

		item.on('updated', () => {
			win.setProgressBar(item.getReceivedBytes() / totalBytes);
			webContents.send( 'download-progress', { received: item.getReceivedBytes(), total: totalBytes });
		});

		item.on('done', (e, state) => {

			if (!win.isDestroyed()) {
				win.setProgressBar(-1);
			}

			if (state === 'interrupted') {
				// electron.dialog.showErrorBox('Download error', `The download of ${item.getFilename()} was interrupted`);
			}

			webContents.send( 'download-complete', { path: filePath, name: item.getFilename(), size: totalBytes, state: state });
			webContents.session.removeListener('will-download', listener);
			
		});

	};
	
	win.webContents.session.on( 'will-download', listener );
	win.webContents.downloadURL(url);
	
};

var createWindow = function(){

	let windowstate = electronwindowstate({
		defaultWidth: 1000,
		defaultHeight: 800
	});
	
	// Create the browser window.
	win = new BrowserWindow({
		'x': windowstate.x,
		'y': windowstate.y,
		'width': windowstate.width,
		'height': windowstate.height,
		'webPreferences': {
			'experimentalCanvasFeatures': true
		}
	});
	
	win.main_process_args = process.argv.slice(0);
	
    windowstate.manage(win);
    win.loadURL('file://' + __dirname + '/index.html');

    win.on('closed', function() {
        win = null;
    });
    
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', function () {
	if (win === null) {
		createWindow();
	}
});

ipcMain.on('system', function(event, arg){
	if( arg === "quit" ){
		app.quit();
	}
});

ipcMain.on('download', function(event, arg){
	// console.info( arg );
	download( win, arg );
});

