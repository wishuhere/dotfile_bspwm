/**
   GeoShift (C) 2018 Beholder Corporation / FoxyProxy
 * support@getfoxyproxy.org
 *
 * This source code is proprietary, and released under the EULA available in the
 * LICENSE file at the root of this installation. Do not copy or re-use without
 * written permission.
 */

var credentials = {authCredentials : null}, cancel = {cancel: true};
function setCredentials(c) {
	credentials = c;
}
chrome.runtime.onInstalled.addListener(function(details) {
});

chrome.notifications.onShowSettings.addListener(function(){
});

var NOTIFICATIONID = 'FoxyProxyNotification', RETRIES = 5;
chrome.notifications.onClicked.addListener(function(id){
	if (id === NOTIFICATION_ID){
		
		chrome.runtime.sendMessage(null, 'msg'); 
	}
});

var calls = {};
chrome.webRequest.onAuthRequired.addListener(
	function(details) {
		if (details.isProxy === true) {

			var id = details.requestId.toString();
			if (!(id in calls)) calls[id] = 0;
			calls[id] += 1;

						if (calls[id] >= RETRIES) {
				chrome.notifications.create(NOTIFICATION_ID, {
					'type': 'basic',
					'iconUrl': 'icon_locked_128.png',
					'title': 'Proxy Authentication Error',
					'message': 'Your username/password is not working with the proxy server. Please refresh FoxyProxy.',
					'isClickable': true,
					'priority': 2
				}, function(id) { 
				});
				calls = {};
				return cancel;
			}
			if (!credentials.authCredentials || !credentials.authCredentials.username || !credentials.authCredentials.password) {
				chrome.storage.sync.get('credentials', function(obj) {
					credentials = {authCredentials: {username: obj.credentials.username, password: obj.credentials.password}};
				});
			}
			else
				return credentials;
			return credentials.authCredentials ? credentials : cancel;
		}
	},
	{urls: ["<all_urls>"]}, 
	["blocking"]
);
