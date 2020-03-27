const electron = require('electron');
const url = require('url');
const path = require('path');
const fs = require('fs');
const Tray = electron.Tray;
const iconPath = path.join(__dirname, 'Nextcloud.ico');

const {app, BrowserWindow, Menu} = electron;

let DEBUG = (app.isPackaged) ? false:true;

let mainWindow;
let addWindow;
let tray = null;

let ipc = electron.ipcMain;


// Listen for app to be readyState
app.on('ready', function(){
	sendToTray();
});
app.on('asynchronous-message', (event, newcontent) => {
	let configFilePath = path.join(__dirname, 'config.ini');

	fs.writeFile(configFilePath, newcontent, (err) => {
		if(err) {
			console.log("Cannot update file...",err);
			return;
		}
	});
	alert("Save successfull!");

});

app.on('window-all-closed', function() {
//  app.quit();
});

// IPC from renderer
ipc.on('configChange', (event, message) => {
	console.log(event + "/" + message );
});

function createConfigWindow() {
	configWindow = new BrowserWindow({
		width: 800,
		height: 800,
		title: 'Config NCT Tray',
		webPreferences: {
			nodeIntegration: true
    }
});

	configWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'configWindow.html'),
		protocol: 'file:',
		slashes: true
	})); 
	if (mainMenuTemplate) {
		const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
		Menu.setApplicationMenu(mainMenu);
	} else {
		Menu.setApplicationMenu(null);
	};

	//configWindow.toggleDevTools();
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

function createMainWindow() {
	// create Window
	mainWindow = new BrowserWindow({});

	mainWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'mainWindow.html'),
		protocol: 'file:',
		slashes: true
	})); 

	// Build menu from template
	const mainMenu = Menu.buildFromTemplate(mainMenuTemplate) || null;
	Menu.setApplicationMenu(mainMenu);
	
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
