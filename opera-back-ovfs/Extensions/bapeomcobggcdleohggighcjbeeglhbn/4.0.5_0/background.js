var brs = "chrome";
var rotateProxyTimer, loadProxiesTimer, rotateSeconds, rotateCurrent;
var timeoutRotate, rotateTimerOn = false, loadProxiesTimerOn = false;
var localStorage = [];
var deleteValues = ["cache", "cookies", "downloads", "localStorage", "formData", "history", "indexedDB", "pluginData", "passwords", "serverBoundCertificates"];
var blockValues = ["webRTC"];
var settingsValues = ["proxyNotification", "agentNotification", "deleteNotification"];
var settingsValuesTxt = {"proxyNotification": "changing the proxies",
    "deleteNotification": "deleting the cookies and the cache",
    "agentNotification": "changing browser agent"};
var userAgents = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/601.7.7 (KHTML, like Gecko) Version/9.1.2 Safari/601.7.7\nMozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36\nMozilla/5.0 (Windows NT 10.0; WOW64; rv:56.0) Gecko/20100101 Firefox/56.0\nMozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10240\nMozilla/5.0 (iPad; CPU OS 10_2_1 like Mac OS X) AppleWebKit/602.4.6 (KHTML, like Gecko) Version/10.0 Mobile/14D27 Safari/602.1)\nMozilla/5.0 (Linux; Android 7.1; vivo 1716 Build/N2G47H) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.98 Mobile Safari/537.36";
var failedLogins = 0, proxyUsed = 1;
var proxyCurrent, portCurrent, userCurrent, passCurrent;

if (brs==="firefox"){
    chrome = browser;
}

function sanitizeProxies(prox) {

    try {
        prox = prox.toString().replace(/ /g, "");
        proxiesArr = prox.split("\n");
        proxiesNew = [];
        for (i = 0; i < proxiesArr.length; i++) {
            if (proxiesArr[i].length > 5) {

                proxiesNew.push(proxiesArr[i]);
            }
        }
        return proxiesNew.join("\n");
    } catch (e) {
        return prox;
    }
}

function shouldLoadProxiesFromUrl() {
    var d = new Date();
    if (loadConf("proxyMode") === 1 && loadConf("loadProxiesDate") <= d.getTime()) {
        loadProxiesFromUrl();
    }
}

function stopLoadProxiesTimer() {
    clearInterval(loadProxiesTimer);
    loadProxiesTimerOn = false;
}

function loadProxiesFromUrl() {
    if (loadConf("lastProxy") !== 'NOPROXY') {
        p = parseProxy(loadConf("lastProxy"));
        if (p[1] > 1) {
            putProxy(p[0], p[1], '', true);
        }
    }
    stopLoadProxiesTimer();
    loadProxiesTimerOn = true;
    var d = new Date();
    saveConf("loadProxiesDate", d.getTime() + 60 * 1000 * loadConf("urlMinutes"));
    loadProxiesTimer = setInterval(shouldLoadProxiesFromUrl, 60 * 1000 * loadConf("urlMinutes"));
    var xhr = new XMLHttpRequest();
    xhr.open("GET", makeUrlUnique(loadConf("urlProxies")), true);
    xhr.onreadystatechange = function () {

        if (xhr.readyState === 4) {
            var error = "", answer = "";
            if (xhr.status === 200) {
                var proxies = sanitizeProxies(xhr.responseText);
                if (proxies.length < 1) {
                    error = "No proxies found on that URL";
                } else {
                    saveConf("proxiesList", proxies)
                    getLocations();
                }
            } else {
                error = "Error loading the URL!\n Error\n" + xhr.status + "\nContent of the URL:\n\n " + xhr.responseText;
            }

            if (error !== "") {
                chrome.runtime.sendMessage({"answer": answer, "call": "loadProxiesFromUrl", "error": error});
            }
        }

    }
    xhr.send();
}


function makeUrlUnique(url) {
    if (url.toString().indexOf("?") !== -1) {
        return url + "&rand=" + Math.random();
    } else {
        return url + "?rand=" + Math.random();
    }
}
function getLocations() {

    var xhr = new XMLHttpRequest();
    var date = loadConf("date");
    xhr.open("POST", "https://testmyproxies.com/_scripts/showLocations.php?d=" + date, true);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            saveConf("locations", xhr.responseText);
            chrome.runtime.sendMessage({"call": "getLocations"});
        }
    };
    var proxies = loadConf("proxiesList").split("\n");
    var ips = getProxiesIps(proxies);
    xhr.send("ips=" + ips.join("-"));
}

function getProxiesIps(prox) {
    r = [];
    for (var i = 0; i < prox.length; i++) {

        p = parseProxy(prox[i]);
        if (p[0].length > 6) {
            r.push(p[0]);
        }
    }
    return r;
}

function startProxyRotation() {
    if (!rotateTimerOn) {
        rotateCurrent = 1;
        proxiesList = getProxiesList();
        setProxy(proxiesList[0]);
        rotateProxyTimer = setInterval(rotateProxy, 1000);
        rotateTimerOn = true;
    }

}

function stopProxyRotation() {
    if (rotateTimerOn) {
        rotateTimerOn = false;
        clearInterval(rotateProxyTimer);
        displayCurrentCountry();
    }

}

function rotateProxy() {
    if (getProxyRotationRemaining() <= 0) {
        rotateToNextProxy();
        rotateCurrent = 0;
    }


    displayCurrentCountry();
    rotateCurrent++;
}

function getProxyRotationRemaining() {
    var sec = loadConf("rotationDelay") - rotateCurrent;
    return sec;
}

function saveConf(n, v) {
    if (brs==="firefox") {
        try {
            window.localStorage.setItem(n, JSON.stringify(v));
        } catch (e) {
            window.localStorage.setItem(n, v);
        }
    } else {
        localStorage[n] =JSON.stringify(v);
        syncStorage();
    }
}

function syncStorage() {
    if (brs==="firefox") {
        localStorage.setItem('localStorage', JSON.stringify(localStorage));
    } else {
        try {
            chrome.storage.local.set({"localStorage": JSON.stringify(localStorage)}, function () {});
        } catch (e) {
            alertTxt(e, "error Sync");
        }
        
    }
}

function loadStorage() {
    if (brs==="firefox") {
        localStorage = JSON.parse(localStorage.getItem('localStorage'));
        if (localStorage.length < 1) {
            localStorage = [];
        }

    } else {
        try {
            chrome.storage.local.get("localStorage", function (res) {
                localStorage = res["localStorage"];
                if (localStorage.length < 1) {
                    localStorage = [];
                }

            });
        } catch (e) {
            alertTxt(e, "error loadStorage");
        }
    }
}

function loadConfFromArr(v, k) {
    r = loadConf(v);
    if (r[k] != 'undefined') {
        return r[k];
    }

    return false;
}

function rotateToNextProxy() {
    index = loadConf("selectedProxyIndex");
    proxiesList = getProxiesList();
    if (index < proxiesList.length + 1) {
        setProxy(proxiesList[index - 2 + 1]);
    } else {
        cyclerotate = loadConf("cyclerotate");
        if (loadConf("cyclerotate")) {
            if (loadConf("shufflerotate")) {
                proxiesList = shuffle(proxiesList);
                saveConf("proxiesList", proxiesList.join("\n"));
                notify("Rotation", "End of the proxy rotation. Shuffling the list and starting again from the top");
            } else {
                notify("Rotation", "End of the proxy rotation. Starting again from the top");
            }
            setProxy(proxiesList[0]);
        } else {
            stopProxyRotation();
            alertTxt("End of the proxy list was reached. Stoping the rotation");
        }
    }

}


function shuffle(array) {
    let counter = array.length;
    while (counter > 0) {
        let index = Math.floor(Math.random() * counter);
        counter--;
        let temp = array[counter];
        array[counter] = array[index];
        array[index] = temp;
    }

    return array;
}

function getProxiesList() {
    return loadConf("proxiesList").split("\n");
}


function getExcludeList() {

    var e = loadConf("excludeList").split("\n");
    var exclude = [];
    for (i = 0; i < e.length; i++) {
        if (e[i] == "localhost") {
            e[i] = "<local>";
            exclude.push(e[i]);
        } else {
            exclude.push(e[i]);
            exclude.push("*." + e[i]);
        }

    }
    var urlProx = loadConf("urlProxies");
    if (urlProx.length > 1) {
        var e1 = loadConf("urlProxies").split("//");
        var e2 = e1[1].toString().split("/");
        exclude.push(e2[0]);
    }
    exclude.push("testmyproxies.com");
    exclude.push("*.testmyproxies.com");
    if (brs==="firefox") {
        return "'" + exclude.join(",") + "'";
    } else {
        return "'" + exclude.join(";") + "'";
    }
}


function parseProxy(proxy) {
    var p = proxy.split(':'), out = [];
    if (p.length > 7) {
        var ip = [];
        for (i = 0; i < 8; i++) {
            ip.push(p[i].trim());
        }
        out[0] = ip.join(":");
        out[1] = p[8].trim();
        out[2] = p[9].trim();
        out[3] = p[10].trim();
        if (p.length > 11) {
            out[4] = p[11].trim();
        }

    } else {
        for (i = 0; i < p.length; i++) {
            out[i] = p[i].trim();
        }
    }
    return out;
}

function loadConf(n, d) {
    if (brs==="firefox") {
        try {
           // console.log("ltry val=" + n + " value=" + window.localStorage.getItem(n));
            if (window.localStorage.getItem(n) === null) {
                return "";
            }
            try {
                return  JSON.parse(window.localStorage.getItem(n));
            } catch (e) {
                return  window.localStorage.getItem(n);
            }
        } catch (e) {
            console.log("loadConf err" + e + " val=" + n);
            return "";
        }
    } else {
        if (typeof localStorage[n] === 'undefined') {
            return "";
        } else {
            
         
            return JSON.parse(localStorage[n]);
       
            
        }
    }
}

function validateProxy(proxy, port, user, pass) {
    error = "";
    if (proxy.length < 7) {
        error = "proxy " + proxy + " is invalid";
    } else if (isNaN(parseInt(port))) {
        error = "port " + port + " is invalid";
    }
    return error;
}


function getProxyIndex(proxyTxt) {
    proxiesList = getProxiesList();
    for (i = 0; i < proxiesList.length; i++) {
        if (proxyTxt == proxiesList[i].trim()) {
            return i + 2;
        }
    }
    return -1;
}

function getPrivacyToRemove() {

    privacy = loadConf("privacy");
    var privacyToRemove = [];
    var toRemove = new Object();
    for (i = 0; i < deleteValues.length; i++) {

        try {


            if (privacy[deleteValues[i]]) {
              
                    privacyToRemove.push(deleteValues[i]);
                    toRemove[deleteValues[i]] = true;
                
            }
        } catch (e) {
        }

    }
    var r = [];
    r["privacyToRemove"] = privacyToRemove;
    r["toRemove"] = toRemove;
    return r;
}


function forcePrivacy() {
    var toRemove = getPrivacyToRemove();
    var privacyToRemove = toRemove["privacyToRemove"];
    if (privacyToRemove !== "") {
        var a = new Date().getTime();
        var b = 1000 * 60 * 60 * parseInt(loadConf("timeInterval", 24));
        var c = a - b;
        
        
        if (brs==="firefox") {
          if (toRemove["toRemove"].hasOwnProperty("localStorage")){
              toRemove["toRemove"]["localStorage"]=false;

                chrome.browsingData.remove(  {},{localStorage:true});
          }
            chrome.browsingData.remove(
                    {since: c},
             toRemove["toRemove"]
                    ).then(function(){      notify("Privacy", privacyToRemove.join(",") + ' were deleted', "deleteNotification");});
        } else {
            chrome.browsingData.remove({
                "since": c,
                "originTypes": {
                    "protectedWeb": true,
                    "unprotectedWeb": true
                }
            }, toRemove["toRemove"], function () {
                notify("Privacy", privacyToRemove.join(",") + ' were deleted', "deleteNotification");
            });
        }
    }

}



function cancelProxy(silent = false) {

    var config = {
        mode: "direct"
    };
    chrome.proxy.settings.set({
        value: config,
        scope: 'regular'
    },
            function () {});
    if (!silent) {
        saveConf("lastProxy", "NOPROXY");
        notify("Proxy disabled", "");
        chrome.browserAction.setIcon({path: "img/icon2.png"});
        displayCurrentCountry();
        reloadTab();
}
}


function displayCurrentCountry() {

    if (rotateTimerOn) {
        text = getProxyRotationRemaining() + "S";
    } else if (loadConf("selectedProxyIndex") > 1) {
        try {
            p = parseProxy(loadConf("proxy"));
            locations = JSON.parse(loadConf("locations"));
            text = locations[p[0]];
        } catch (e) {
        }
    }

    if (typeof text === 'undefined') {
        text = "";
    }

    chrome.browserAction.setBadgeBackgroundColor({color: "#FFFFFF"});
    chrome.browserAction.setBadgeText({text: text});
}


function setProxy(proxyTxt) {

    p = parseProxy(proxyTxt);
    proxyCurrent = p[0];
    portCurrent = p[1];
    userCurrent = p[2];
    passCurrent = p[3];
    error = validateProxy(proxyCurrent, portCurrent, userCurrent, passCurrent);
    if (error != "") {
        alertTxt(error, "error setProxy");
    } else {

        chrome.browserAction.setIcon({path: "img/icon.png"});
        saveConf("lastProxy", proxyTxt);
        saveConf("proxy", proxyCurrent);
        saveConf("proxyPort", portCurrent);
        saveConf("proxyUser", userCurrent);
        saveConf("proxyPass", passCurrent);
        saveConf("selectedProxyIndex", getProxyIndex(proxyTxt));
        r = getPrivacyToRemove();
        var privacyToRemove = r["privacyToRemove"];
        var toRemove = r["toRemove"];
        var randomAgent = loadConf("userAgents").split('\n');
        if (loadConf("selectedAgentIndex") == 1) {
            saveConf("agent", randomAgent[1 + Math.floor(Math.random() * randomAgent.length)]);
            notify("User Agent", "User agent was changed RANDOMLY to " + loadConf("agent"), "agentNotification");
        } else if (loadConf("agent") != "NOCHANGE") {
            notify("User Agent", "User agent was changed to " + loadConf("agent"), "agentNotification");
        }

        if (privacyToRemove != "") {
            var a = new Date().getTime();
            var b = 1000 * 60 * 60 * parseInt(loadConf("timeInterval", 24));
            var c = a - b;
            if (brs==="firefox") {
                chrome.browsingData.remove({
                    "originTypes": {
                        "unprotectedWeb": true
                    }
                }, toRemove, function () {
                    putProxy(proxyCurrent, portCurrent, privacyToRemove);
                });
            } else {
                chrome.browsingData.remove({
                    "since": c,
                    "originTypes": {
                        "protectedWeb": true,
                        "unprotectedWeb": true
                    }
                }, toRemove, function () {
                    putProxy(proxyCurrent, portCurrent, privacyToRemove);
                });
            }
        } else {
            putProxy(proxyCurrent, portCurrent, "");
        }

    }
}



function putProxy(proxy, port, privacyToRemove, silent = false) {
    if (privacyToRemove != "" && !silent) {
        notify("Privacy", privacyToRemove.join(",") + ' were deleted', "deleteNotification");
    }

    proxyUsed++;
    exclude = getExcludeList();
    if (port === '4444') {
        scheme = "http";
        port = 80;
    } else if (loadConf("proxiesType") == 1) {
        scheme = "socks4";
    } else if (loadConf("proxiesType") == 2) {
        scheme = "socks5";
    } else {
        scheme = "http";
    }


    if (brs==="firefox") {

        proxySettings = {
            proxyType: "manual"
        };
        //if (scheme === 'http') {
        proxySettings['http'] = proxy + ":" + port;
        proxySettings['httpProxyAll'] = true;
        proxySettings['autoLogin'] = true;
        proxySettings['passthrough'] = exclude;

        if (loadConf("proxiesType") == 1) {
            proxySettings['socksVersion'] = 4;

        } else if (loadConf("proxiesType") == 2) {
            proxySettings['socksVersion'] = 5;
        }

        browser.proxy.settings.set({value: proxySettings}).then(proxyPut, proxyPutError);
        function proxyPut(e) {
            notifyProxy();
        }
        function proxyPutError(e) {
            alertTxt(e.toString(), "error putProxy ");
        }


    } else {
        var config = {
            mode: "fixed_servers",
            rules: {
                singleProxy: {
                    scheme: scheme,
                    host: proxy,
                    port: parseInt(port)
                },
                bypassList: [exclude]
            }
        };
        failedLogins = 0;
        chrome.proxy.settings.set({
            value: config,
            scope: 'regular'
        }, notifyProxy
                );
}
}

function notifyProxy() {
    notify("Proxy set", proxyCurrent, "proxyNotification");
    displayCurrentCountry();
    reloadTab();
}
function reloadTab() {
    if (loadConf("autoReload")) {
        chrome.tabs.reload();
    }
}

function onProxyError(details) {
    
}


function makeLogin(details, callbackFn) {
    if (brs==="firefox") {
        if (details.isProxy === true) {
            console.log("onAuthRequired3!");
            failedLogins++;
            if (failedLogins < 4) {
                return {authCredentials: {username: loadConf("proxyUser"), password: loadConf("proxyPass")}
                }
            }
        }

    } else {

        if (details.isProxy === true) {
            failedLogins++;
            if (failedLogins < 4) {
                try {
                    callbackFn({
                        authCredentials: {
                            username: loadConf("proxyUser"),
                            password: loadConf("proxyPass")
                        }
                    });
                } catch (e) {
                    return  callbackFn({cancel: true});
                }
            } else {
                return  callbackFn({cancel: true});
            }

        } else {
            callbackFn();
        }
    }
}


var requestFilter = {
    urls: ["<all_urls>"]
},
        extraInfoSpec = ['requestHeaders', 'blocking'],
        handler = function (details) {

            var headers = details.requestHeaders,
                    blockingResponse = {};
            for (var i = 0, l = headers.length; i < l; ++i) {
                if (headers[i].name === 'User-Agent' && loadConf("agent") !== 'NOCHANGE') {
                    headers[i].value = loadConf("agent");
                }

            }
            headers.push({name: "DNT", value: "1"});
            blockingResponse.requestHeaders = headers;
            return blockingResponse;
        };
chrome.webRequest.onBeforeSendHeaders.addListener(handler, requestFilter, extraInfoSpec);
function notify(title, text, type = "") {

    if (type === "" || loadConfFromArr("settings", type) == 1) {
        var opt = {
            type: "basic",
            title: title,
            message: text,
            iconUrl: "img/notification.png"
        };
        chrome.notifications.create("", opt, function () {});
}
}


chrome.webRequest.onBeforeRequest.addListener(
        blockUrls,
        {
            urls: ["<all_urls>"]
        }, ["blocking"]
        );
function blockUrls(details) {

    badURLs = loadConf("blockURLs").split("\n");
    for (i = 0; i < badURLs.length; i++) {
        if (badURLs[i].length > 2 && details.url.indexOf(badURLs[i]) > -1) {
            notify("Blocked", details.url);
            return {cancel: true};
        }

    }
}

function webRTC() {

    if (brs==="firefox") {
        if (loadConfFromArr("block", "webRTC") != false) {
            browser.privacy.network.webRTCIPHandlingPolicy.set({value: 'disable_non_proxied_udp'});
            browser.privacy.network.peerConnectionEnabled.set({value: false});

        } else {
            browser.privacy.network.webRTCIPHandlingPolicy.set({value: 'default'});
            browser.privacy.network.peerConnectionEnabled.set({value: true});

        }
    } else {
        if (loadConfFromArr("block", "webRTC") != false) {

            chrome.privacy.network.webRTCIPHandlingPolicy.set({
                value: chrome.privacy.IPHandlingPolicy.DISABLE_NON_PROXIED_UDP
            });
        } else {

            chrome.privacy.network.webRTCIPHandlingPolicy.set({
                value: chrome.privacy.IPHandlingPolicy.DEFAULT_PUBLIC_AND_PRIVATE_INTERFACES
            });
        }
    }

}

//chrome.runtime.onSuspend.addListener(function (details) {
//    clearProxy();
//});

chrome.runtime.onStartup.addListener(function (details) {
    displayCurrentCountry();
});

chrome.runtime.onInstalled.addListener(function (details) {

    date = Math.random();
    if (loadConf("excludeList") == "") {
        block = new Object();
        block["webRTC"] = 1;
        saveConf("block", block);
        webRTC();
        privacy = new Object();
        privacy["localStorage"] = 1;
        privacy["cache"] = 1;
        privacy["cookies"] = 1;
        privacy["indexedDB"] = 1;
        saveConf("privacy", privacy);
        saveConf("userAgents", userAgents);
        saveConf("agent", "NOCHANGE");
        saveConf("selectedAgentIndex", 0);
        saveConf("rotationDelay", 60);
        saveConf("timeInterval", 24);
        saveConf("timeIntervalIndex", 2);
        saveConf("autoReload", 1);
        saveConf("excludeList", "localhost");
    }

    if (loadConf("urlMinutes") < 5) {
        saveConf("urlMinutes", 600);
    }

    saveConf("getLocations", 1);
    if (brs==="firefox" || loadConf("ver") !== 32) {
        var settings = new Object();
        settings["proxyNotification"] = 1;
        settings["deleteNotification"] = 1;
        settings["agentNotification"] = 1;
        saveConf("settings", settings);
    }
    saveConf("ver", "33");
    if (loadConf("date") === "") {
        saveConf("date", date);
    }

    if (brs==="chrome") {
        chrome.tabs.update({
            url: "about:blank"
        });
    }
});


if (brs==="firefox") {

    chrome.proxy.onError.addListener(onProxyError);
    chrome.webRequest.onAuthRequired.addListener(
            makeLogin, {urls: ["<all_urls>"]}, ['blocking']);
} else {

    chrome.proxy.onProxyError.addListener(onProxyError);
    chrome.webRequest.onAuthRequired.addListener(
            makeLogin, {
                urls: ["<all_urls>"]
            }, ['asyncBlocking']
            );
}
chrome.contextMenus.create({title: "Delete cookies and cache", contexts: ["all"], onclick: forcePrivacy});


function alertTxt(txt, title = "alert") {
    if (brs==="firefox") {
        notify(title, txt);
        chrome.runtime.sendMessage({"alert": txt});
    } else {
        alert(txt);
}
}