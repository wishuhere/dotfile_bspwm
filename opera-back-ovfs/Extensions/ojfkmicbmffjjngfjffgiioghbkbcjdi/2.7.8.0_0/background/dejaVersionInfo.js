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

/*global DejaClick*/


/**
 * Retrieve version information for the browser and its extension.
 * @constructor
 * @param {boolean} server
 * @param {!chrome.RuntimeApi} runtimeApi
 * @param {!Window} globalObj
 */
DejaClick.VersionInfo = function (server, runtimeApi, globalObj) {
   var manifest, appVersion, appVersionMatch, platVersionMatch;

   /**************************
    * DejaClick version
    */
   manifest = /** @type {!{name: string,version: string}} */
      (runtimeApi.getManifest());
   this.extension = {
      name: manifest.name,
      version: manifest.version,
      buildid: String(DejaClick.buildId),
      server: server
   };
   Object.freeze(this.extension);

   /************************
    * Browser version
    */
   var nAgt = globalObj.navigator.userAgent;
   if ( typeof browser !== "undefined" ) {
     /* browser.runtime.getBrowserInfo().then(
         function (info) {
            this.application = {
               name: info.name,
               version: info.version,
               buildid: info.buildID
            };
            Object.freeze(this.application);
         }
      );
*/
      var verOffset = nAgt.indexOf('Firefox');
      this.application = {
         name: 'Firefox',
         version: nAgt.substring(verOffset + 8),
         buildid: ''
      };
   
   } else {
      appVersion = globalObj.navigator.appVersion;
      appVersionMatch = appVersion.match(/Chrome\/([\d.]+)/i);
      
      this.application = {
         name: 'Chrome',
         version: ((appVersionMatch == null) ? '' : appVersionMatch[1]),
         buildid: ''
      };
      
   }
   Object.freeze(this.application);
   


   /*************************
    * OS version
    * Copied from https://stackoverflow.com/questions/9514179/how-to-find-the-operating-system-version-using-javascript
    * 
    */
   var unknown = '-';
   // system
   var os = unknown;
   var clientStrings = [
       {s:'Windows 10', r:/(Windows 10.0|Windows NT 10.0)/},
       {s:'Windows 8.1', r:/(Windows 8.1|Windows NT 6.3)/},
       {s:'Windows 8', r:/(Windows 8|Windows NT 6.2)/},
       {s:'Windows 7', r:/(Windows 7|Windows NT 6.1)/},
       {s:'Windows Vista', r:/Windows NT 6.0/},
       {s:'Windows Server 2003', r:/Windows NT 5.2/},
       {s:'Windows XP', r:/(Windows NT 5.1|Windows XP)/},
       {s:'Windows 2000', r:/(Windows NT 5.0|Windows 2000)/},
       {s:'Windows ME', r:/(Win 9x 4.90|Windows ME)/},
       {s:'Windows 98', r:/(Windows 98|Win98)/},
       {s:'Windows 95', r:/(Windows 95|Win95|Windows_95)/},
       {s:'Windows NT 4.0', r:/(Windows NT 4.0|WinNT4.0|WinNT|Windows NT)/},
       {s:'Windows CE', r:/Windows CE/},
       {s:'Windows 3.11', r:/Win16/},
       {s:'Android', r:/Android/},
       {s:'Open BSD', r:/OpenBSD/},
       {s:'Sun OS', r:/SunOS/},
       {s:'Chrome OS', r:/CrOS/},
       {s:'Linux', r:/(Linux|X11(?!.*CrOS))/},
       {s:'iOS', r:/(iPhone|iPad|iPod)/},
       {s:'Mac OS X', r:/Mac OS X/},
       {s:'Mac OS', r:/(MacPPC|MacIntel|Mac_PowerPC|Macintosh)/},
       {s:'QNX', r:/QNX/},
       {s:'UNIX', r:/UNIX/},
       {s:'BeOS', r:/BeOS/},
       {s:'OS/2', r:/OS\/2/},
       {s:'Search Bot', r:/(nuhk|Googlebot|Yammybot|Openbot|Slurp|MSNBot|Ask Jeeves\/Teoma|ia_archiver)/}
   ];
   for (var id in clientStrings) {
       var cs = clientStrings[id];
       if (cs.r.test(nAgt)) {
           os = cs.s;
           break;
       }
   }

   var osVersion = unknown;
   if (/Windows/.test(os)) {
       osVersion = /Windows (.*)/.exec(os)[1];
       os = 'Windows';
   }
   switch (os) {
       case 'Mac OS X':
           osVersion = /Mac OS X ([\.\_\d]+)/.exec(nAgt)[1];
           break;

       case 'Android':
           osVersion = /Android ([\.\_\d]+)/.exec(nAgt)[1];
           break;

       case 'iOS':
           osVersion = /OS (\d+)_(\d+)_?(\d+)?/.exec(nVer);
           osVersion = osVersion[1] + '.' + osVersion[2] + '.' + (osVersion[3] | 0);
           break;
   }

   this.platform = {
      name: os,
      version: osVersion,
      buildid: ''
   };
   Object.freeze(this.platform);
   
   Object.freeze(this);
};
