/*
 * Add/edit content view component dialog.
 * Input: {{
 *    item:?Element
 * }}
 * - The component to be edited (or null to add a new component).
 *
 * Output: {?Element} The successfully changed or created component or null if
 *    the operation was canceled.
 */

/*global window,DejaClickUi,$,DejaClick,document,chrome*/

'use strict';

/**
 * Preferred width of the add/edit content view component dialog.
 * @const
 */
var preferredWidth = 500;
/**
 * Preferred height of the add/edit content view component dialog.
 * @const
 */
var preferredHeight = 400;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Class to encapsulate the functionality of editing content view component.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {{
 *    item: ?Element,
 * }} aOptions The options passed to the dialog.
 * @param {!Element} aRootElement The parent element of the page's UI.
 *    This is typically the documentElement.
 * @param {!Window} aWindow The window object.
 * @param {!chrome.WindowsApi} aWindowsApi The chrome.windows API.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!DejaClick.DejaService} aService The DejaClick record/replay service.
 * @param {!DejaClick.Script} aScript The script to which the edited
 *    javascript validation applies.
 * @param {function(new:DejaClick.EventRegistration)} AEventRegistration
 *    The event registration constructor.
 */
DejaClickUi.ProxySettings = function (aOptions, aRootElement, aWindow,
                                    aWindowsApi, aConstants, aUtils, aService,
                                    aScript, AEventRegistration) {
   var root;

   aWindow.returnValue = null;

   this.item = aOptions.item;
   this.window = aWindow;
   this.windowsApi = aWindowsApi;
   this.constants = aConstants;
   this.utils = aUtils;
   this.service = aService;
   this.script = aScript;


   /**
    * Identity of the window containing regular expression help.
    * @type {integer|null}
    */
   this.helpWindowId = null;

   this.predefined = {};

   this.typesIds = {};
   this.typesIds[this.constants.CONTENTVIEW_DEFINITION_CONTAINS] = 'typeUrl';
   this.typesIds[this.constants.CONTENTVIEW_DEFINITION_REFERENCES] = 'typeContentView';
   this.typesIds[this.constants.CONTENTVIEW_DEFINITION_PREDEFINED] = 'typeList';

   // Find/create UI elements.
   root = $(aRootElement);
   this.elements = {
      noproxy: root.find('#noProxyConfigured'),
	  autodetect: root.find('#autoDetectProxy'),
	  useSystemProxy: root.find('#useSystemProxy'),
	  manualProxy: root.find('#manualProxy'),
	  allProtocols: root.find('#allProtocols'),
	  httpProxy: root.find('#httpProxy'),
	  httpPort: root.find('#httpPort'),
	  ftpProxy: root.find('#ftpProxy'),
	  ftpPort: root.find('#ftpPort'),
	  sslProxy: root.find('#sslProxy'),
	  sslPort: root.find('#sslPort'),
	  socks4: root.find('#socks4'),
	  socks5: root.find('#socks5'),
	  remoteDns: root.find('#remoteDns'),
	  socksProxy: root.find('#socksProxy'),
	  socksPort: root.find('#socksPort'),
	  bypassList: root.find('#bypassList'),
	  autoUrl: root.find('#autoUrl'),
	  autoUrlList: root.find('#autoUrlList'),
      apply: root.find('#apply'),
      cancel: root.find('#cancel'),
      allInputs: root.find('input, select, option'),
      allButtons: root.find('button')
   };

   // Initialize event handlers.
   this.elements.apply.on('click', this.apply.bind(this));
   this.elements.cancel.on('click', this.cancel.bind(this));
//   this.elements.help.on('click',
//      this.showRegularExpressionHelp.bind(this));

   this.elements.allProtocols.on('change', this.toggle.bind(this));
   // Display initial values in UI.
   aUtils.localizeTree(aRootElement, 'deja_');
   this.init();
};

DejaClickUi.ProxySettings.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.ProxySettings,

   /**
    * Initialize the UI
    * @this {!DejaClickUi.ProxySettings}
    */
   init: function () {
      try {
		 var proxyType = this.getIntPref ("network.proxy.type");
		 switch (proxyType) {
			case 0:
			   this.elements.noproxy.prop('checked', true);
			   break;
			case 1:
			   this.elements.manualProxy.prop('checked', true);
			   break;
			case 2:
			   this.elements.autoUrl.prop('checked', true);
			   break;
			case 4:
			   this.elements.autodetect.prop('checked', true);
			   break;
			case 5:
			   this.elements.useSystemProxy.prop('checked', true);
			   break;
			default:
			   this.elements.useSystemProxy.prop('checked', true);
			   break;
	     }
			   
	     var share_settings = this.getBoolPref("network.proxy.share_proxy_settings");
	     this.elements.allProtocols.prop('checked', share_settings);
			   
		 var http_url = this.getCharPref("network.proxy.http");
	     this.elements.httpProxy.val(http_url);
	     var httpPort = this.getIntPref("network.proxy.http_port");
	     this.elements.httpPort.val(httpPort);
			   
		 if (share_settings == 'true') {
		    this.elements.ftpProxy.prop('disabled', true);
			this.elements.ftpProxy.val(http_url);
			this.elements.ftpPort.prop('disabled', true);
			this.elements.ftpPort.val(httpPort);
			
			this.elements.sslProxy.val(http_url);
			this.elements.sslPort.val(httpPort);
			this.elements.sslProxy.prop('disabled', true);
			this.elements.sslPort.prop('disabled', true);
				  
			var version = this.getIntPref("network.proxy.socks_version");
			if (version == 4) {
			   this.elements.socks4.prop('checked', true);
			}
			else {
			   this.elements.socks5.prop('checked', true);
			}
		    this.elements.socks4.prop('disabled', true);
			this.elements.socks5.prop('disabled', true);
				  
			this.elements.socksProxy.val(http_url);
			this.elements.socksPort.val(httpPort);
			this.elements.socksProxy.prop('disabled', true);
			this.elements.socksPort.prop('disabled', true);				  
	     }
	     else {
				  
			this.elements.ftpProxy.val(this.getCharPref("network.proxy.ftp"));
			var ftpPort = this.getIntPref("network.proxy.ftp_port");
			this.elements.ftpPort.val(ftpPort);
			
			this.elements.sslProxy.val(this.getCharPref("network.proxy.ssl"));
			var sslPort = this.getIntPref("network.proxy.ssl_port");
			this.elements.sslPort.val(sslPort);

			var version = this.getIntPref("network.proxy.socks_version");
			if (version == 4) {
		       this.elements.socks4.prop('checked', true);
			}
			else {
			   this.elements.socks5.prop('checked', true);
			}
			this.elements.socksProxy.val(this.getCharPref("network.proxy.socks"));
			this.elements.socksPort.val(this.getIntPref("network.proxy.socks_port"));

	     }
        
        var socks_remote_dns = this.getBoolPref("network.proxy.socks_remote_dns");
        this.elements.remoteDns.prop('checked', socks_remote_dns);
	     this.elements.bypassList.val(this.getCharPref("network.proxy.no_proxies_on"));
	     var url = this.getCharPref("network.proxy.autoconfig_url");
         this.elements.autoUrlList.val(url);
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * page.
    * @this {!DejaClickUi.ProxySettings}
    */
   close: function () {
 
   },
   
  /**
    * Show or hide elements that have been enabled or disabled by
    * changing one of the checkboxes.
    * @this {DejaClickUi.ProxySettings}
    * @param {!Event} aEvent A jQuery change event on a checkbox in the section.
    */
   toggle: function () {
      try {
	     var share_settings = this.elements.allProtocols.prop('checked');
		 var http_url = this.elements.httpProxy.val();
		 var httpPort = this.elements.httpPort.val();
	     if (share_settings) {
			this.elements.ftpProxy.val(http_url);
			this.elements.ftpPort.val(httpPort);
		    this.elements.ftpProxy.prop('disabled', true);
			this.elements.ftpPort.prop('disabled', true);
			
			this.elements.sslProxy.val(http_url);
			this.elements.sslPort.val(httpPort);
			this.elements.sslProxy.prop('disabled', true);
			this.elements.sslPort.prop('disabled', true);
				  
			var version = this.getIntPref("network.proxy.socks_version");
			if (version == 4) {
			   this.elements.socks4.prop('checked', true);
			}
			else {
			   this.elements.socks5.prop('checked', true);
			}
			this.elements.socks4.prop('disabled', true);
			this.elements.socks5.prop('disabled', true);
				  
			this.elements.socksProxy.val(http_url);
			this.elements.socksPort.val(httpPort);
			this.elements.socksProxy.prop('disabled', true);
			this.elements.socksPort.prop('disabled', true);
		 }
		 else {
            this.elements.ftpProxy.val(this.getCharPref("network.proxy.ftp"));
			var ftpPort = this.getIntPref("network.proxy.ftp_port");
			this.elements.ftpPort.val(ftpPort);
		    this.elements.ftpProxy.prop('disabled', false);
			this.elements.ftpPort.prop('disabled', false);
			
			this.elements.sslProxy.val(this.getCharPref("network.proxy.ssl"));
			var sslPort = this.getIntPref("network.proxy.ssl_port");
			this.elements.sslPort.val(sslPort);
			this.elements.sslProxy.prop('disabled', false);
			this.elements.sslPort.prop('disabled', false);
			
			var version = this.getIntPref("network.proxy.socks_version");
			if (version == 4) {
			   this.elements.socks4.prop('checked', true);
			}
			else {
			   this.elements.socks5.prop('checked', true);
			}
			this.elements.socks4.prop('disabled', false);
			this.elements.socks5.prop('disabled', false);

			this.elements.socksProxy.val(this.getCharPref("network.proxy.socks"));
			this.elements.socksPort.val(this.getIntPref("network.proxy.socks_port"));
			this.elements.socksProxy.prop('disabled', false);
			this.elements.socksPort.prop('disabled', false);
			
		 }
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   
   /**
    * Apply the changes to this component. Close the window.
    * @this {!DejaClickUi.ProxySettings}
    * @param {!Event} aEvent A jQuery click event on the apply button.
    */
   apply: function (aEvent) {

      try {
          this.setAttribute('useproxysettings', 'true');
		  if (this.elements.noproxy.prop('checked'))
		     this.setIntPref ("network.proxy.type", 0);
		  else if (this.elements.manualProxy.prop('checked'))
		     this.setIntPref ("network.proxy.type", 1);
		 else if (this.elements.autoUrl.prop('checked'))
			 this.setIntPref ("network.proxy.type", 2);
		 else if (this.elements.autodetect.prop('checked'))
			 this.setIntPref ("network.proxy.type", 4);
		 else if (this.elements.useSystemProxy.prop('checked'))
			 this.setIntPref ("network.proxy.type", 5);
		 
		 if (this.elements.allProtocols.prop('checked')) {
			 this.setBoolPref ("network.proxy.share_proxy_settings", 'true');
		 } 
		 
		 this.setCharPref("network.proxy.http", this.elements.httpProxy.val());
         this.setIntPref("network.proxy.http_port", this.elements.httpPort.val());
		 this.setCharPref("network.proxy.ftp", this.elements.ftpProxy.val());
         this.setIntPref("network.proxy.ftp_port", this.elements.ftpPort.val());
		 this.setCharPref("network.proxy.ssl", this.elements.sslProxy.val());
         this.setIntPref("network.proxy.ssl_port", this.elements.sslPort.val());
		 
		 if (this.elements.socks4.prop('checked')) {
          this.setIntPref("network.proxy.socks_version", 4);
		 }
		 else {
		    this.setIntPref("network.proxy.socks_version", 5);
		 }
		 this.setCharPref("network.proxy.socks", this.elements.socksProxy.val());
		 this.setIntPref("network.proxy.socks_port", this.elements.socksPort.val());		 
         if (this.elements.remoteDns.prop('checked')) {
            this.setBoolPref("network.proxy.socks_remote_dns", true);
         }
         else {
            this.setBoolPref("network.proxy.socks_remote_dns", false);
         }
		 this.setCharPref("network.proxy.no_proxies_on", this.elements.bypassList.val());
		
		 this.setCharPref("network.proxy.autoconfig_url", this.elements.autoUrlList.val());
         DejaClick.service.__modal.close();
         this.close();
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, discarding any changes.
    * @this {!DejaClickUi.ProxySettings}
    * @param {!Event} aEvent A jQuery click event on the cancel button.
    */
   cancel: function (aEvent) {
      var win;
      try {
         // Close the object first to ensure that the help window is closed.
         DejaClick.service.__modal.close();
         this.close();
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Set or change the preference being edited.
    * @this {!DejaClickUi.ProxySettings}
    * @param {string} aName The name of the parameter to set.
    * @param {string} aValue The value of the parameter.
    */
   setAttribute: function (aName, aValue) {
	  return this.script.domTreeAddAttribute(this.script.getScriptElement(), aName, aValue);
   },
   
   /**
    * Get the preference being edited.
    * @this {!DejaClickUi.ProxySettings}
    * @param {string} aName The name of the parameter to retrieve.
    * @return {?string} The value of the parameter, or null if no such
    *    parameter exists.
    */
   getIntPref: function (aName) {
	  return parseInt(this.script.domTreeGetPreference(this.script.getScriptElement(), aName, "intprefs"));
   },

   /**
    * Set or change the preference being edited.
    * @this {!DejaClickUi.ProxySettings}
    * @param {string} aName The name of the parameter to set.
    * @param {string} aValue The value of the parameter.
    */
   setIntPref: function (aName, aValue) {

      if (!this.script.domTreeHasPreference(this.script.getScriptElement(), aName, "intprefs"))
      {
         if (!aValue ||  aValue.length == 0) {
            return;
         }
         this.script.domTreeAddPreference(this.script.getScriptElement(), aName, aValue, "intprefs");
      }
      else {
         this.script.domTreeSetPreference(this.script.getScriptElement(), aName, aValue, "intprefs");
      }
	  
   },


   /**
    * Get the preference being edited.
    * @this {!DejaClickUi.ProxySettings}
    * @param {string} aName The name of the parameter to retrieve.
    * @return {?string} The value of the parameter, or null if no such
    *    parameter exists.
    */
   getBoolPref: function (aName) {
	  return this.script.domTreeGetPreference(this.script.getScriptElement(), aName, "boolprefs");
   },

   /**
    * Set or change the preference being edited.
    * @this {!DejaClickUi.ProxySettings}
    * @param {string} aName The name of the parameter to set.
    * @param {string} aValue The value of the parameter.
    */
   setBoolPref: function (aName, aValue) {
      if (!aValue ||  aValue.length == 0) {
         return;
      }
      
      if (!this.script.domTreeHasPreference(this.script.getScriptElement(), aName, "boolprefs"))
      {
         this.script.domTreeAddPreference(this.script.getScriptElement(), aName, aValue, "boolprefs");
      }
      else {
         this.script.domTreeSetPreference(this.script.getScriptElement(), aName, aValue, "boolprefs");
      }
   },


   /**
    * Get the preference being edited.
    * @this {!DejaClickUi.ProxySettings}
    * @param {string} aName The name of the parameter to retrieve.
    * @return {?string} The value of the parameter, or null if no such
    *    parameter exists.
    */
   getCharPref: function (aName) {
	  return this.script.domTreeGetPreference(this.script.getScriptElement(), aName, "charprefs");
   },

   /**
    * Set or change the preference being edited.
    * @this {!DejaClickUi.ProxySettings}
    * @param {string} aName The name of the parameter to set.
    * @param {string} aValue The value of the parameter.
    */
   setCharPref: function (aName, aValue) {

      if (!this.script.domTreeHasPreference(this.script.getScriptElement(), aName, "charprefs"))
      {
         if (!aValue ||  aValue.length == 0) {
            return;
         }         
         this.script.domTreeAddPreference(this.script.getScriptElement(), aName, aValue, "charprefs");
      }
      else {
         this.script.domTreeSetPreference(this.script.getScriptElement(), aName, aValue, "charprefs");
      }
   },

   /* This conflicts with dialog positioning. @todo: investigate and use */
/*   adjustWindowHeight: function () {
      var newHeight;
      try {
         newHeight = document.body.clientHeight
            + parseInt($('body').css('margin-top'))
            + parseInt($('body').css('margin-bottom'));

         window.resizeTo(preferredWidth, newHeight);
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },*/

};
$(function () {
   /**
    * Clean up when the page is unloaded.
    * @param {!Event} aEvent jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('proxySettings')) {
            DejaClickUi.proxySettings.close();
            delete DejaClickUi.proxySettings;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the JsValidation instance once the
    * page is loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.proxySettings = new DejaClickUi.ProxySettings(
            DejaClick.service.__modal.arguments,
            document.documentElement,
            window,
            chrome.windows,
            DejaClick.constants,
            DejaClick.utils,
            DejaClick.service,
            DejaClick.script,
            DejaClick.EventRegistration);
         $(window).on('unload', unload);
         DejaClick.service.__modal.resizeModal($('body').outerHeight() + 50);

      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   try {
      if (DejaClick.service.__modal) {
         initialize();
      } else {
         window.onDialogArguments = initialize;
      }
   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }
});