const electron = require('electron');
const url = require('url');
const path = require('path');
const fs = require('fs');
const Tray = electron.Tray;
const iconPath = path.join(__dirname, 'Nextcloud.ico');
const {app, BrowserWindow, Menu} = electron;

// custom constants
const DEBUG = (app.isPackaged) ? false:true;
const configFilePath = path.join(__dirname, 'config.ini');

// custom variables
let mainWindow;
let addWindow;
let tray = null;

let ipc = electron.ipcMain;
var ncurl="", ncuser="", ncpwd="";
var dataarr, werte;

// Listen for app to be readyState
app.on('ready', function(){
	sendToTray();
	fs.readFile(configFilePath,'utf-8', (err, data) => {
		if(err){
			console.log("An error ocurred reading the file :" + err.message);
			return;
		}

		data.replace("\r", "");
		dataarr = data.split("\n");
		// Change how to handle the file content
		dataarr.forEach(splitMyData);
		if(DEBUG) { console.log("1: "+ncurl+"2: "+ncuser+"3: "+ncpwd); }
  });

});

// IPC from renderer
ipc.on('configChange', (event, newcontent) => {
	fs.writeFile(configFilePath, newcontent, (err) => {
		if(err) {
			console.log("Cannot update file...",err);
			return;
		}
	});
	console.log("Save successfull: "&configFilePath);
});

ipc.on('initConfigValues', (event, arg) => {
	console.log(arg);
	werte = ncurl+":"+ncuser+":"+ncpwd;
		// werte = werte.concat(ncurl,"\n",ncuser,"\n",ncpwd);
	console.log("Werte: "+werte);
	event.returnValue = werte;
	ncurl=""; ncuser=""; ncpwd="";
});


function splitMyData(datastring) {
	keys =  datastring.split(":",2);
	switch(keys[0]) {
		case 'ncurl':
			ncurl = keys[1];
			break;
		case 'ncuser':
			ncuser = keys[1];
			break;
		case 'ncpwd':
			ncpwd = keys[1];
			break;
	}
}

function createConfigWindow() {
	cWWidth = (DEBUG) ? 800 : 400;
	cWHeight = (DEBUG) ? 600 : 300;
	configWindow = new BrowserWindow({
		width: cWWidth,
		height: cWHeight,
		modal: true,
		title: 'Config NCT Tray',
		webPreferences: {
			nodeIntegration: true
    }
	});

	configWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'configWindow.html'),
		protocol: 'file:',
		slashes: true,
		postData: "Key=Value"
	})); 
	if (mainMenuTemplate) {
		const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
		Menu.setApplicationMenu(mainMenu);
	} else {
		Menu.setApplicationMenu(null);
	};
	//configWindow.toggleDevTools();
	if(DEBUG) { configWindow.webContents.openDevTools(); }

	configWindow.on('close', function(){
		configWindow=null;
	});
}

function sendToTray() {
	tray = new Tray(iconPath);
	tray.setToolTip('Nextcloud Talk Notifier');
	const ctxMenu = Menu.buildFromTemplate(trayMenuTemplate);
	tray.setContextMenu(ctxMenu);
	tray.on('click', function() {
		tray.popUpContextMenu([ctxMenu]);
	});
	let trayBalloonOptions = new Object;
	trayBalloonOptions.title='Hello World';
	trayBalloonOptions.content=' blabla<br>bla';
	
//	tray.displayBalloon(trayBalloonOptions);

}

// creat menu template
let mainMenuTemplate = [
	{ label: 'Quit App', 
		click() {
			tray = null;
			app.quit();
		}
	}
];

//developer Tools Items
if (DEBUG) { // app.isPackaged) { //process.env.NODE_ENV != 'production') {
	if(process.platform == 'darwin'){
		// MacOS Spezialbehandlung von Menüs
		mainMenuTemplate.unshift({});
	}
	mainMenuTemplate.push({
		label: 'Developertools',
		submenu:[
			{
				label: 'Toggle DevTools',
				accelerator: process.platform == 'darwin' ? 'Command+I' : 'F12',
				click(item, focusedWindow) {
					focusedWindow.toggleDevTools();
				}
			},
			{
				role: 'reload',
				accelerator: process.platform == 'darwin' ? 'Command+R' : 'F5',
			},
			{ label: 'Quit App', 
				click() {
					tray = null;
					app.quit();
				}
			}
		]
	});
} else {
	mainMenuTemplate = null;
};


//create TrayMenu
const trayMenuTemplate = [
	{ label: 'restore window', 
		click() {
			createConfigWindow();
		}
	},
	{ label: 'quit', 
		click() {
			tray = null;
			app.quit();
		}
	},
	
];
