'use strict';

if (require('electron-squirrel-startup')) return; // installer

const path = require( "path" );
const electron = require('electron');
const electronwindowstate = require('electron-window-state');

const {ipcMain} = electron;
const {app} = electron;
const {BrowserWindow} = electron;

let win;

app.on('ready', function(){

	let windowstate = electronwindowstate({
		defaultWidth: 1000,
		defaultHeight: 800
	});
	
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
    win.on('closed', function() { win = null; });

});

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

ipcMain.on('download', function(event, opts = {}){

	let url = opts.url;
	let dest = opts.destfile;
	let listener = function(event, item, webContents){
		
		let totalBytes = item.getTotalBytes();
		let filePath = dest || path.join(app.getPath('downloads'), item.getFilename());

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
	
});
