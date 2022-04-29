/* -*- Mode: Javascript; tab-width: 3; indent-tabs-mode: nil; c-basic-offset: 3 -*- */
/*
* DejaClick for Chrome by SmartBear Software.
* Copyright (C) 2006-2013 SmartBear Software.  All Rights Reserved.
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

   manifest = /** @type {!{name: string,version: string}} */
      (runtimeApi.getManifest());
   appVersion = globalObj.navigator.appVersion;
   appVersionMatch = appVersion.match(/Chrome\/([\d.]+)/i);
   platVersionMatch = appVersion.match(/AppleWebKit\/([\d.]+)/i);
   this.extension = {
      name: manifest.name,
      version: manifest.version,
      buildid: String(DejaClick.buildId),
      server: server
   };
   Object.freeze(this.extension);
   this.application = {
      name: 'Chrome',
      version: ((appVersionMatch == null) ? '' : appVersionMatch[1]),
      buildid: ''
   };
   Object.freeze(this.application);
   this.platform = {
      name: 'AppleWebKit',
      version: ((platVersionMatch == null) ? '' : platVersionMatch[1]),
      buildid: ''
   };
   Object.freeze(this.platform);
   Object.freeze(this);
};
