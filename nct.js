const electron = require('electron');
const url = require('url');
const path = require('path');
const fs = require('fs');
const Tray = electron.Tray;
const {app, BrowserView, BrowserWindow, Menu, Notification} = electron;
const { net } = require('electron');
const util = require('util');
//const notifier = require('node-notifier');

//const electronVersion = require('electron-version')
//electronVersion(function (err, v) {
//  console.log(err, v) // null 'v0.33.4'
//});

// custom constants
const DEBUG = (app.isPackaged) ? false:true;
const configFilePath = path.join(__dirname, 'config.ini');
const setIntervalPromise = util.promisify(setInterval);

// custom variables
let mainWindow;
let addWindow;
var tray = null;
var trayerror=true;
var notify;

let ipc = electron.ipcMain;
var ncurl="", ncuser="", ncpwd="";
var dataarr, werte;
var iconPath = path.join(__dirname, 'Nextcloud.ico');
var APQUIT = 0;
var ongoingPoll = 0;
var myIntervall = {_destroyed : true};
var nID = 0;
var newNot = 0;
var mSub,mLink,mMsg;
var appVersion = app.getVersion();

// Listen for app to be readyState
app.on('ready', function(){
	trayMenuTemplate.unshift({type  : 'separator'});
	trayMenuTemplate.unshift({label : appVersion, enabled : false});
	sendToTray("starting...");
	console.log(process.platform);
	
	// read config data into global variables
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
		
		NCPollOnce();
  });

});

app.on('before-quit', function(event) {
	console.log("QUIT: " + APQUIT);
	if(APQUIT == 0) { 
		event.preventDefault(); 
		if(DEBUG) { console.log("1: "+ncurl+"2: "+ncuser+"3: "+ncpwd); }
		if(myIntervall._destroyed) {
			NCPollOnce();
		}
	} else {
		if(!myIntervall._destroyed) {clearInterval(myIntervall);}
	}
});

// IPC from renderer
// has there been a change in config items ?
ipc.on('configChange', (event, newcontent) => {
	fs.writeFile(configFilePath, newcontent, (err) => {
		if(err) {
			console.log("Cannot update file...",err);
			return;
		}
	});
	let dataarr = newcontent.split("\n");
	// Change how to handle the file content
	dataarr.forEach(splitMyData);
	if(DEBUG) { console.log("1: "+ncurl+"2: "+ncuser+"3: "+ncpwd); }
	console.log("Save successfull: "&configFilePath);
});

// new Windows needs initial config items
ipc.on('initConfigValues', (event, arg) => {
	console.log(arg);
	werte = ncurl+":"+ncuser+":"+ncpwd;
		// werte = werte.concat(ncurl,"\n",ncuser,"\n",ncpwd);
	console.log("Werte: "+werte);
	event.returnValue = werte;
	// ncurl=""; ncuser=""; ncpwd="";
});

// tools
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
	if(!myIntervall._destroyed) {clearInterval(myIntervall);}
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

function createTalkWindow(url) {
	let win = new BrowserWindow({ width: 800, height: 600 });
	win.on('closed', () => {
		win = null;
	});
	let view = new BrowserView();
	win.setBrowserView(view);
	view.setBounds({ x: 0, y: 0, width: 800, height: 600 });
	view.webContents.loadURL(url);
}

function sendToTray(status) {
	if(status == "green") {
		iconPath = path.join(__dirname, 'talk2.png');
	} else if (status == "newnot") {
		iconPath = path.join(__dirname, 'talk3.png');
	}	else {
		iconPath = path.join(__dirname, 'talk1.png');
	}
	now = new Date();
	tray = new Tray(iconPath);
	tray.setToolTip('Nextcloud Talk Notifier ' + status + " " + now);
	const ctxMenu = Menu.buildFromTemplate(trayMenuTemplate);
	tray.setContextMenu(ctxMenu);
	tray.on('click', function() {
		tray.popUpContextMenu([ctxMenu]);
	});
//	tray.on('balloon-click', function() {
//		createTalkWindow(mLink);
//	});

}

function clear_Icon () {
	tray.destroy();
	sendToTray("green");
	console.log("Trayicon re-set. ");
}

function NCPollOnce() {
	let u1 = Buffer.from(ncurl,'base64').toString('ascii');
	let u2 = Buffer.from(ncuser,'base64').toString('ascii');
	let pw = Buffer.from(ncpwd,'base64').toString('ascii');
	let auth = "Basic " + Buffer.from(u2 + ":" + pw,'ascii').toString('base64');
	if( u1.substr(u1.length - 1) == '\\') { u1 = u1.substr(0, u1.length - 1); }
	let url = 'https://'+u1+'/ocs/v2.php/apps/notifications/api/v2/notifications';
	ongoingPoll = 1;
	let request = net.request({
		method: 'GET',
		url: url,
		headers: {
			"Authorization": auth
		}
	});
	request.on('error', (error) => {
		console.log(`${error}`);
		ongoingPoll = 0;
		myIntervall = setInterval(NCPollRegular, 10*1000);
		console.log("PollOnce end with error");
	});
	request.on('response', (response) => {
		httpStatus = `${response.statusCode}`;
		if (httpStatus != "200") {
		  console.log(`STATUS: ${response.statusCode}`);
			sCode = `${response.statusCode}`;
		  //console.log(`HEADERS: ${JSON.stringify(response.headers)}`);
			fireBalloon("NCT Poll-Error", "Server-Response: "+sCode, "");
//			let trayBalloonOptions = new Object;
//			trayBalloonOptions.title="NCT Poll-Error";
//			trayBalloonOptions.content="Server-Response: "+sCode;
//			trayBalloonOptions.icon=iconPath;
//			tray.displayBalloon(trayBalloonOptions);
		} else {
			response.on('data', (chunk) => {
				//console.log(`BODY: ${chunk}`)
				getXMLnotifications(`${chunk}`);
			})
			response.on('end', () => {
				ongoingPoll = 0;
				console.log('No more data in response.')
//				setIntervalPromise(NCPollRegular, 10*1000,'foobar').then((value) => {});
				myIntervall = setInterval(NCPollRegular, 10*1000);
				console.log("PollOnce end");
			});
		}
	})
	request.end()

}

function NCPollRegular() {
	//console.debug(myIntervall);

	if (ongoingPoll > 0) {	
		console.log("Abfrage \#"+ongoingPoll+" läuft noch... Poll verschoben."); 
		ongoingPoll++;
		if (ongoingPoll>5) { ongoingPoll=0;}
	} else {
		let u1 = Buffer.from(ncurl,'base64').toString('ascii');
		let u2 = Buffer.from(ncuser,'base64').toString('ascii');
		let pw = Buffer.from(ncpwd,'base64').toString('ascii');
		let auth = "Basic " + Buffer.from(u2 + ":" + pw,'ascii').toString('base64');
		if( u1.substr(u1.length - 1) == '\\') { u1 = u1.substr(0, u1.length - 1); }
		let url = 'https://'+u1+'/ocs/v2.php/apps/notifications/api/v2/notifications';
		//console.log("URL: "+ url);
		ongoingPoll = 1;
		let request = net.request({
			method: 'GET',
			url: url,
			headers: {
				"Authorization": auth
			}
		});
		request.on('error', (error) => {
			console.log(`${error}`);
			ongoingPoll = 0;
				tray.destroy();
				sendToTray("blue");
				trayerror=true;
			tray.setToolTip('Nextcloud Talk Notifier: ERROR');
		});
		request.on('response', (response) => {
			if(DEBUG) { console.log(`STATUS: ${response.statusCode}`); }
			sCode = `${response.statusCode}`;
			if (sCode != '200') {
				clearInterval(myIntervall);
				fireBalloon("NCT Poll-Error", "Server-Response: "+sCode+"\nclick to open config", "");
//				let trayBalloonOptions = new Object;
//				trayBalloonOptions.title="NCT Poll-Error";
//				trayBalloonOptions.content="Server-Response: "+sCode+"\nclick to open config";
//				trayBalloonOptions.icon=iconPath;
//				tray.displayBalloon(trayBalloonOptions);
//				tray.on('balloon-click', function() {
//					//tray.removeBalloon();
//				createConfigWindow();
//				});
			} else {
				if(trayerror){
					tray.destroy();
					sendToTray("green");
					trayerror=false;
				} else {
					now = new Date();
					tray.setToolTip('Nextcloud Talk Notifier OK ' + now);
				}
				//console.log(`HEADERS: ${JSON.stringify(response.headers)}`)
				response.on('data', (chunk) => {
					//console.log(`BODY: ${chunk}`);
					getXMLnotifications(`${chunk}`);
				});
				response.on('end', () => {
					ongoingPoll = 0;
					//console.log('No more data in response.')
				});
			}
		})
		request.end()
	}
}

function getXMLnotifications(pollResponse) {

	// parse it the hard way...
	pollResponse.replace("\r", "");
	let arrLines = pollResponse.split("\n");
	let getLines = 0;
	mSub="";
	mLink="";
	mMsg="";
	newNot = 0;
	for(i=0; i<arrLines.length; i++){
		al = arrLines[i].toString();
		if(al.search('<notification_id>') >= 0) {
			//console.debug(i + ": " + al);
			getLines=0;
			let numb=al.slice(al.search(">")+1,-18).valueOf();
			// console.debug(numb + " numb " + al.slice(al.search(">")+1,-18));
			if(numb>nID){
				nID=numb;
				getLines=1;
				newNot = 1;
				//console.debug(i + " get " + numb);
			}
		} else {
			if(getLines==1) {
				if(al.search("<subject>") >= 0) {
					mSub=al.slice(al.search(">")+1,-10);
					console.log("Sub: " + mSub);
				} else if (al.search("<link>") >= 0) {
					mLink=al.slice(al.search(">")+1,-7);
					console.log("Link: " + mLink);
				} else if (al.search("<message>") >= 0) {
					mMsg=al.slice(al.search(">")+1,-10);
					console.log("Msg: " + mMsg);
				}
			}
		}
	}

	if(newNot == 1) {
		newNot = 0;
		tray.destroy();
		sendToTray("newnot");
		console.log("Balloon fired. ");
		fireBalloon(mSub, mMsg, mLink);
	}
}

function fireBalloon(subject, message, link) {
	if(process.platform == "win32") {
		newNot = 0;
		console.log("Balloon fired. ");
		let trayBalloonOptions = new Object;
		trayBalloonOptions.title=mSub;
		trayBalloonOptions.content=mMsg; // +"\n"+mLink;
		trayBalloonOptions.icon=iconPath;
		tray.displayBalloon(trayBalloonOptions);
		tray.on('balloon-click', function() {
			//tray.removeBalloon();
			console.log("Clicked the Balloon...");
			createTalkWindow(link);
		});
		tray.on('balloon-closed', function() {
			//tray.removeBalloon();
			console.log("Balloon closed...");
		});
		
	} else {

		notify = new Notification({
			title : subject,
			body  : message,
			icon  : path.join(__dirname, 'talk2.png'),
			timeoutType : 'never'
		});
		notify.show();
		notify.on('click', function() {
			console.log("Clicked the Notification...");
			createTalkWindow(link);
		});
	}
	if(0 == 1) {
		notifier.notify({
			title: mSub,
			message: mMsg
		});
	}

}


// create menu template
let mainMenuTemplate = [
	{ label: 'Quit App', 
		click() {
			tray = null;
			app.quit();
		}
	}
];

//developer Tools Items
if (DEBUG) { 
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
					APQUIT=1;
					//tray = null;
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
	{ label: 'clear Icon', 
		click() {
			clear_Icon();
		}
	},
	{ label: 'configure', 
		click() {
			createConfigWindow();
		}
	},
	{ label: 'quit', 
		click() {
			APQUIT = 1;
			tray = null;
			app.quit();
		}
	},
	
];
