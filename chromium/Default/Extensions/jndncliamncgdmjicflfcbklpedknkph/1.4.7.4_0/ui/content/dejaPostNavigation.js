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

/*
 * Interstitial page used to load AlertSite account pages via HTTP
 * POST requests. The opener must call one of loadDashboard, loadConsole,
 * or loadReports.
 */

/*global DejaClickUi,DejaClick,document*/

'use strict';

/**
 * Build the collection of parameters (and their values) used by all
 * of AlertSite account pages.
 * @param {!DejaClick.RestApi} aRestApi The RestApi object that holds
 *    the current session information.
 * @return {!Object.<string,string>} Map from parameter name to value.
 */
DejaClickUi.getCommonParams = function (aRestApi) {
   var customerId = aRestApi.getCustomerId();
   if (/^C\d+$/i.test(customerId)) {
      customerId = String(Number(customerId.substring(1)) - 10000);
   }
   return {
      OBJID: '57',
      page: '3',
      session: aRestApi.getSessionId(),
      seluser: aRestApi.getLogin(),
      realuser: aRestApi.getRealLogin(),
      obj_cust: customerId,
      obj_parent: '57',
      time_adjdst_region: '',
      chguser: '',
      selcust: '',
      child_login: ''
   };
};

/**
 * Update the text shown in the title and body of the loading page.
 * @param {string} aMessageName The name of the message to be displayed
 *    while the page is loaded.
 */
DejaClickUi.updateUi = function (aMessageName) {
   var text, eltList, index;

   text = DejaClick.utils.getMessage(aMessageName);
   eltList = document.getElementsByTagName('title');
   index = eltList.length;
   while (index !== 0) {
      --index;
      eltList[index].textContent = text;
   }
   eltList = document.getElementsByTagName('body');
   index = eltList.length;
   while (index !== 0) {
      --index;
      eltList[index].textContent = text;
   }
};

/**
 * Submit a HTTP POST request to navigate to a new page.
 * @param {string} aUrl The URL with which the RestApi is connected.
 *    The POST will be made to that host with a different path.
 * @param {!Object.<string,string>} aData Collection of parameter names
 *    and values to include in the body of the POST.
 */
DejaClickUi.postMonitorUri = function (aUrl, aData) {
   var parts, realUrl, form, key, input;

   parts = /^(\w+:\/*)?([\w+\.]+)(?::\d+)?\/([^\?#]*)(?:\?[^#]+)?(?:#.+)?/.
      exec(aUrl);
   if (parts == null) {
      throw new Error('Error parsing REST URL: ' + aUrl);
   }

   realUrl = (parts[1] || 'http://') + parts[2];
   if (parts[3].indexOf('cgi') > 0) {
      realUrl += '/' + parts[3].substring(0, parts[3].indexOf('/cgi'));
   }
   realUrl += '/cgi-bin/goalert';
   form = document.createElement('form');
   form.setAttribute('method', 'POST');
   form.setAttribute('action', realUrl);
   for (key in aData) {
      if (parts.hasOwnProperty.call(aData, key)) {
         input = document.createElement('input');
         input.setAttribute('type', 'hidden');
         input.setAttribute('name', key);
         input.setAttribute('value', aData[key]);
         form.appendChild(input);
      }
   }
   // According to the HTML standards, if the form is not 
   // associated to the browsing context(document), 
   // the form submission will be aborted. This stopped
   // working from Chrome 56 onwards.
   document.body.appendChild(form);
   form.submit();
};

/**
 * Load the AlertSite Dashboard for the current effective user.
 */
DejaClickUi.loadDashboard = function () {
   var restApi, params;

   DejaClickUi.updateUi('deja_post_dashboard');
   restApi = DejaClick.utils.restApi;
   params = DejaClickUi.getCommonParams(restApi);
   params['Dashboard.x'] = '10';
   params['Dashboard.y'] = '10';
   DejaClickUi.postMonitorUri(restApi.getEndpoint(), params);
};

/**
 * Load the AlertSite Status page for the current effective user.
 */
DejaClickUi.loadConsole = function () {
   var restApi, params;

   DejaClickUi.updateUi('deja_post_status');
   restApi = DejaClick.utils.restApi;
   params = DejaClickUi.getCommonParams(restApi);
   params['MyNewConsole.x'] = '10';
   params['MyNewConsole.y'] = '10';
   params.console_tab = 'txns';
   DejaClickUi.postMonitorUri(restApi.getEndpoint(), params);
};

/**
 * Load the AlertSite Reports page for the current effective user.
 */
DejaClickUi.loadReports = function () {
   var restApi, params;

   DejaClickUi.updateUi('deja_post_reports');
   restApi = DejaClick.utils.restApi;
   params = DejaClickUi.getCommonParams(restApi);
   params['MyReportBuilder.x'] = '10';
   params['MyReportBuilder.y'] = '10';
   DejaClickUi.postMonitorUri(restApi.getEndpoint(), params);
};
