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

/*jslint browser: true, devel: true */
/*global DejaClick, chrome */

'use strict';


/**
 * Container of content scripts.
 * @constructor
 * @param {!Window} aGlobalObj The content page's window object.
 */
DejaClick.ContentScript = function( aGlobalObj ) {

   // references to common services
   this.constants = DejaClick.constants;
   this.logger = new DejaClick.Logger( aGlobalObj.console );
   this.observerService = new DejaClick.PageObserverService( this.logger, chrome.runtime );
};


try {
   var DejaClickCs = DejaClick.cs = new DejaClick.ContentScript( window );
} catch( e ) {
   if (DejaClickCs && DejaClickCs.logger && DejaClickCs.logger.logException) {
      DejaClickCs.logger.logException( e, "DejaClick.ContentScript" );
   } else {
      console.error("Exception in DejaClick.ContentScript(): " + e);
   }
}
