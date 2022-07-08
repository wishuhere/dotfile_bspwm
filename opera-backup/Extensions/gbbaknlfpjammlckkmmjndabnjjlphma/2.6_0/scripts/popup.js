/**
   GeoShift (C) 2018 Beholder Corporation / FoxyProxy
 * support@getfoxyproxy.org
 *
 * This source code is proprietary, and released under the EULA available in the
 * LICENSE file at the root of this installation. Do not copy or re-use without
 * written permission.
 */

const SSL_PORT = 4443;
const NO_SSL_PORT = 13129;

function localizeHtmlPage()
{
    var objects = document.getElementsByTagName('html');
    for (var j = 0; j < objects.length; j++)
    {
        var obj = objects[j];

        var valStrH = obj.innerHTML.toString();
        var valNewH = valStrH.replace(/__MSG_(\w+)__/g, function(match, v1)
        {
            return v1 ? chrome.i18n.getMessage(v1) : "";
        });

        if(valNewH != valStrH)
        {
            obj.innerHTML = valNewH;
        }
    }
}
$(document).foundation();
let DIRECT = {value: {mode: 'direct'}, scope: 'regular'}, username, password;
$(document).ready(function() {
    localizeHtmlPage();
    chrome.storage.sync.get(null, (items) => {
        if ("credentials" in items) {
          username = items.credentials.username;
          password = items.credentials.password;
          $("#username").val(items.credentials.username);
          $("#password").val(items.credentials.password);
        }
        else {
          $("#loginRow").show();
          $("#accountsRow").hide();
          return;
        }
        if (items.accounts) {
            
            populateAccounts(items.accounts);
            $("#loginRow").hide();
            $("#accountsRow").show();
        }
        else {
            $("#loginRow").show();
            $("#accountsRow").hide();
        }

        if (items.useSSL) {
        
         $('#useSSL').prop('checked', true);
        }
    });
});

$(document).ready(function() {
    $('body').on('click', 'a', function(){
     chrome.tabs.create({url: $(this).attr('href')});
     return false;
    });
});

$('#useSSL').on('click', function(e) {
    let val = $(this).prop('checked');
    chrome.storage.sync.set({'useSSL': val}, function() {
        
        chrome.proxy.settings.get({'incognito': false}, function(config) {
            
            if (config.levelOfControl == "controlled_by_other_extensions") {
                
                showMessage("<strong>Another Chrome extension is controlling proxy settings.<br>Please disable it.</strong>", true);
                return;
            }
            let currentServer = config.value.mode == "fixed_servers" ? config.value.rules.proxyForHttp.host : '',
                currentPort = config.value.mode == "fixed_servers" ? config.value.rules.proxyForHttp.port : '';
            
            if (currentServer) {
                let proxyConfig = {scheme: val ? 'https' : 'http', host: currentServer, port: val ? SSL_PORT : NO_SSL_PORT};
                
                let config = {
                    mode: 'fixed_servers',
                    rules: {
                        proxyForHttp: proxyConfig,
                        proxyForHttps: proxyConfig,
                        proxyForFtp: proxyConfig,
                        fallbackProxy: proxyConfig,
                        bypassList: ["<local>", "10.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.168.0.0/16", "getfoxyproxy.org"]
                    }
                };
                chrome.proxy.settings.set({value: config, scope: 'regular'}, function() {});
            }
        });
    });
});


$('#login-button').on('click', function(e) {
    $('#login-error').hide();
    $('#login-button').prop('disabled', true);

    var credentials = {username: $("#username").val(), password: $("#password").val()};
		chrome.proxy.settings.set(DIRECT,
        function() {
            chrome.storage.sync.remove('accounts', function() {
                offButton($('input[data-server]'));
                chrome.runtime.getBackgroundPage(function(page) {
                    page.setCredentials({'authCredentials': null});
										act({params: credentials, spinnerSelector: '#spinner', btnSelector: '#login-button', url: 'https://bilestoad.com/webservices/get-accounts.php',
												successCallbackAndParams: {callback: loginSuccess, params: credentials}, errorCallbackAndParams: {callback: loginFailure, params: credentials}});
                });
            });
        }
    );
});

function loginSuccess(json, credentials) {
    for (var i in json) {
        var entry = json[i];
        delete entry.ovpnFile; 
        delete entry.hasPPTP; 
    }
    
    chrome.storage.sync.set({'credentials': credentials}, function() { 
        chrome.storage.sync.set({'accounts': json}, function() {


            if (chrome.runtime.lastError) {
                showMessage("We were unable to store your accounts.<br>You need to login again next time you open GeoShift.", true);
                $('#error-row').show();
            }
            $('#viewaccounts-button').show();
            $("#loginRow").slideUp(200, function() {
                populateAccounts(json);
                $("#accountsRow").slideDown();
            });
        });
    });
}

function loginFailure(json, credentials) {
    $('#login-error').show();
    $('#viewaccounts-button').hide();
    chrome.storage.sync.set({'credentials': credentials}, function() {
        chrome.storage.sync.remove('accounts'); 
    });
}

$('#refresh-button').on('click', function() {
    chrome.storage.sync.get('credentials', function(obj) {
        $('#viewaccounts-button').show();
        $('#username').val(obj && obj.credentials && obj.credentials.username);
        $('#password').val(obj && obj.credentials && obj.credentials.password);
        $("#loginRow").show();
        $("#accountsRow,#error-row").hide();
    });
});

$('#viewaccounts-button').on('click', function() {
    $("#loginRow").slideUp(200, function() {
        $("#accountsRow").slideDown();
    });
});

$('#accountsContainer').on('click', 'input[data-server]', function() {
    let useSSL = $('#useSSL').prop('checked');
    let scheme = useSSL ? 'https' : 'http';

    let server = $(this).attr('data-server'), port = $(this).attr('data-port'),
        username = $(this).attr('data-username'),
        password = $(this).attr('data-password'),
        ttt = $(this),
        proxyConfig = {scheme: scheme, host: server, port: useSSL ? SSL_PORT : parseInt(port)};
    if (ttt.attr('selected') == 'selected') {
        chrome.proxy.settings.set(DIRECT);
        offButton(ttt);
    }
    else {
        var config = {
            mode: 'fixed_servers',
            rules: {
                proxyForHttp: proxyConfig,
                proxyForHttps: proxyConfig,
                proxyForFtp: proxyConfig,
                fallbackProxy: proxyConfig,
                bypassList: ["<local>", "10.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.168.0.0/16"]
            }
        };
        
        chrome.proxy.settings.set({value: config, scope: 'regular'},
            function() {
                chrome.runtime.getBackgroundPage(function(page) {
                    page.setCredentials({'authCredentials': {'username': username, 'password': password}});
                });
                onButton(ttt);
                chrome.storage.sync.set({'credentials': {username: username, password: password}}, function() {
                    
                });
            }
        );
    }
});

function populateAccounts(accounts) {
    chrome.proxy.settings.get({'incognito': false}, function(config) {
        
        if (config.levelOfControl == "controlled_by_other_extensions") {
            
            showMessage("<strong>Another Chrome extension is controlling proxy settings.<br>Please disable it.</strong>", true);
            return;
        }
        let currentServer = config.value.mode == "fixed_servers" ? config.value.rules.proxyForHttp.host : '';
        
        var tmp = [], template = $('#accountRowTemplate').html(),
            noCountryTemplate = $('#accountRowTemplateNoNode').html(),
            somethingWillBeSelected = false, allInactive = true,
            oneOftheUsernames, oneOfthePasswords;
        for (var i=0; i<accounts.length; i++) {
            if (currentServer && currentServer == accounts[i].hostname) {
                somethingWillBeSelected = true;
                
            }
        }
        for (var i=0; i<accounts.length; i++) {
            account = accounts[i];
            if (!account.country) {
                oneOftheUsernames = account.username;
                oneOfthePasswords = account.password;
                var t = noCountryTemplate.replace(/%data-username/g, account.username);
                t = t.replace(/%data-password/g, account.password);
                tmp.push(t);
                continue;
            }
            if (account.active === "true")
                allInactive = false;
            var t = template.replace(/%data-country/g, account.country);
            t = t.replace(/%data-server/g, account.hostname);
            t = t.replace(/%data-ip/, account.ip);
            t = t.replace(/%data-username/g, account.username);
            t = t.replace(/%data-password/g, account.password);
            oneOftheUsernames = account.username;
            oneOfthePasswords = account.password;
            t = t.replace(/%data-port/g, account.port);
            if (account.country_code.toLowerCase() == "uk") account.country_code = "gb";
            t = t.replace(/%data-cc/g, account.country_code.toLowerCase());
            if (currentServer == account.hostname) {
                t = t.replace('%color', account.active == 'true' ? 'success' : 'secondary');
                t = t.replace('%selected', 'selected');
                t = t.replace('%onOrOff', 'Turn Off');
                t = t.replace('%hideIfActive', account.active == 'true' ? 'hide' : '');
                t = t.replace('%hideIfInactive', account.active == 'true' ? '' : 'hide');
                tmp.unshift(t); 
            }
            else {
                t = t.replace('%hideIfActive', account.active == 'true' ? 'hide' : '');
                t = t.replace('%hideIfInactive', account.active == 'true' ? '' : 'hide');
                t = t.replace('%color', account.active == 'true' ? '' : 'secondary');
                t = t.replace('%selected', somethingWillBeSelected ? 'disabled' : ''); 
                t = t.replace('%onOrOff', 'Turn On');
                tmp.push(t);
            }
        }
        if (allInactive) {
            showMessage('You have no active accounts.<br>You can renew them <a class="renew-link">here</a> or buy new ones <a href="https://getfoxyproxy.org/order/">here</a>.', true);
        }
        $("#accounts").html(tmp.join(''));

        $('.renew-link').attr('href', 'https://getfoxyproxy.org/panel/?username=' + oneOftheUsernames +
            '&password=' + oneOfthePasswords);
    });
}

function offButton(btn) {
    btn.attr('value', 'Turn On');
    btn.removeAttr('selected');
    $('.callout').removeClass('success'); 
    $('input[data-server]').prop('disabled', false);
    chrome.browserAction.setBadgeText({text: ''});
    chrome.browserAction.setTitle({title: ''});
    chrome.browserAction.setIcon({
        path: {
            "16": "images/blue-globe-foxy-alt-icon-64.png",
            "32": "images/blue-globe-foxy-alt-icon-128.png"
        }
    }, genericCallbackErrorHandler);
}

function onButton(selector) {
    if (typeof selector === 'string') selector = $(selector);
    selector.attr('value', 'Turn Off');
    selector.attr('selected', 'true');
    selector.closest('.callout').addClass('success'); 
    $('input[data-server]').prop('disabled', true);
    selector.prop('disabled', false);
    var countryCode = selector.attr('data-cc'),
        flagPath = 'images/flagicon-2.4.0/1x1/' + countryCode + '.svg';
    chrome.browserAction.setBadgeText({text: countryCode});
    chrome.browserAction.setTitle({title: selector.attr('data-country')});
    chrome.browserAction.setBadgeBackgroundColor({color: '#cc6600'});
    var flagIcon32 = document.getElementById('flag-icon-canvas-32'), ctx32 = flagIcon32.getContext('2d'),
            flagIcon16 = document.getElementById('flag-icon-canvas-16'), ctx16 = flagIcon16.getContext('2d');

    var img = new Image();
    img.src = chrome.extension.getURL(flagPath);
    img.onload = function() {
        ctx32.clearRect(0, 0, 32, 32);
        ctx16.clearRect(0, 0, 16, 16);
        ctx32.drawImage(img, 0, 0, 32, 32);
        ctx16.drawImage(img, 0, 0, 16, 16);
        var imageData32 = ctx32.getImageData(0, 0, 32, 32), imageData16 = ctx16.getImageData(0, 0, 16, 16);
        chrome.browserAction.setIcon({
            imageData: {
                "16": imageData16,
                "19": imageData16,
                "32": imageData32,
                "38": imageData32
            }
        }, genericCallbackErrorHandler);
    }
    img.src = chrome.extension.getURL(flagPath);
}

function showMessage(textOrHtml, isHtml) {
  if (isHtml) $('#errorContent').html(textOrHtml);
  else $('#errorContent').text(textOrHtml);
  $('#error-row').show();
}

function genericCallbackErrorHandler() {
    if (chrome.runtime.lastError) {
      
		}
}

$('#accountsContainer').on('click', '#close-button', (e) => {
    $("#error-row").slideUp(100);
});

$('#showHidePassword').on('click', function() {
	var dataInput = $(this).attr('data-input');
	if ($('#'+dataInput).attr('type') == 'password') {
		$('#'+dataInput).attr('type', 'text');
		$(this).removeClass('fa-eye-slash').addClass('fa-eye');
	} else {
		$('#'+dataInput).attr('type', 'password');
		$(this).removeClass('fa-eye').addClass('fa-eye-slash');
	}
});

$('#manual-setup-btn').on('click', (e) => {
    $('#manual-setup-container').toggle();
    $('#manual-setup-error').hide();
    return false;
});

$('#manual-setup-submit').on('click', (e) => {
    let json = $('#manual-setup-input').val();
    try {
        let tmp = JSON.parse(json);
        if (!verifyConfig(tmp)) throw new SyntaxError();
        loginSuccess(json, {username: '', password: ''});
    }
    catch (e) {
        $('#manual-setup-error').slideDown(200);
    }
});

function verifyConfig(json) {
    let ret = false;
    if (json.accounts) {
    }
    return ret;
}
