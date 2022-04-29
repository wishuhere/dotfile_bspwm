
document.addEventListener('DOMContentLoaded', bpOnLoad, false);
var bg, rotationTimmer;

function bpOnLoad() {

    bg = chrome.extension.getBackgroundPage();

    document.getElementById("editProxyList").addEventListener("click", editProxyList);
    document.getElementById("editUserAgentList").addEventListener("click", editUserAgentList);
    document.getElementById("selectProxy").addEventListener("change", selectProxyChange);
    document.getElementById("selectUserAgent").addEventListener("change", selectUserAgent);
    document.getElementById("addProxyOK").addEventListener("click", loadProxiesFromUrl);
    document.getElementById("addUserAgentOK").addEventListener("click", EditUserAgentOK);
    document.getElementById("deleteOptions").addEventListener("click", deleteOptions);
    document.getElementById("blockOptions").addEventListener("click", blockOptions);
    document.getElementById("bandwidthOptions").addEventListener("click", bandwidthOptions)
    document.getElementById("bandwidthOK").addEventListener("click", bandwidthOK)
    document.getElementById("optionsOK").addEventListener("click", optionsOK);
    document.getElementById("blockOK").addEventListener("click", blockOK);
    document.getElementById("addProxyCancel").addEventListener("click", addProxyCancel);
    document.getElementById("addUserAgentCancel").addEventListener("click", addProxyCancel);
    document.getElementById("about").addEventListener("click", about);
    document.getElementById("aboutOK").addEventListener("click", aboutOk);
    document.getElementById("autoReload").addEventListener("click", autoReloadClick);
    document.getElementById("rotateOK").addEventListener("click", rotateOK);
    document.getElementById("rotateCancel").addEventListener("click", rotateCancel);
    document.getElementById("stopRotation").addEventListener("click", stopRotation);
    document.getElementById("testMyProxies").addEventListener("click", testMyProxies);
    document.getElementById("excludeOptions").addEventListener("click", excludeOptions);
    document.getElementById("excludeOK").addEventListener("click", excludeOK);
    document.getElementById("forcePrivacy").addEventListener("click", forcePrivacy);
    document.getElementById("proxiesType").addEventListener("change", proxiesTypeChanged);
    document.getElementById("proxyMode0").addEventListener("click", function () {
        switchProxyMode(0)
    });
    document.getElementById("proxyMode1").addEventListener("click", function () {
        switchProxyMode(1)
    });

    loadProxies();
    populateProxies();
    populateUserAgents();

    selectCurrentProxy();

    chrome.runtime.onMessage.addListener(
            function (request, sender, sendResponse) {

                if (request.call === "loadProxiesFromUrl") {
                    if (request.error === "") {
                        document.getElementById("proxiesTextArea").value = bg.loadConf("proxiesList");
                        //   editProxyListOK(false);
                        notify("Autoload", "The proxy list was automatically loaded now from " + bg.loadConf("urlProxies"));
                    } else {
                        alert(request.error);
                    }
                } else if (request.call === "getLocations") {
                    editProxyListOKFinish(false);
                } else if (request.hasOwnProperty("alert")) {
                    alert(request.alert);
                }
            });

    bg.shouldLoadProxiesFromUrl();
    shouldDisplayPromo();
}


function proxiesTypeChanged() {
    if (document.getElementById("proxiesType").selectedIndex > 1) {
        alert("This browser doesn't support SOCKS proxies with user/pass. Please make sure that always your SOCKS proxies are in the format IP:port");
    }

}

function swtichTab(tab) {

    for (i = 1; i < 11; i++) {
        if (i === tab) {
            document.getElementById("tab" + i).style.display = "block";
        } else {
            document.getElementById("tab" + i).style.display = "none";
        }
    }

    if (tab == 2) {
        try {
            if (typeof $("#proxiesTextArea").parent().attr("class") == "undefined") {
                $("#proxiesTextArea").linedtextarea();
            }
        } catch (e) {
        }
    } else if (tab == 6) {
        try {
            if (typeof $("#userAgentsTextArea").parent().attr("class") == "undefined") {
                $("#userAgentsTextArea").linedtextarea();
            }
        } catch (e) {
        }
    }

}

function rotateCancel() {
    showHide('proxySelectDiv', 'proxyRotationDiv');
    swtichTab(1);
}

function stopLocations() {
    swtichTab(1);
}

function rotateOK() {
    rotationDelayNew = document.getElementById('rotateSeconds').value;

    if (rotationDelayNew < 5) {
        alert("Please enter bigger than 5 seconds");
    } else if (bg.getProxiesList().length < 3) {
        alert("You need to have at least 3 proxies on your list");
    } else {

        bg.saveConf("rotationDelay", rotationDelayNew);
        bg.saveConf("cyclerotate", document.getElementById('cyclerotate').checked);
        bg.saveConf("shufflerotate", document.getElementById('shufflerotate').checked);
        swtichTab(1);
        rotationTimmer = setInterval(rotateNow, 1000);
        bg.startProxyRotation();
        $("#testMyproxies").hide();
        showHide('proxyRotationDiv', 'proxySelectDiv');
    }
}


function rotateNow() {
    remaining = bg.getProxyRotationRemaining();
    document.getElementById('rotatingText').innerHTML = bg.loadConf("proxy") + "<br> Rotating to the next proxy<br> in " + (remaining + 1) + " seconds";
    if (!bg.rotateTimerOn) {
        stopRotation();
    }
}


function autoRotateOptions() {
    swtichTab(5);
}

function about() {
    document.getElementById("monkey").src = getImageURL("img/monkey.gif");

    swtichTab(4);
}

function aboutOk() {
    swtichTab(1);
}

function selectUserAgent() {
    bg.saveConf("agent", document.getElementById("selectUserAgent").value);
    bg.saveConf("selectedAgentIndex", document.getElementById("selectUserAgent").selectedIndex);

}

function selectProxyChange() {
    bg.saveConf("selectedProxyIndex", document.getElementById("selectProxy").selectedIndex);

    var select = document.getElementById("selectProxy");

    if (select.value == "NOPROXY") {
        bg.cancelProxy();
    } else if (select.value == "AUTOROTATE") {
        swtichTab(5);
        document.getElementById('rotateSeconds').value = bg.loadConf("rotationDelay");
        document.getElementById('cyclerotate').checked = bg.loadConf("cyclerotate");
        document.getElementById('shufflerotate').checked = bg.loadConf("shufflerotate");

    } else {

        bg.setProxy(select.value);

    }
}


function bandwidthOptions() {
    clearForm("settingsContainer");
    settings = bg.loadConf("settings");
    for (i = 0; i < bg.settingsValues.length; i++) {
        var div = document.createElement("div");
        var option = document.createElement("input");
        option.type = "checkbox";
        try {
            if (settings[bg.settingsValues[i]]) {
                option.checked = true;
            }
        } catch (e) {
        }
        option.id = bg.settingsValues[i];
        div.appendChild(option);
        div.appendChild(document.createTextNode(bg.settingsValuesTxt[bg.settingsValues[i]]));
        document.getElementById("settingsContainer").appendChild(div);
    }

    swtichTab(8);
}

function blockOptions() {

    clearForm("blockContainer");
    block = bg.loadConf("block");
    for (i = 0; i < bg.blockValues.length; i++) {
        var div = document.createElement("div");
        var option = document.createElement("input");
        option.type = "checkbox";
        try {
            if (bg.loadConfFromArr("block", bg.blockValues[i])) {
                option.checked = true;
            }
        } catch (e) {
        }
        option.id = bg.blockValues[i];
        div.appendChild(option);
        var txt = bg.blockValues[i];
        if (bg.blockValues[i] == 'webRTC') {
            txt = 'webRTC (improves privacy but could block some videostreaming too)';
        }
        div.appendChild(document.createTextNode(txt));
        document.getElementById("blockContainer").appendChild(div);
    }
    document.getElementById("blockURLs").value = bg.loadConf("blockURLs")
    swtichTab(7);

}


function forcePrivacy() {
    optionsOK();
    bg.forcePrivacy();

}

function deleteOptions() {

    clearForm("privacy");

    for (i = 0; i < bg.deleteValues.length; i++) {
        var div = document.createElement("div");
        var option = document.createElement("input");
        option.type = "checkbox";
        try {
            if (bg.loadConfFromArr("privacy", bg.deleteValues[i])) {
                option.checked = true;
            }
        } catch (e) {
        }
        option.id = bg.deleteValues[i];
        div.appendChild(option);
        div.appendChild(document.createTextNode(bg.deleteValues[i]));
        document.getElementById("privacy").appendChild(div);
    }

    document.getElementById("timeInterval").selectedIndex = bg.loadConf("timeIntervalIndex");
    swtichTab(3);
}

function bandwidthOK() {
    settings = new Object();
    for (i = 0; i < bg.settingsValues.length; i++) {
        try {
            settings[bg.settingsValues[i]] = document.getElementById(bg.settingsValues[i]).checked;
        } catch (e) {
        }
    }
    bg.saveConf("settings", settings);

    swtichTab(1);

}


function blockOK() {

    if (document.getElementById("blockContainer").childNodes.length > 0) {

        block = new Object();
        for (i = 0; i < bg.blockValues.length; i++) {
            try {
                block[bg.blockValues[i]] = document.getElementById(bg.blockValues[i]).checked;
            } catch (e) {
            }
        }

        bg.saveConf("blockURLs", document.getElementById("blockURLs").value);
        bg.saveConf("block", block);
    }


    bg.webRTC();

    swtichTab(1);
}

function optionsOK() {

    if (document.getElementById("privacy").childNodes.length > 0) {
        privacyNew = new Object();
        for (i = 0; i < bg.deleteValues.length; i++) {
            try {
                privacyNew[bg.deleteValues[i]] = document.getElementById(bg.deleteValues[i]).checked;
            } catch (e) {
            }
        }
        bg.saveConf("privacy", privacyNew);
        bg.saveConf("timeIntervalIndex", document.getElementById("timeInterval").selectedIndex);
        bg.saveConf("timeInterval", document.getElementById("timeInterval").value);
    }


    swtichTab(1);
}


function editProxyList() {
    document.getElementById("proxiesTextArea").value = bg.loadConf("proxiesList");
    document.getElementById("getLocations").checked = bg.loadConf("getLocations");
    document.getElementById("proxiesType").selectedIndex = bg.loadConf("proxiesType");

    swtichTab(2);
    switchProxyMode(bg.loadConf("proxyMode"));

}

function editUserAgentList() {
    document.getElementById("userAgentsTextArea").value = bg.userAgents;
    swtichTab(6);
}

function addProxyCancel() {
    swtichTab(1);
}

function EditUserAgentOK() {
    swtichTab(1);
    bg.saveConf("userAgents", document.getElementById("userAgentsTextArea").value);
    populateUserAgents(true);
}



function testMyProxies() {
    $("#typeOfProxies").val(bg.loadConf("proxiesType"));
    $("#testmyproxiesForm").submit();
}

function excludeOptions() {
    swtichTab(10);
    document.getElementById("excludeListTextarea").value = bg.loadConf("excludeList");
}

function excludeOK() {
    saveExclude();
    selectProxyChange();
    swtichTab(1);
}


function saveExclude() {
    bg.saveConf("excludeList", document.getElementById("excludeListTextarea").value);
}


function loadProxiesFromUrl() {

    var proxyMode = 0;
    if (document.getElementById("proxyMode1").checked) {
        proxyMode = 1;
    }

    bg.saveConf("proxyMode", proxyMode);
    bg.saveConf("getLocations", document.getElementById("getLocations").checked);
    document.getElementById("stopLocations").addEventListener("click", stopLocations);
    bg.saveConf("proxiesType", document.getElementById("proxiesType").selectedIndex);

    if (proxyMode === 1) {

        bg.saveConf("urlProxies", $("#urlProxies").val());
        bg.saveConf("urlMinutes", $("#urlMinutes").val());
        if (bg.loadConf("urlMinutes") < 2) {
            bg.saveConf("urlMinutes", 600);
        }
        if ($("#urlProxies").val().length < 6) {
            alert("Invalid URL");
        } else if ($("#urlMinutes").val() < 2) {
            alert("Minutes must be at least 2");
        } else {
            bg.loadProxiesFromUrl();
        }
    } else {
        bg.saveConf("proxiesList", bg.sanitizeProxies(document.getElementById("proxiesTextArea").value));
        editProxyListOK();
    }
}


function editProxyListOK(changeProxy = true) {

    if (bg.loadConf("getLocations")) {
        swtichTab(9);
        bg.getLocations();
    } else {
        editProxyListOKFinish(changeProxy);
}
}

function editProxyListOKFinish(changeProxy = true) {
    swtichTab(1);
    populateProxies(changeProxy);
    document.getElementById("stopLocations").removeEventListener("click", stopLocations);
}

function clearForm(id) {
    select = document.getElementById(id);
    while (select.firstChild) {
        select.removeChild(select.firstChild);
    }
}


function showHide(id1, id2) {
    document.getElementById(id1).style.display = "block";
    document.getElementById(id2).style.display = "none";

    if (id2 == "proxyRotationDiv") {
        $("#testMyProxies").show();
    }

    if (id1 == "proxyRotationDiv") {
        $("#testMyProxies").hide();
    }
}

function stopRotation() {
    bg.stopProxyRotation();
    document.getElementById("selectProxy").selectedIndex = bg.loadConf("selectedProxyIndex");
    $('.selectpicker').selectpicker('refresh');
    showHide('proxySelectDiv', 'proxyRotationDiv');

}

function getImageURL(img) {
    if (bg.brs === "firefox") {
        return   browser.runtime.getURL(img)
    } else {
        return chrome.extension.getURL(img);
    }
}


function populateProxies(reset) {


    if (Math.floor((Math.random() * 50) + 1) == 1) {
        //  document.getElementById("mod").style.display = "block";
    } else {
        //  document.getElementById("mod").style.display = "none";
    }

    clearForm("selectProxy");
    var proxies = bg.loadConf("proxiesList").split('\n');
    var select = document.getElementById("selectProxy");
    var option = document.createElement("option");
    option.text = 'NO PROXY';
    option.value = 'NOPROXY';
    select.appendChild(option);
    locationTxt = "<img style='width:40px;height:20px;margin-right:5px;' src='" + getImageURL("img/flags/noproxy.png'").toLowerCase() + "'>";
    if (proxies[0].length > 1) {
        option.setAttribute("data-content", locationTxt + 'No proxy');
    } else {
        option.setAttribute("data-content", locationTxt + 'No proxy. Add proxies from Edit -->');
    }

    var option2 = document.createElement("option");
    option2.text = 'AUTOROTATE EVERY ' + bg.loadConf("rotationDelay") + ' SECONDS';
    option2.value = 'AUTOROTATE';
    locationTxt = "<img style='width:40px;height:20px;margin-right:5px;' src='" + getImageURL("img/flags/rotate.png'").toLowerCase() + "'>";
    option2.setAttribute("data-content", locationTxt + 'Autorotate every ' + bg.loadConf("rotationDelay") + ' seconds');
    select.appendChild(option2);

    try {
        locations = JSON.parse(bg.loadConf("locations"));
    } catch (e) {
        locations = [];
        locationTxt = '';
    }

    for (i = 0; i < proxies.length; i++) {
        if (proxies[i].length > 0) {
            var option = document.createElement("option");
            p = bg.parseProxy(proxies[i]);
            if (locations[p[0]] !== undefined) {
                locationTxt = "<img title='" + locations[p[0]] + "' style='width:40px;height:20px;margin-right:5px;' src='" + getImageURL("img/flags/" + locations[p[0]] + ".png'").toLowerCase() + "'>";
            } else {
                locationTxt = '';
            }

            option.value = proxies[i];

            if (p.length == 5) {
                label = p[4] + ' (' + p[0] + ')';
            } else if (p.length == 3) {
                label = p[2] + ' (' + p[0] + ')';
            } else {
                label = p[0];
            }
            option.setAttribute("data-content", locationTxt + label);
            select.appendChild(option);
        }
    }

    if (reset) {
        if (proxies[0].length > 1) {
            bg.saveConf("selectedProxyIndex", 0);

        } else {
            bg.saveConf("selectedProxyIndex", 0);
            bg.cancelProxy();
        }
    } else {
        if (bg.rotateTimerOn) {
            showHide('proxyRotationDiv', 'proxySelectDiv');
        }
    }
    selectCurrentProxy();
    $("#proxiesHidden").val(proxies.join(";"));

}

function selectCurrentProxy() {
    $('.selectpicker').selectpicker('val', bg.loadConf("lastProxy"));
    if (document.getElementById("selectProxy").selectedIndex === -1) {
        document.getElementById("selectProxy").title = bg.loadConf("lastProxy");
    } else {
        document.getElementById("selectProxy").title = "";
    }

    $('.selectpicker').selectpicker('refresh');
    $('.selectpicker').selectpicker('toggle');
}

function populateUserAgents(reset) {
    clearForm("selectUserAgent");
    var select = document.getElementById("selectUserAgent");
    var agents = document.getElementById("userAgentsTextArea").value.trim().split('\n');
    var option = document.createElement("option");
    option.text = 'No change';
    option.value = 'NOCHANGE';
    select.appendChild(option);
    var option = document.createElement("option");
    option.text = 'Random from the list on each proxy change';
    option.value = 'RANDOM';
    select.appendChild(option);

    for (i = 0; i < agents.length; i++) {
        if (agents[i].length > 0) {
            var option = document.createElement("option");
            option.text = agents[i];
            option.value = agents[i];
            select.appendChild(option);
        }
    }

    if (reset) {
        bg.saveConf("selectedAgentIndex", 0);
    }
    select.selectedIndex = bg.loadConf("selectedAgentIndex");
}


function notify(title, text) {
    bg.notify(title, text);
}


function autoReloadClick() {
    bg.saveConf("autoReload", document.getElementById("autoReload").checked);
}

function loadProxies() {
    document.getElementById("autoReload").checked = bg.loadConf("autoReload");
    rotationDelay = bg.loadConf("rotationDelay", 60);
    document.getElementById("proxiesTextArea").value = bg.loadConf("proxiesList");
    document.getElementById("userAgentsTextArea").value = bg.loadConf("userAgents");

}


function validateProxy(proxy, port) {
    var error = "";

    if (proxy.length < 7) {
        error = "proxy " + proxy + " is invalid";
    } else if (isNaN(parseInt(port))) {
        error = "port " + port + " is invalid";
    }
    return error;
}

function switchProxyMode(mode) {

    if (mode === 1) {
        showHide("proxyArea1", "proxyArea0");
        $("#proxyMode1").prop("checked", true);
        $("#urlProxies").val(bg.loadConf("urlProxies"));
        $("#urlMinutes").val(bg.loadConf("urlMinutes"));

    } else {
        bg.stopLoadProxiesTimer();
        showHide("proxyArea0", "proxyArea1");
        $("#proxyMode0").prop("checked", true);
    }
}

function shouldDisplayPromo() {


    if (Math.round(Math.random() * 33) === 3 && bg.proxyUsed > 10) {
        if (bg.brs === 'fireox') {
            promo = [
                '<b>If you like the plugin and you want more features, please help us with a  <u> <a href="https://addons.mozilla.org/ro/firefox/addon/bp_proxy_switcher/" target="_blank">review here</a></u></b>',
                '<b>Need a VPN too, please check our <u><a href="https://buyVPN.com/panel/link.php?id=1" target="_blank">VPN</a></u>'
            ];
        } else {
            promo = [
                '<b>If you like the plugin and you want more features, please help us with a  <u> <a href="https://chrome.google.com/webstore/detail/bp-proxy-switcher/bapeomcobggcdleohggighcjbeeglhbn/reviews" target="_blank">review here</a></u></b>',
                '<b>Need a VPN too, please check our <u><a href="https://buyVPN.com/panel/link.php?id=1" target="_blank">VPN</a></u>'
            ];
        }
        document.getElementById("promo").innerHTML = promo[Math.floor(Math.random() * promo.length)];
        document.getElementById("promo").style.display = "block";
    } else {
        document.getElementById("promo").style.display = "none";
    }

}

