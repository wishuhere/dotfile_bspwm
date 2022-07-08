/* -*- Mode: Javascript; tab-width: 3; indent-tabs-mode: nil; c-basic-offset: 3 -*- */
/*
* DejaClick by SmartBear Software.
* Copyright (C) 2006-2022 SmartBear Software.  All Rights Reserved.
*
* The contents of this file are subject to the End User License Agreement.
* Software distributed under the License is distributed on an "AS IS" basis,
* WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
* for the specific language governing rights and limitations under the
* License.
*/

'use strict';

/*global DejaClick,navigator*/


/**
 * Container of utilities.
 * @implements {DejaClick.Closable}
 * @constructor
 * @param {boolean} aServer True if this is the server extension.
 * @param {!chrome.RuntimeApi} aRuntime chrome.runtime object.
 * @param {!chrome.I18nApi} aI18n chrome.i18n object.
 * @param {!chrome.CookiesApi} aCookies The chrome.cookies object.
 * @param {!Window} aGlobalObj The background page's window object.
 * @param {Console} aConsole The extension's console object.
 * @param {Storage} aStorage The extension's localStorage object.
 * @param {function(new:DejaClick.ObserverService,
 *       !DejaClick.Logger,
 *       !chrome.RuntimeApi,
 *       !Window)} AObserverService Constructor for observer service.
 * @param {function(new:DejaClick.DialogWindow,
 *       string,
 *       *,
 *       function(!DejaClick.DialogWindow),
 *       Function)} ADialogWindow Constructor for a dialog window.
 * @param {(DejaClick.WebSocket|DejaClickFileSystem)=} aConfigService API for accessing files.
 */
DejaClick.Utils = function (aServer, aRuntime, aI18n, aCookies,
      aGlobalObj, aConsole, aStorage, AObserverService, ADialogWindow,
      aConfigService) {
   var bool, string, NumType, IntType, strArray, record, constants;

   /** @type {!DejaClick.Logger} */
   this.logger = new DejaClick.Logger(aConsole);
   
   this.autoUploadUrl = null;
   this.getMessage = aI18n.getMessage;

   this.versionInfo = new DejaClick.VersionInfo(aServer, aRuntime, aGlobalObj);
   this.observerService = new AObserverService(this.logger,
      aRuntime, aGlobalObj);
   if (aStorage === null) {
      throw new Error('Local storage not available');
   }

   this.configService = aConfigService;

   bool = new DejaClick.PreferenceService.BooleanType();
   string = new DejaClick.PreferenceService.StringType();
   NumType = DejaClick.PreferenceService.NumberType;
   IntType = DejaClick.PreferenceService.IntegerType;
   strArray = new DejaClick.PreferenceService.ArrayType(string);
   record = new DejaClick.PreferenceService.RecordType();
   constants = DejaClick.constants;
   this.prefService = new DejaClick.PreferenceService(this.observerService,
         aStorage);

   this.prefService.
      // User prompts and alerts
      define('DC_OPTID_WARNEMBEDEDOBJ', true, bool, 'warnembededobj').
      define('DC_OPTID_WARNEMBEDEDOBJPROMPT', true, bool, 'warnembededobjprompt').
      define('DC_OPTID_WARNFIRSTEVENT', true, bool, 'warnfirstevent').
      define('DC_OPTID_WARNFIRSTEVENTPROMPT', true, bool, 'warnfirsteventprompt').
      define('DC_OPTID_WARNURLMISMATCH', true, bool, 'warnurlmismatch').
      define('DC_OPTID_WARNURLMISMATCHPROMPT', true, bool, 'warnurlmismatchprompt').
      define('DC_OPTID_WARNRSPTIMEOUT', true, bool, 'warnrsptimeout').
      define('DC_OPTID_WARNRSPTIMEOUTPROMPT', true, bool, 'warnrsptimeoutprompt').
      define('DC_OPTID_WARNEVTTIMEOUT', true, bool, 'warnevttimeout').
      define('DC_OPTID_WARNEVTTIMEOUTPROMPT', true, bool, 'warnevttimeoutprompt').
      define('DC_OPTID_WARNLOCTIMEOUT', true, bool, 'warnloctimeout').
      define('DC_OPTID_WARNLOCTIMEOUTPROMPT', true, bool, 'warnloctimeoutprompt').
      define('DC_OPTID_WARNNETTIMEOUT', true, bool, 'warnnettimeout').
      define('DC_OPTID_WARNNETTIMEOUTPROMPT', true, bool, 'warnnettimeoutprompt').
      define('DC_OPTID_WARNMUTBTIMEOUT', true, bool, 'warnmutbtimeout').
      define('DC_OPTID_WARNMUTBTIMEOUTPROMPT', true, bool, 'warnmutbtimeoutprompt').
      define('DC_OPTID_WARNMUTETIMEOUT', true, bool, 'warnmutetimeout').
      define('DC_OPTID_WARNMUTETIMEOUTPROMPT', true, bool, 'warnmutetimeoutprompt').
      define('DC_OPTID_WARNNAVTIMEOUT', true, bool, 'warnnavtimeout').
      define('DC_OPTID_WARNNAVTIMEOUTPROMPT', true, bool, 'warnnavtimeoutprompt').
      define('DC_OPTID_WARNKEYWORDMODE', true, bool, 'warnkeywordmode').
      define('DC_OPTID_WARNKEYWORDMODEPROMPT', true, bool, 'warnkeywordmodeprompt').

      define('DC_OPTID_WARNFILEINPUTPROMPT', true, bool, 'warnfileinputprompt').
      define('DC_OPTID_WARNSCREENRESIZEPROMPT', true, bool, 'warnscreenresizeprompt').
      define('DC_OPTID_WARNSCREENRESIZE', true, bool, 'warnscreenresize').

      // Replay options
      define('DC_OPTID_REPLAYADVISORREPAIR', true, bool, 'replayadvisorrepair').
      define('DC_OPTID_USETHINKTIMEHINTS', false, bool, 'usethinktimehints').
      define('DC_OPTID_USELOCATIONHINTS', true, bool, 'uselocationhints').
      define('DC_OPTID_USEMUTATIONHINTS', false, bool, 'usemutationhints').
      define('DC_OPTID_USENETWORKHINTS', true, bool, 'usenetworkhints').
      define('DC_OPTID_NETWORKWARNING', false, bool, 'networkwarning').
      define('DC_OPTID_USEPAUSETIMEOUT', false, bool, 'usepausetimeout').
      define('DC_OPTID_USEMINMATCHSCORE', false, bool, 'useminmatchscore').
      define('DC_OPTID_USEMINMATCHSCORE2', true, bool, 'useminmatchscore2').
      define('DC_OPTID_USEMINMUTATIONS', false, bool, 'useminmutations').
      define('DC_OPTID_USEMAXSKIPPED', false, bool, 'usemaxskipped').
      define('DC_OPTID_USEKEYSTROKES', false, bool, 'usekeystrokes').
      define('DC_OPTID_SIMULATEENTER', false, bool, 'simulateenter'). //UXM-12024 - New property of change events that allows to enable/disable simulating enter key after change replay.
      define('DC_OPTID_USEEVENTSPEED', true, bool, 'useeventspeed').
      define('DC_OPTID_USEPROXYSETTINGS', false, bool, 'useproxysettings').
      define('DC_OPTID_FULLPAGEOBJECTS', false, bool, 'fullpageobjects').
      define('DC_OPTID_AUTOCLOSEREQUESTS', true, bool, 'autocloserequests').
      define('DC_OPTID_OPTIMIZEDMATCH', true, bool, 'optimizedmatch').
      define('DC_OPTID_USEMATCHTYPES', 'all', string, 'usematchtypes').
      define('DC_OPTID_MINMATCHSCORE', 20, new IntType(1, 100), 'minmatchscore').
      define('DC_OPTID_MINMATCHSCORE2', 60, new IntType(1, 100), 'minmatchscore2').
      define('DC_OPTID_MINMUTATIONS', 0, new IntType(constants.MINMUTATIONS_MIN, constants.MINMUTATIONS_MAX), 'minmutations').
      define('DC_OPTID_IGNORENAMEDATTR', false, bool, 'ignorenamedattr').
      define('DC_OPTID_MAXSKIPPED', 3, new IntType(constants.MAXSKIPPEDEVENTS_MIN, constants.MAXSKIPPEDEVENTS_MAX), 'maxskipped').
      define('DC_OPTID_RESPONSETIMEOUT', 4000, new NumType(constants.RESPONSETIMEOUT_MIN, constants.RESPONSETIMEOUT_MAX), 'responsetimeout').
      define('DC_OPTID_READYTIMEOUT', 50, new NumType(constants.READYTIMEOUT_MIN, constants.READYTIMEOUT_MAX), 'readytimeout').
      define('DC_OPTID_EVENTTIMEOUT', 30000, new NumType(constants.EVENTTIMEOUT_MIN, constants.EVENTTIMEOUT_MAX), 'eventtimeout').
      define('DC_OPTID_IGNOREOCSPURLS', true, bool, 'ignoreocspurls').
      define('DC_OPTID_NETWORKTIMEOUT', 12000, new NumType(constants.NETWORKTIMEOUT_MIN, constants.NETWORKTIMEOUT_MAX), 'networktimeout').
      define('DC_OPTID_NETPRUNETIMEOUT', 12000, new NumType(constants.NETPRUNETIMEOUT_MIN, constants.NETPRUNETIMEOUT_MAX), 'netprunetimeout').
      define('DC_OPTID_LOCATIONTIMEOUT', 12000, new NumType(constants.LOCATIONTIMEOUT_MIN, constants.LOCATIONTIMEOUT_MAX), 'locationtimeout').
      define('DC_OPTID_MUTATIONBEGINTIMEOUT', 12000, new NumType(constants.MUTATIONBEGINTIMEOUT_MIN, constants.MUTATIONBEGINTIMEOUT_MAX), 'mutationbegintimeout').
      define('DC_OPTID_MUTATIONENDTIMEOUT', 12000, new NumType(constants.MUTATIONENDTIMEOUT_MIN, constants.MUTATIONENDTIMEOUT_MAX), 'mutationendtimeout').
      define('DC_OPTID_DOCKEYWORDVALTIMEOUT', 5000, new NumType(constants.KEYWORDVALTIMEOUT_MIN, constants.KEYWORDVALTIMEOUT_MAX), 'dockeywordvaltimeout').
      define('DC_OPTID_SEARCHKEYWORDVALTIMEOUT', 10000, new NumType(constants.KEYWORDVALTIMEOUT_MIN, constants.KEYWORDVALTIMEOUT_MAX), 'searchkeywordvaltimeout').
      define('DC_OPTID_DOCJAVASCRIPTVALTIMEOUT', 5000, new NumType(constants.JAVASCRIPTVALTIMEOUT_MIN, constants.JAVASCRIPTVALTIMEOUT_MAX), 'docjavascriptvaltimeout').
      define('DC_OPTID_SEARCHJAVASCRIPTVALTIMEOUT', 10000, new NumType(constants.JAVASCRIPTVALTIMEOUT_MIN, constants.JAVASCRIPTVALTIMEOUT_MAX), 'searchjavascriptvaltimeout').
      define('DC_OPTID_NAVIGATIONTIMEOUT', 12000, new NumType(constants.NAVIGATIONTIMEOUT_MIN, constants.NAVIGATIONTIMEOUT_MAX), 'navigationtimeout').
      define('DC_OPTID_EVENTDELAY', 100, new NumType(constants.EVENTDELAY_MIN, constants.EVENTDELAY_MAX), 'eventdelay').
      define('DC_OPTID_EVENTSPEED', 1, new NumType(constants.EVENTSPEED_MIN, constants.EVENTSPEED_MAX), 'eventspeed').
      define('DC_OPTID_MUTATIONDELAY', 100, new NumType(constants.MUTATIONDELAY_MIN, constants.MUTATIONDELAY_MAX), 'mutationdelay').
      define('DC_OPTID_DISPATCHDELAY', 30, new NumType(constants.DISPATCHDELAY_MIN, constants.DISPATCHDELAY_MAX), 'dispatchdelay').
      define('DC_OPTID_AUTOREPLAYPAUSE', constants.AUTOPAUSE_NONE, new IntType(constants.AUTOPAUSE_MIN, constants.AUTOPAUSE_MAX), 'autoreplaypause').
      define('DC_OPTID_MAXSCRIPTRUN', 10, new IntType(constants.MAXSCRIPTRUN_MIN, constants.MAXSCRIPTRUN_MAX), 'maxscriptrun').
      define('DC_OPTID_OPTIONSELECT', 'position', string, 'optionselect').
      define('DC_OPTID_CAPTURELEVEL', 'off', string, 'capturelevel').
      define('DC_OPTID_CAPTUREGROUP', 'img', string, 'capturegroup').
      define('DC_OPTID_CAPTUREMTYPE', 'image/png', string, 'capturemtype').
      define('DC_OPTID_CAPTURESTYLE', '50', string, 'capturestyle').
      define('DC_OPTID_CAPTUREPATH', '', string, 'capturepath').

      define('DC_OPTID_HIDEFLASH', false, bool, 'hideflash').
      define('DC_OPTID_FIXFLASHWMODE', false, bool, 'fixflashwmode').
      define('DC_OPTID_WMODETIMEOUT', 0, new NumType(constants.WMODETIMEOUT_MIN, constants.WMODETIMEOUT_MAX), 'wmodetimeout').
      define('DC_OPTID_WMODEOVERRIDE', 'opaque', string, 'wmodeoverride').
      
      define('DC_OPTID_SCRIPTREPLAY', '', string, 'scriptreplay').
     
      // Record options
      define('DC_OPTID_USENEWVISITOR', false, bool, 'usenewvisitor').
      define('DC_OPTID_HIDECOOKIES', true, bool, 'hidecookies').
      define('DC_OPTID_CLEARWEBCACHE', true, bool, 'clearwebcache').
      define('DC_OPTID_CLEARPASSWORDS', false, bool, 'clearpasswords').
      define('DC_OPTID_CLEARFORMDATA', false, bool, 'clearformdata').
      define('DC_OPTID_CLEARCERTIFICATES', false, bool, 'clearcertificates').
      define('DC_OPTID_CLEARLOCALSTORAGE', false, bool, 'clearlocalstorage').
      define('DC_OPTID_CLEARFILESYSTEMS', false, bool, 'clearfilesystems').
      define('DC_OPTID_CLEARAPPCACHE', false, bool, 'clearappcache').
      define('DC_OPTID_CLEARINDEXEDDB', false, bool, 'clearindexeddb').
      define('DC_OPTID_CLEARWEBSQL', false, bool, 'clearwebsql').
      define('DC_OPTID_CLEARPLUGINDATA', false, bool, 'clearplugindata').
      define('DC_OPTID_DISABLECOOKIES', false, bool, 'disablecookies').
      define('DC_OPTID_DISABLEPOPUPS', false, bool, 'disablepopups').
      define('DC_OPTID_JS_DIALOG_INJECTION_ENABLED', true, bool, 'jsdialogdetection').
      define('DC_OPTID_RECWINTABOPEN', true, bool, 'recwintabopen').
      define('DC_OPTID_RECWINTABCLOSE', true, bool, 'recwintabclose').
      define('DC_OPTID_RECBROWSEHISTORY', true, bool, 'recbrowsehistory').
      define('DC_OPTID_BLOCKTABSWITCH', true, bool, 'blocktabswitch').
      define('DC_OPTID_APPENDMODE', constants.DC_RECORDMODE_DEFAULT, new IntType(constants.DC_RECORDMODE_DEFAULT, constants.DC_RECORDMODE_INSERT), 'appendmode').
      define('DC_OPTID_USEPASSWORDS', false, bool, 'usepasswords').
      define('DC_OPTID_USEFORMFILL', false, bool, 'useformfill').
      // wipe the DNS cache
      define('DC_OPTID_CLEARDNSCACHE', true, bool, 'cleardnscache').

      // Subscript trigger options
      define('DC_OPTID_TRIGGER_MAX_REPLAYS', 1, new IntType(1,50), 'maxreplays').
      define('DC_OPTID_TRIGGER_SKIP_AFTER_MAX_REPLAYS', true, bool, 'skipifmaxreplays').

      // Miscellaneous options
      define('DC_OPTID_EXPANDLEVEL', constants.TREELEVEL_EVENT, new IntType(constants.TREELEVEL_SCRIPT, constants.TREELEVEL_EVENT), 'expandlevel').
      define('DC_OPTID_LOCATIONID', '0', string, 'locationid').
      define('DC_OPTID_SUSPENDREPLAY', false, bool, 'suspendreplay').
      define('DC_OPTID_NOTIFYCOMPLETE', true, bool, 'notifycomplete').
      define('DC_OPTID_RECORDFOCUSEVENTS', false, bool, 'recordfocusevents').
      define('DC_OPTID_RUNINTERACTIVE', true, bool, 'runinteractive').
      define('DC_OPTID_FAILONTIMEOUT', true, bool, 'failontimeout').
      define('DC_OPTID_RESTENDPOINT', 'https://www.alertsite.com/cgi-bin/restapi/index.cgi', string, 'restendpoint').
      define('DC_OPTID_RESTENDPOINTS', ['https://www.alertsite.com/cgi-bin/restapi/index.cgi','https://www.qatest.aws.alertsite.com/cgi-bin/restapi/index.cgi','https://www.development.aws.alertsite.com/cgi-bin/restapi/index.cgi'], strArray, 'restendpoints').
      define('DC_OPTID_SCRIPTSHARE_RESTENDPOINT', 'https://scripts.dejaclick.com/restapi/index.cgi', string, 'scriptshareendpoint').
      define('DC_OPTID_INSTANTTEST_RESTENDPOINT', 'https://tod.alertsite.com/restapi/index.cgi', string, 'instanttestendpoint').
      define('DC_OPTID_RESTAPITIMEOUT', 60000, new NumType(0, 3600000), 'restapitimeout').
      define('DC_OPTID_ENCRYPTLOCAL', false, bool, 'encryptlocal').
      define('DC_OPTID_ENCRYPTREMOTE', false, bool, 'encryptremote').
      define('DC_OPTID_ENCRYPTINPUT', false, bool, 'encryptinput').
      define('DC_OPTID_WRITEIDTAGS', false, bool, 'writeidtags').
      define('DC_OPTID_WRITEACTTREES', true, bool, 'writeacttrees').
      define('DC_OPTID_WRITENAVTREES', false, bool, 'writenavtrees').
      define('DC_OPTID_WRITERESTREES', false, bool, 'writerestrees').
      define('DC_OPTID_WRITEURIENCODE', true, bool, 'writeuriencode').
      define('DC_OPTID_WRITEPRETTYPRINT', false, bool, 'writeprettyprint').
      define('DC_OPTID_HIGHLIGHTACTIVE', true, bool, 'highlightactive').
      define('DC_OPTID_SCROLLTOACTIVE', true, bool, 'scrolltoactive').
      define('DC_OPTID_ACTIVATEDSTYLE', 'outline: 5px solid #2FAB28; outline-offset: 3px; -moz-outline-radius: 1%; background-color: #F9FEF9 !important;', string, 'activatedstyle').
      define('DC_OPTID_HIGHLIGHTSTYLE', 'outline: 3px solid #44C437; outline-offset: 1px; !important', string, 'highlightstyle').
      define('DC_OPTID_ONSUCCESSSTYLE', 'outline: 2px solid #BEEBBA; outline-offset: 1px; background-color: #F9FEF9 !important;', string, 'onsuccessstyle').
      define('DC_OPTID_ONWARNINGSTYLE', 'outline: 3px solid #FFCD3C; outline-offset: 1px; background-color: #FFFEE3 !important;', string, 'onwarningstyle').
      define('DC_OPTID_ONFAILURESTYLE', 'outline: 3px solid #CC0000; outline-offset: 1px; background-color: #F6E9EC !important;', string, 'onfailurestyle').
      define('DC_OPTID_INSTANTTESTOPTS', {}, record, 'instanttestopts').
      define('DC_OPTID_SKIPTESTOPTSDLG', false, bool, 'skiptestoptsdlg').
      define('DC_OPTID_SAMLENABLED', false, bool, 'samlenabled').
      define('DC_OPTID_SAMLURL', '', string, 'samlurl').
      define('DC_OPTID_SIMULATEMOBILE', '', string, 'simulatemobile').
      // automatically power-off after replaying (special use option)
      define('DC_OPTID_AUTOPOWEROFF', false, bool, 'autopoweroff').
      define('DC_OPTID_MAXTHINKTIME', 45000, new IntType(0, 3600000), 'maxthinktime').
      // num DOM node fixups allowed before invoking delay feature (0=disabled)
      define('DC_OPTID_FIXUPTHRESHOLD', 0, new IntType(0, 100), 'fixupthreshold').
      // GUI option to enable display of animated or static state icons
      define('DC_OPTID_ANIMATEICONS', false, bool, 'animateicons').
      // cleanup all secondary tabs and windows upon replay completion or failure
      define('DC_OPTID_AUTOCLEANUP', true, bool, 'autocleanup').
      // quit application upon replay completion or failure
      define('DC_OPTID_AUTOSHUTDOWN', false, bool, 'autoshutdown').
      // application quit delay used when closing dialog windows in ms
      define('DC_OPTID_QUITAPPDELAY', 1000, new IntType(constants.QUITAPPDELAY_MIN, constants.QUITAPPDELAY_MAX), 'quitappdelay').
      // auto hide/show deja toolbar during record/replay
      define('DC_OPTID_SHOWTOOLBAR', false, bool, 'showtoolbar').
      define('DC_OPTID_SHOWSIDEBAR', false, bool, 'showsidebar').
      define('DC_OPTID_SHOWSTATUSBAR', false, bool, 'showstatusbar').
      define('DC_OPTID_SIDEBARTYPE', 'results', string, 'sidebartype').
      define('DC_OPTID_USERAGENTAPPEND', '', string, 'useragentappend').

      // Note options
      define('DC_OPTID_REPLAYNOTES', true, bool, 'replaynotes').

      // Logging options
      define('DC_OPTID_LOGMESSAGE', 'fail', string, 'logmessage').
      define('DC_OPTID_LOGDEBUG', 'off', string, 'logdebug').
      // message log file URI (if empty string, uses a default filepath)
      define('DC_OPTID_LOGFILEURI', '', string, '').
      // dump log messages to console/stdout
      define('DC_OPTID_LOGUSEDUMP', false, bool, 'logusedump').
      // write log messages to file
      define('DC_OPTID_LOGUSEFILE', true, bool, 'logusefile').

      // Property options
      define('DC_OPTID_DISPLAYLEVEL', constants.DISPLAYLEVEL_BASIC, new IntType(constants.DISPLAYLEVEL_MIN, constants.DISPLAYLEVEL_MAX), 'displaylevel').

      // Server-specific options
      define('DC_OPTID_LISTENPORT', 11000, new IntType(constants.PORTNUMBER_MIN, constants.PORTNUMBER_MAX), 'listenport').
      // suspend replay delay (used when suspendreplay pref is enabled) in ms
      define('DC_OPTID_SUSPENDDELAY', 1000, new IntType(constants.SUSPENDDELAY_MIN, constants.SUSPENDDELAY_MAX), 'suspenddelay').
      define('DC_OPTID_WATCHDPORTOFS', 100, new IntType(constants.PORTNUMBER_MIN, constants.PORTNUMBER_MAX), 'watchdportofs').
      define('DC_OPTID_WATCHDLOOPBACK', true, bool, 'watchdloopback').
      define('DC_OPTID_WATCHDINTERVAL', 3000, new IntType(constants.WATCHDINTERVAL_MIN, constants.WATCHDINTERVAL_MAX), 'watchdinterval').
      define('DC_OPTID_WATCHDWARNING', true, bool, 'watchdwarning').
      define('DC_OPTID_MAGICCOOKIE', '', string, 'magiccookie').
      define('DC_OPTID_USERAGENT', '', string, 'useragent').

      // Unimplemented options
      // replay option : capture user experience information during replay
      define('DC_OPTID_REPLAYUE', false, bool, 'replayue').
      // delay in ms between successive user experience captures
      define('DC_OPTID_UECAPTUREFREQ', 100, new IntType(0, 99999), 'uecapturefreq').
      // backend replay option : Percent of Dynamic Area in the page
      define('DC_OPTID_UEPERCENTDYNAMICAREA', 30, new IntType(0, 100), 'uepercentdynamicarea').
      // number of pixels changes to classify the region as dynamic
      define('DC_OPTID_UEPIXELCHANGES', 4, new IntType(0, 100), 'uepixelchanges').
      // backend replay option : Min Number of Pixel Changes
      define('DC_OPTID_UEMINPIXELS', 50, new IntType(0, 100), 'ueminpixels').
      // +/-ve # of percentage points by which the match threshold of every image validation will be adjusted
      define('DC_OPTID_IMGVALMATCHADJUST', -2, new IntType(-100, 100), 'imgvalmatchadjust').
      // disable 'first-time' warning prompts // XXX ToDo
      define('DC_OPTID_DISABLEWARNINGS', false, bool, 'disablewarnings').
      define('DC_OPTID_USEMINPROBABILITY', false, bool, 'useminprobability').
      define('DC_OPTID_MINPROBABILITY', 20, new IntType(0, 100), 'minprobability').

      // Other options
      define('DC_OPTID_DIAGNOSTICMODE', false, bool, 'diagnosticmode').
      define('DC_OPTID_LICENSEDVERSION', '', string, 'licensedversion').
      defineFromFile('DC_OPTID_MOBILEDATA', 'dejaMobileData', record, 'mobiledata').
      define('DC_OPTID_CV_PREDEFINEDLIST', {}, record, 'cvpredefined').
      define('DC_OPTID_LOW_SENSITIVITY', true, bool, 'lowsensitivity').

      //UXM-10729 - Limit of mutations (by default -1 == unlimited)
      define('DC_OPTID_MUTATIONSLIMIT', -1, new IntType(-1, 999999), 'mutationslimit').

      //UXM-11286 - Force script replay success flag to true (by default false )
      define('DC_OPTID_MARKSCRIPTASREPLAYED', false, bool, 'forcescriptreplaysuccessflag');

   // Apply settings from configuration file.
   if (this.configService) {
      this.m_osName="unknown OS";
      if (navigator.appVersion.indexOf("Windows NT 6")!=-1) {
         this.m_osName="Windows7";
      }
      else if (navigator.appVersion.indexOf("Windows NT 5")!=-1) {
         this.m_osName="WindowsXP";
      }
      else if (navigator.appVersion.indexOf("Mac")!=-1) {
         this.m_osName="MacOS";
      }
      else if (navigator.appVersion.indexOf("X11")!=-1) {
         this.m_osName="UNIX";
      }
      else if (navigator.appVersion.indexOf("Linux")!=-1) {
         this.m_osName="Linux";
      }
      this.loadConfigFile(this.configService, this.prefService);
   }

   this.logger.setMessageOptions(String(this.prefService.getPrefOption('DC_OPTID_LOGMESSAGE')));
   this.logger.setDebugOptions(String(this.prefService.getPrefOption('DC_OPTID_LOGDEBUG')));

   if (this.configService &&
      typeof this.configService.resetLogger === 'function' ) {
      this.configService.resetLogger(this.logger);
   }

   this.resetSystemPrefs = this.prefService.clear.bind(this.prefService, {
      'DC_OPTID_LICENSEDVERSION': true,
      'DC_OPTID_RESTENDPOINTS': true,
      'DC_OPTID_DIAGNOSTICMODE': true
   });

   this.promptService = new DejaClick.PromptService(aI18n.getMessage,
      aGlobalObj, this.logger, this.prefService, ADialogWindow);

   this.restApi = new DejaClick.RestApi(this.logger, this.prefService,
      this.observerService, this.versionInfo, aI18n.getMessage, aGlobalObj);

   this.cookieManager = new DejaClick.CookieManager(this.logger,
      aCookies, aGlobalObj, aStorage);

   this.verboseMode = false;
   this.userExperienceMode = false;
};

/**
 * Shut down all components of the Utils object.
 * @this {!DejaClick.Utils}
 */
DejaClick.Utils.prototype.close = function () {
   this.cookieManager.close();
   this.restApi.close();
   this.promptService.close();
   this.prefService.close();
   this.observerService.close();
};

/**
 * Load settings from the configuration file.
 * @this {!DejaClick.Utils}
 * @param {!(DejaClick.WebSocket|DejaClickFileSystem)} aConfigService API for
 *    accessing files.
 * @param {!DejaClick.PreferenceService} aPrefService API for accessing
 *    preference settings.
 */
DejaClick.Utils.prototype.loadConfigFile = function (aConfigService, aPrefService) {
   var fileSystem = aConfigService, configName, configFile, config;

   if (typeof fileSystem.startAsync === 'function' && fileSystem.m_config) {
      aPrefService.apply(fileSystem.m_config);
      return;
   }
   /** config file must be preloaded before the initialization
   configName = fileSystem.getEnvironmentVariable(
      'DEJACLICK_CHROME_CONFIG_FILE');

   if (configName == null) {
      configFile = fileSystem.currentDirectory().getChild('config.json');
   } else if (fileSystem.isAbsolutePath(configName)) {
      configFile = fileSystem.getFile(configName);
   } else {
      configFile = fileSystem.currentDirectory().getChild(configName);
   }
   configFile.readAsUtf8().then(function (contents) {
      config = JSON.parse(configFile.readAsUtf8());
   });
   */
   if (!(config instanceof Object)) {
      config = {};
   }

   aPrefService.apply(config);
};

(function () {
   var /** @type {!Array.<string>} */ ATTRIBUTES =
         [ 'title', 'value', 'placeholder' ],
      ELEMENT_NODE = 1,
      TEXT_NODE = 3;

   /**
    * Replace message names in a DOM tree with the localized text.
    * All text nodes whose value begins with the specified prefix will
    * have their values replaced by the localized text corresponding
    * to the message named by the text node value.
    * The values of title and value attributes will also be updated.
    *
    * @this {!DejaClick.Utils}
    * @param {!Node} aNode The root node of the DOM tree to be processed.
    * @param {string} aPrefix The prefix of all message names to be localized.
    */
   DejaClick.Utils.prototype.localizeTree = function (aNode, aPrefix) {
      var value, elt, index, attr, child;

      if (aNode.nodeType === TEXT_NODE) {
         value = aNode.nodeValue.trim();
         if (value.slice(0, aPrefix.length) === aPrefix) {
            aNode.nodeValue = this.getMessage(value);
         }

      } else if (aNode.nodeType === ELEMENT_NODE) {
         elt = /** @type {!Element} */ (aNode);
         index = ATTRIBUTES.length;
         while (index !== 0) {
            --index;
            attr = ATTRIBUTES[index];
            if (elt.hasAttribute(attr)) {
               value = elt.getAttribute(attr).trim();
               if (value.slice(0, aPrefix.length) === aPrefix) {
                  elt.setAttribute(attr, this.getMessage(value));
               }
            }
         }

         for (child = elt.firstChild;
               child !== null;
               child = child.nextSibling) {
            this.localizeTree(child, aPrefix);
         }
      }
   };
}());
