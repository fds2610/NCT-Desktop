const electron = require('electron');
const url = require('url');
const path = require('path');
const fs = require('fs');
const Tray = electron.Tray;
const {app, BrowserView, BrowserWindow, Menu, Notification} = electron;
const { net } = require('electron');
const requestlib = require('request');
const shell = require('electron').shell;
const util = require('util');
//const notifier = require('node-notifier');
const os = require('os');
const nativeImage = require('electron').nativeImage;

//const electronVersion = require('electron-version')
//electronVersion(function (err, v) {
//  console.log(err, v) // null 'v0.33.4'
//});

// custom constants
const configFilePath = path.join(__dirname, 'config.ini');
const setIntervalPromise = util.promisify(setInterval);

// custom variables
let DEBUG = (app.isPackaged) ? false:true;
let mainWindow;
let addWindow;
var tray = null;
var trayerror=true;
var notify;
var jd;

let ipc = electron.ipcMain;
var ncurl="", ncuser="", ncpwd=""; ncoption=""; ncbrowser=""; ncbaseurl="";
var dataarr, werte;
var iconPath = path.join(__dirname, 'Nextcloud.ico');
var APQUIT = 0;
var ongoingPoll = 0;
var ongoingTokenPoll = 0;
var myIntervall = {_destroyed : true};
var nID = 0;
var newNot = 0;
var mSub,mLink,mMsg;
var appVersion = app.getVersion();

// Listen for app to be readyState
app.on('ready', function(){

	trayMenuTemplate.unshift(
		{ label: 'open NC in browser', 
			click() {
				createTalkWindow(mLink);
			}
		}
	);
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
		mLink = Buffer.from(ncurl,'base64').toString('ascii');
		if (ncbaseurl) { mLink = mLink + "/index.php/apps/spreed/"; }
		if (mLink.indexOf("https://") < 0) {mLink = "https://" + mLink;}
		if(DEBUG) { console.log("url: "+mLink); }
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
// deprecated
ipc.on('configXXXChange', (event, serverUrl) => {  
	let newcontent = "[Nextcloud-Talk]\nncurl:" + serverUrl;
	newcontent = newcontent + "\nncuser:"+ ncuser+"\nncpwd:"+ncpwd+"\n";
	writenewconfig(newcontent);
});

// new URL entered
ipc.on('serverChange', (event, serverUrl) => {
	let newcontent = "[Nextcloud-Talk]\nncurl:" + serverUrl;
	ncurl = serverUrl;
	newcontent = newcontent + "\nncuser:"+ ncuser+"\nncpwd:"+ncpwd+"\n";
	writeNewConfig(newcontent);
});

// connect new server url
ipc.on('connectServer', (event, s) => {
	createCredentialsWindow();
});

// new options set/unset
ipc.on('optionChange', (event, newoption) => {
	
	let newcontent = "[Nextcloud-Talk]\nncurl:" + ncurl;
	newcontent = newcontent + "\nncuser:"+ ncuser+"\nncpwd:"+ncpwd+"\n";
	newcontent = newcontent + newoption;
	ncoption = newoption;
	console.log("Config changed: " + newcontent);
	writeNewConfig(newcontent);
	if (DEBUG) { console.log("Debug on"); } else { console.log("Debug off"); }
});

// deprecated
ipc.on('initXXXConfigValues', (event, arg) => {
	console.log(arg);
	werte = ncurl+":"+ncuser+":"+ncpwd;
		// werte = werte.concat(ncurl,"\n",ncuser,"\n",ncpwd);
	console.log("WerteXXXXX: "+werte);
	event.returnValue = werte;
	// ncurl=""; ncuser=""; ncpwd="";
});

// initServerUrl
ipc.on('initServerUrl', (event, arg) => {
	console.log(arg);
	werte = ncurl+":"+DEBUG+":"+ncbrowser+":"+ncbaseurl;
		// werte = werte.concat(ncurl,"\n",ncuser,"\n",ncpwd);
	console.log("Werte: "+werte);
	event.returnValue = werte;
	// ncurl=""; ncuser=""; ncpwd="";
});

//
// end-of-main
//

// tools
function writeNewConfig(content) {
	fs.writeFile(configFilePath, content, (err) => {
		if(err) {
			console.log("Cannot update file...",err);
			return;
		}
	});
	let dataarr = content.split("\n");
	// Change how to handle the file content
	dataarr.forEach(splitMyData);
	if(DEBUG) { console.log("1: "+ncurl+"2: "+ncuser+"3: "+ncpwd+"options:"+ncoption); }
	console.log("Save successfull: "&configFilePath);	
}

function splitMyData(datastring) {
	keys =  datastring.split(":",2);
	ncoption="";
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
		case 'debug':
			DEBUG = (keys[1] == 'true') ? true:false;
			ncoption = ncoption+keys[0]+':'+keys[1]+"\n";
			break;
		case 'browser':
			ncbrowser = (keys[1] == 'true') ? true:false;
			ncoption = ncoption+keys[0]+':'+keys[1]+"\n";
			break;
		case 'base-url':
			ncbaseurl = (keys[1] == 'true') ? true:false;
			mLink = Buffer.from(ncurl,'base64').toString('ascii');
			if (ncbaseurl) { mLink = mLink + "/index.php/apps/spreed/"; }
			ncoption = ncoption+keys[0]+':'+keys[1]+"\n";
			break;
	}
}

function openConfigWindow() {
	if(DEBUG) { console.log('Fkt: openConfigWindow()'); }
	createConfigWindow();
	
}

function createCredentialsWindow() {
	let url = Buffer.from(ncurl,'base64').toString('ascii') + "/index.php/login/v2" ;
	if (url.indexOf("https://") < 0) {url = "https://" + url;}
	var pollTokenIntervall;
	const request = net.request({
		method: 'POST',
		url: url,
		redirect: "follow"
	});
	request.on('error', (error) => {
		console.log(`NCT-CredWin-Error: $ncurl - $url - ${error}`);
		ongoingConfigPoll = 0;
		console.log("AUTH POST 1 ended with error");
	});
	request.on('response', (response) => {
		httpStatus = `${response.statusCode}`;
		if (httpStatus != "200") {
		  console.log(`AUTH POST 1 STATUS: ${response.statusCode}`);
			sCode = `${response.statusCode}`;
		} else {
			response.on('data', (chunk) => {
				jd = JSON.parse(`${chunk}`);
				console.log("Status: " + httpStatus);
				console.log("Token: " + jd.poll.token);
				console.log("EP: " + jd.poll.endpoint);
				console.log("url: " + jd.login);

				if (ncbrowser) {
					shell.openExternal(jd.login);
				} else {

					cWWidth = (DEBUG) ? 1200 : 600;
					cWHeight = (DEBUG) ? 800 : 800;
					configWindow = new BrowserWindow({
						width: cWWidth,
						height: cWHeight,
						modal: true,
						title: 'Config NCT Tray',
						webPreferences: {
							nodeIntegration: true
						}
					});

					configWindow.loadURL(jd.login); 
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
						if (typeof pollTokenIntervall !== 'undefined') { if(!pollTokenIntervall._destroyed) {clearInterval(pollTokenIntervall);} }
					});
					
					//
					// request({ url: url, method: 'PUT', json: {foo: "bar", woo: "car"}}, callback)
					//
					// https://nodejs.dev/make-an-http-post-request-using-nodejs
					//
					if(!myIntervall._destroyed) {clearInterval(myIntervall);}
					pollTokenIntervall = setInterval(pollToken, 2*1000);
				}
			});
		}
		
		
	});
	request.end();

	
}

function pollToken () {
	var host = Buffer.from(ncurl,'base64').toString('ascii');
	if (ongoingTokenPoll >0) {
		console.log("Tokenpoll ongoing.. "+ongoingTokenPoll+" wait");
		ongoingTokenPoll++;
	} else {
		let pstat = "";
		let url2 = host + "/index.php/login/v2/poll" ;
		let url = jd.poll.endpoint ;
		var postData = 'token=' + jd.poll.token;
		console.log("Polling: " + postData + " from url: " + url);
		ongoingTokenPoll=1;
		requestlib({ 
				body: postData, 
				followAllRedirects: true,
				headers: {
					 'Content-Type': 'application/x-www-form-urlencoded',
					 'Content-Length': postData.length,
//					 'Referer': url2,
//					 'Host': host,
					 'User-Agent': 'NCT Desktop' + appVersion,
					 'X-Requested-With': 'XMLHttpRequest' },
				method: 'POST',
				url: url}, 
			function cb (error, response, body) {
					ongoingTokenPoll = 0;
					if (!error && response.statusCode == 200) {
							console.log('Success: \n'+body);
							let cred = JSON.parse(body);
							console.log("JSON ****** \nServer: "+cred.server+"\nPW: "+cred.appPassword);
							newcontent="[Nextcloud-Talk]\nncurl:"+Buffer.from(cred.server,'ascii').toString('base64');
							newcontent=newcontent+"\nncuser:"+Buffer.from(cred.loginName,'ascii').toString('base64');
							newcontent=newcontent+"\nncpwd:"+Buffer.from(cred.appPassword,'ascii').toString('base64')+"\n";
							writeNewConfig(newcontent);
							if (typeof pollTokenIntervall !== 'undefined') { if(!pollTokenIntervall._destroyed) {clearInterval(pollTokenIntervall);} }
					} else {
							
							console.log("PullToken callback: " + error + " \n");
							console.log("JSON ****** \n"+body);
					}
			}
		);
		console.log("Request sent. HTTP-Status: "+ pstat);
	}
}

function createConfigWindow() {
	if(DEBUG) { console.log('Fkt: createConfigWindow()'); }
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
		// createCredentialsWindow();
	});
}

function createTalkWindow(url) {
	if(DEBUG) { console.log('Fkt: createTalkWindow()'); }
	if(DEBUG) { console.log('ncbrowser: ' + ncbrowser); }
	if (url == "") { url = mLink; }
	if (url.indexOf("https://") < 0) {url = "https://" + url;}
	if(DEBUG) { console.log("url to open: " + url); }
	clear_Icon();
	if (ncbrowser) {
		shell.openExternal(url);
	} else {
		let win = new BrowserWindow({ width: 800, height: 600 });
		win.on('closed', () => {
			win = null;
		});
		let view = new BrowserView();
		win.setBrowserView(view);
		view.setBounds({ x: 0, y: 0, width: 800, height: 600 });
		view.webContents.loadURL(url);
	}
}

function sendToTray(status) {
	if(DEBUG) { console.log('Fkt: sendToTray()'); }
	if(status == "green") {
		iconPath = path.join(__dirname, 'talk2.png');
	} else if (status == "newnot") {
		iconPath = path.join(__dirname, 'talk3.png');
	}	else {
		iconPath = path.join(__dirname, 'talk1.png');
	}

	image = nativeImage.createFromPath(iconPath);

	if (os.platform == 'darwin') {
		image = image.resize({
			width: 16,
			height: 16
		})
	}

	now = new Date().toISOString();
	tray = new Tray(image);
	tray.setToolTip('Nextcloud Talk Notifier ' + status + " " + now);
	const ctxMenu = Menu.buildFromTemplate(trayMenuTemplate);
	tray.setContextMenu(ctxMenu);
	tray.on('click', function() {
		tray.popUpContextMenu([ctxMenu]);
	});
	tray.on('double-click', function() {
		createTalkWindow(mLink);
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
	if(DEBUG) { console.log('Fkt: NCPollOnce()'); }
	let u1 = Buffer.from(ncurl,'base64').toString('ascii');
	let u2 = Buffer.from(ncuser,'base64').toString('ascii');
	let pw = Buffer.from(ncpwd,'base64').toString('ascii');
	let auth = "Basic " + Buffer.from(u2 + ":" + pw,'ascii').toString('base64');
	if( u1.substr(u1.length - 1) == '\\') { u1 = u1.substr(0, u1.length - 1); }
	let url = u1+'/ocs/v2.php/apps/notifications/api/v2/notifications';
	console.log("url: "+url+" Indexof: "+url.indexOf("https://"));
	if (url.indexOf("https://") < 0) {url = "https://" + url;}
	ongoingPoll = 1;
	let request = net.request({
		method: 'GET',
		url: url,
		headers: {
			"Authorization": auth
		}
	});
	request.on('error', (error) => {
		console.log(`NCT-PollOnce1-Error: ${error}`);
		ongoingPoll = 0;
		myIntervall = setInterval(NCPollRegular, 10*1000);
		console.log("PollOnce end with error");
	});
	request.on('response', (response) => {
		httpStatus = `${response.statusCode}`;
		if (httpStatus != "200") {
		  console.log(`NCT-PollOnce-Status: ${response.statusCode}`);
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
	//if(DEBUG) { console.debug("NC Poll: newNot " + newNot); }
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

		let url = u1+'/ocs/v2.php/apps/notifications/api/v2/notifications';
		if (url.indexOf("https://") < 0) {url = "https://" + url;}
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
			console.log(`NCT-PollRegular ${error}`);
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
				//console.debug("response: " +response);
				if(trayerror){
					//tray.destroy();
					//sendToTray("green");
					clear_Icon();
					trayerror=false;
				} else {
					now = new Date().toISOString();
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
	if(DEBUG) { console.log('Fkt: getXMLnotifications()'); }
	// parse it the hard way...
	pollResponse.replace("\r", "");
	let arrLines = pollResponse.split("\n");
	let getLines = 0;
	mSub="";
	// mLink="";
	mMsg="";
	newNot = 0;
	for(i=0; i<arrLines.length; i++){
		al = arrLines[i].toString();
		if(al.search('<notification_id>') >= 0) {
			//console.debug(i + ": " + al);
			getLines=0;
			let numb=al.slice(al.search(">")+1,-18).valueOf();
			if(DEBUG) { console.debug("numb: " + numb + " nID " + nID); }
			if(numb>nID){
				if(nID > 0) {
				nID=numb;
				getLines=1;
				newNot = 1;
				//console.debug(i + " get " + numb);
				} else {
					nID = numb;
				}
			} 
		} else {
			if(getLines==1) {
				if(al.search("<subject>") >= 0) {
					mSub=al.slice(al.search(">")+1,-10);
					//console.log("Sub: " + mSub);
				} else if (al.search("<link>") >= 0) {
					mLink=al.slice(al.search(">")+1,-7);
					//console.log("Link: " + mLink);
				} else if (al.search("<message>") >= 0) {
					mMsg=al.slice(al.search(">")+1,-10);
					//console.log("Msg: " + mMsg);
				}
			}
		}
	}
	if(DEBUG) { console.debug("newNot " + newNot); }
	if(newNot == 1) {
		newNot = 0;
		tray.destroy();
		sendToTray("newnot");
		//console.log("Balloon fired. ");
		fireBalloon(mSub, mMsg, mLink);
		// if(DEBUG) { console.debug(" newNot " + newNot); }
	}
}

function fireBalloon(subject, message, link) {
	if(process.platform == "win32") {
		newNot = 0;
		console.log("Balloon fired. ");
		let trayBalloonOptions = new Object;
		trayBalloonOptions.title=subject;
		trayBalloonOptions.content=message; // +"\n"+mLink;
		trayBalloonOptions.icon=iconPath;
		tray.displayBalloon(trayBalloonOptions);
		tray.on('balloon-click', function() {
			//tray.removeBalloon();
			console.log("Clicked the Balloon...");
			tray.destroy();
			sendToTray("green");
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
			tray.destroy();
			sendToTray("green");
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
			openConfigWindow();
		}
	},
	{ label: 'quit', 
		click() {
			APQUIT = 1;
			tray = null;
			app.quit();
		}
	}
	
];
