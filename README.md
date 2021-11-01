## NCT-Desktop
#
# this will remain unmaintained as NC client provides theese features
# since 2021

Desktop-App for notifying Nextcloud-Talk Events

This App installs a Tray-Icon and on regular base pulls the NC server
if new notifications have arrived. If yes, a local notification is shown
and the icon changes. clicking the notification should open a browser 
window with the server-notification.

Currently credentials have to be stored unencrypted locally. Though, 
inbetween, i managed to use NC-login-V2 and we are storing an App-pw.

This is my very first GIT repository and my very first Desktop App.
please comment to me whatever your might want to express, but be polite.

I create this app for my personal use and i want to let the community 
participate on my outcome and experiences. In the first step i start
using GITHUB as a source backup, so i will not create too many branches
and commit regularly direct to master branch. As soon as others want to
participate, i might rethink this approach.

Furthermore I decided to provide experimental, unsigned binaries. 
MAC OSX here: code.schepmann.de/NCT-Desktop/nct-desktop-darwin-x64.zip
Win x64 here: code.schepmann.de/NCT-Desktop/nct-desktop-win32-ia32.zip
Lin x64 here: code.schepmann.de/NCT-Desktop/nct-desktop-linux-x64.zip

regards, FDS

btw: this is an ELECTRON-project. See https://www.electronjs.org/ for details.

credits to: e-alfred, Refhi, sb0stn, tiiiecherle
