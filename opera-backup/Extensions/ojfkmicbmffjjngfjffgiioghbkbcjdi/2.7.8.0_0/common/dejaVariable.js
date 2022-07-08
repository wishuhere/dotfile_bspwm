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

/*global DejaClick,chrome,XPathResult,HTMLDocument*/
(function() {

/**
 * @constructor
 */
DejaClick.Variable = function (aLogger, aReplayCount, aReplayLocation)
{
   this.init(aLogger, aReplayCount, aReplayLocation);
};

var constants = DejaClick.constants;

DejaClick.Variable.prototype = {
   
   init : function (aLogger, aReplayCount, aReplayLocation) {
      this.m_logger = aLogger;
      this.m_replayCount = aReplayCount;
      this.m_replayLocation = aReplayLocation;
   },

   
   /**
    * Get the concatenated readable description (across tokens) for the script variable
    * @this {!DejaClick.Variable}
    * @param {string} strAVariable The string containing all tokens delimited by |\t|
    * @return {null|string} The readable string.
    */
   getVariableDescription : function( strAVariable ) {

      try {
         if (!strAVariable || !strAVariable.length) {
            return null;
         }

         var strDescription = null;
         var arrayTokens = strAVariable.split(constants.DC_SEPARATOR_TOKENS);

         for (var i = 0; i < arrayTokens.length; i++) {
            if (arrayTokens[i].length) {
               var strTokenDesc = this.getTokenDescription(arrayTokens[i]);

               if (strTokenDesc) {
                  if (strDescription) {
                     strDescription += " + " + strTokenDesc;
                  }
                  else {
                     strDescription = strTokenDesc;
                  }
               }
            }
         }

         return strDescription;
      }
      catch (service_e) {}

      return null;
   },
   
   /**
    * Get the readable description of a single token.
    * @this {!DejaClick.Variable}
    * @param {string} aToken The string containing the token description
    * @return {null|string} The description string.
    */
   getTokenDescription: function (aToken) {
      try {
         if (!aToken || !aToken.length)
            return null;

         var arrayTokenValues = aToken.split(constants.DC_SEPARATOR_TOKENPARAMS),
            strDescription = null,
            strParams = null,
            iMin, iMax, iNum;

         switch (arrayTokenValues[0]) {

            // Token format->  1:location:text
            case constants.DC_TOKENTYPE_STATICTEXT:
               if (arrayTokenValues.length == 3)
                  strDescription = '"' + arrayTokenValues[2] + '"';
               break;

            // Token format->  2:location:minlen:maxlen
            case constants.DC_TOKENTYPE_RANDOMTEXT:
               if (arrayTokenValues.length == 4) {
                  iMin = Number(arrayTokenValues[2]);
                  iMax = Number(arrayTokenValues[3]);

                  if (iMin != 0 && iMax != 0)
                     strParams = chrome.i18n.getMessage("dcService_StrRTRange", [iMin, iMax]);
                  else if (iMin != 0)
                     strParams = chrome.i18n.getMessage("dcService_StrRTMin", [iMin]);
                  else if (iMax != 0)
                     strParams = chrome.i18n.getMessage("dcService_StrRTMax", [iMax]);

                  strDescription = chrome.i18n.getMessage("dcService_StrRandomText");
                  if (strParams)
                     strDescription += " (" + strParams + ")";
               }
               break;

            // Token format->  3:location:min:max
            case constants.DC_TOKENTYPE_RANDOMNUMBER:
               if (arrayTokenValues.length == 4) {
                  iMin = Number(arrayTokenValues[2]);
                  iMax = Number(arrayTokenValues[3]);
                  strDescription = chrome.i18n.getMessage("dcService_StrRandomNumber");

                  if (iMin != 0 && iMax != 0)
                     strDescription += " " + chrome.i18n.getMessage("dcService_StrRNRange", [iMin, iMax]);
                  else if (iMin != 0)
                     strDescription += " > " + iMin;
                  else if (iMax != 0)
                     strDescription += " < " + iMax;
               }
               break;

            // Token format->  4:location:start:inc
            case constants.DC_TOKENTYPE_AUTOINC:
               if (arrayTokenValues.length == 4) {
                  strDescription = chrome.i18n.getMessage("dcService_StrAutoInc");

                  iNum = Number(arrayTokenValues[2]);
                  if (iNum)
                     strDescription += " " + chrome.i18n.getMessage("dcService_StrAutoIncStart") + " " + iNum;

                  iNum = Number(arrayTokenValues[3]);
                  if (iNum)
                     strDescription += " " + chrome.i18n.getMessage("dcService_StrAutoIncStep") + " " + iNum;
               }
               break;

            // Token format->  5:location:days:hours:min:secs:format
            //      Index      0     1      2    3    4    5    6
            case constants.DC_TOKENTYPE_DATETIME:
               if (arrayTokenValues.length == 6 || arrayTokenValues.length == 7) {
                  strDescription = chrome.i18n.getMessage("dcService_StrNow");

                  iNum = Number(arrayTokenValues[2]);
                  if (iNum)
                     strDescription += (iNum > 0 ? " +" : " ") + iNum + " " + chrome.i18n.getMessage("dcService_StrDays");

                  iNum = Number(arrayTokenValues[3]);
                  if (iNum)
                     strDescription += (iNum > 0 ? " +" : " ") + iNum + " " + chrome.i18n.getMessage("dcService_StrHours");

                  iNum = Number(arrayTokenValues[4]);
                  if (iNum)
                     strDescription += (iNum > 0 ? " +" : " ") + iNum + " " + chrome.i18n.getMessage("dcService_StrMinutes");

                  iNum = Number(arrayTokenValues[5]);
                  if (iNum)
                     strDescription += (iNum > 0 ? " +" : " ") + iNum  + " " + chrome.i18n.getMessage("dcService_StrSeconds");
               }
               break;

            // Token format->  6:location:datsetname:startrow:startcol:rowinc:colinc
            //    Index:       0    1         2         3        4        5     6
            case constants.DC_TOKENTYPE_DATASET:
               if (arrayTokenValues.length == 7) {
                  strDescription = chrome.i18n.getMessage("dcService_DataSet", [arrayTokenValues[2], arrayTokenValues[3], arrayTokenValues[4]]);
                  var iIncRow = Number(arrayTokenValues[5]);
                  var iIncCol = Number(arrayTokenValues[6]);
                  if (iIncRow || iIncCol)
                     strDescription += " " + chrome.i18n.getMessage("dcService_DSInc", [iIncRow, iIncCol]);
               }
               break;

            // Token format->  6:location:
            case constants.DC_TOKENTYPE_LOCATION:
               strDescription = chrome.i18n.getMessage("dcService_ReplayLoc");
               break;

            // Token format->  8:location:name
            case constants.DC_TOKENTYPE_JAVASCRIPT:
               if (arrayTokenValues.length == 3)
                  strDescription = chrome.i18n.getMessage("dcService_JavaScript", [arrayTokenValues[2]]);
               break;

            default:
               break;
         }

         return strDescription;
      }
      catch ( service_e ) {
      }
      return null;
   },

   /**
    * Compute a single token.
    * @this {!DejaClick.Variable}
    * @param {string} strAToken The string containing the token
    * @return {null|string} The value of the token.
    */
   computeToken : function ( strAToken, aPromiseResolve, aTabId )
   {
         // formatDate
         // Author: Matt Kruse <matt@mattkruse.com>
         // WWW: http://www.mattkruse.com/
         function formatDate(date, format)
         {
            function LZ(x) {return(x<0||x>9?"":"0")+x;}

            // ---------------------------- Alertsite adjustments -------------------------------
            var MONTH_NAMES = chrome.i18n.getMessage("dcService_Months").split(',');
            var DAY_NAMES = chrome.i18n.getMessage("dcService_Days").split(',');
            // ----------------------------------------------------------------------------------

            format=format+"";
            var result="";
            var i_format=0;
            var c="";
            var token="";
            var y=date.getYear()+"";
            var M=date.getMonth()+1;
            var d=date.getDate();
            var E=date.getDay();
            var H=date.getHours();
            var m=date.getMinutes();
            var s=date.getSeconds();
            // Convert real date parts into formatted versions
            var value = {};
            if (y.length < 4) {y=""+(y-0+1900);}
            value.y=""+y;
            value.yyyy=y;
            value.yy=y.substring(2,4);
            value.M=M;
            value.MM=LZ(M);
            value.MMM=MONTH_NAMES[M-1];
            value.NNN=MONTH_NAMES[M+11];
            value.d=d;
            value.dd=LZ(d);
            value.E=DAY_NAMES[E+7];
            value.EE=DAY_NAMES[E];
            value.H=H;
            value.HH=LZ(H);
            if (H===0){value.h=12;}
            else if (H>12){value.h=H-12;}
            else {value.h=H;}
            value.hh=LZ(value.h);
            if (H>11){value.K=H-12;} else {value.K=H;}
            value.k=H+1;
            value.KK=LZ(value.K);
            value.kk=LZ(value.k);
            if (H > 11) { value.a="PM"; }
            else { value.a="AM"; }
            value.m=m;
            value.mm=LZ(m);
            value.s=s;
            value.ss=LZ(s);
            while (i_format < format.length) {
               c=format.charAt(i_format);
               token="";
               while ((format.charAt(i_format)==c) && (i_format < format.length)) {
                  token += format.charAt(i_format++);
               }
               if (value[token] != null) { result=result + value[token]; }
               else { result=result + token; }
            }
            return result;
         }

         function calcFieldSeqNr(strAStart, strAInc, nAMax) {
            var nInc = this.m_replayCount * Number(strAInc) - 1;
            var nValue = (Number(strAStart) + (nInc < 0 ? 0 : nInc)) % nAMax;
            return nValue ? nValue : nAMax;
         }

         function randomNumber(nAMin, nAMax) {
            var iRange = nAMax - nAMin + 1;
            return ((Math.floor(Math.random() * Math.pow(10,("" + iRange).length)) % iRange) + parseInt(nAMin, 10));
         }

         try {
            
         if (this.m_logger.debugprocess ) {
            this.m_logger.logDebug("computeToken - [TabId="+aTabId+"] Obtaining value for token: "+strAToken);
         }
         
         // Check if we got a valid token for our location
         if (!strAToken || !strAToken.length) {
            if (this.m_logger.debugprocess ) {
               this.m_logger.logDebug("computeToken - [TabId="+aTabId+"] Result 'null' for token ["+strAToken+"]");
            }
            return null;
         }
         var arrayTokenParams = strAToken.split(constants.DC_SEPARATOR_TOKENPARAMS);
         if (arrayTokenParams[1].length && arrayTokenParams[1] != this.m_replayLocation) {
            this.m_logger.logInfo("computeToken - [TabId="+aTabId+"] Returning result 'null' for Script Variable token because the current location ID ["+this.m_replayLocation+"] doesn't match the configured one ["+arrayTokenParams[1]+"] [Token="+strAToken+"]");
            return null;
         }

         var strText = null;
         switch (arrayTokenParams[0]) {

            // Token format->  1:location:text
            case constants.DC_TOKENTYPE_STATICTEXT:
               if (arrayTokenParams.length == 3) {
                  strText = arrayTokenParams[2];
               }
               if (this.m_logger.debugprocess ) {
                  this.m_logger.logDebug("computeToken - [TabId="+aTabId+"] Static text: "+strText);
               }
               break;

            // Token format->  4:location:minlen:maxlen
            case constants.DC_TOKENTYPE_RANDOMTEXT:
               if (arrayTokenParams.length == 4) {
                  if (arrayTokenParams[2] == "0") {
                     arrayTokenParams[2] = "1";
                  }
                  if (arrayTokenParams[3] == "0") {
                     arrayTokenParams[3] = "50";
                  }

                  var nTextLen = arrayTokenParams[2] != arrayTokenParams[3] ? randomNumber(Number(arrayTokenParams[2]), Number(arrayTokenParams[3])) : arrayTokenParams[2];
                  var strValidChars = constants.DC_VALIDRANDOMCHARS;
                  strText = "";
                  for (var i = 0; i < nTextLen; i++) {
                     strText += strValidChars.charAt(randomNumber(0, strValidChars.length));
                  }
               }
               if (this.m_logger.debugprocess ) {
                  this.m_logger.logDebug("computeToken - [TabId="+aTabId+"] Random text: "+strText);
               }
               break;

            // Token format->  3:location:min:max
            case constants.DC_TOKENTYPE_RANDOMNUMBER:
               if (arrayTokenParams.length == 4) {
                  if (arrayTokenParams[3] == "0") {
                     arrayTokenParams[3] = "1000";
                  }

                  strText = "" + randomNumber(Number(arrayTokenParams[2]), Number(arrayTokenParams[3]));
               }
               if (this.m_logger.debugprocess ) {
                  this.m_logger.logDebug("computeToken - [TabId="+aTabId+"] Random number: "+strText);
               }
               break;

            // Token format->  5:location:start:inc
            case constants.DC_TOKENTYPE_AUTOINC:
               if (arrayTokenParams.length == 4) {
                  if (arrayTokenParams[2] == "0") {
                     arrayTokenParams[2] = "1";
                  }
                  if (arrayTokenParams[3] == "0") {
                     arrayTokenParams[3] = "1";
                  }

                  strText = "" + this.m_replayCount == 1 ? arrayTokenParams[2] : ((this.m_replayCount - 1) * Number(arrayTokenParams[3]) + Number(arrayTokenParams[2]) - 1);
               }
               if (this.m_logger.debugprocess ) {
                  this.m_logger.logDebug("computeToken - [TabId="+aTabId+"] Autoinc number: "+strText);
               }
               break;

            // Token format->  2:location:days:hours:min:secs:format
            case constants.DC_TOKENTYPE_DATETIME:
               if (arrayTokenParams.length == 6 || arrayTokenParams.length == 7) {
                  var dateResult = new Date();
                  if (isFinite(Number(arrayTokenParams[2]))) {
                     dateResult.setDate(dateResult.getDate() + Number(arrayTokenParams[2]));
                  }
                  if (isFinite(Number(arrayTokenParams[3]))) {
                     dateResult.setHours(dateResult.getHours() + Number(arrayTokenParams[3]));
                  }
                  if (isFinite(Number(arrayTokenParams[4]))) {
                     dateResult.setMinutes(dateResult.getMinutes() + Number(arrayTokenParams[4]));
                  }
                  if (isFinite(Number(arrayTokenParams[5]))) {
                     dateResult.setSeconds(dateResult.getSeconds() + Number(arrayTokenParams[5]));
                  }

                  strText = arrayTokenParams.length == 7 ?
                     formatDate(dateResult, arrayTokenParams[6]) :
                     dateResult.toDateString();
               }
               if (this.m_logger.debugprocess ) {
                  this.m_logger.logDebug("computeToken - [TabId="+aTabId+"] Datetime value: "+strText);
               }
               break;

            // Token format->  6:location:datsetname:startrow:startcol:rowinc:colinc
            //    Index:       0    1         2         3        4        5     6
            case constants.DC_TOKENTYPE_DATASET:
               // TODO Compute value from dataset.
               break;

            // Token format->  6:location:
            case constants.DC_TOKENTYPE_LOCATION:
               strText = "" + this.m_replayLocation;
               if (this.m_logger.debugprocess ) {
                  this.m_logger.logDebug("computeToken - [TabId="+aTabId+"] Location value: "+strText);
               }
               break;

            // Token format->  8:location:name
            case constants.DC_TOKENTYPE_JAVASCRIPT:
               if (aPromiseResolve !== undefined) {
                  if (this.m_logger.debugprocess ) {
                     this.m_logger.logDebug("computeToken - [TabId="+aTabId+"] Obtaining token of JavaScript code execution through promise! ");
                  }
                  if (arrayTokenParams.length == 3) {
                     var executionDetails,
                        completeExecuteJavascript;

                     executionDetails = {
                        code: arrayTokenParams[2],
                        allFrames: false
                     };

                     /**
                      * Resolve promise and pass a calculated value using callback
                      * @param {Array} aResult
                      */
                     completeExecuteJavascript = function (aResult) {
                        var i,
                           l;

                        if (aResult && aResult.length) {  
                           if ( aResult.length == 1 ) {
                              aPromiseResolve(aResult[0]);
                           } else {
                              strText = '';

                              for (i = 0, l = aResult.length; i < l; i++) {
                                 strText += aResult[i];
                              }
                              aPromiseResolve(strText);
                           }
                        } else {
                           aPromiseResolve(aResult);
                        }
                     };

                     if (aTabId !== null && aTabId !== undefined) {
                        chrome.tabs.executeScript(
                           aTabId,
                           executionDetails,
                           completeExecuteJavascript
                        );
                     } else {
                        chrome.tabs.query({
                           active: true
                        }, function(arrATabs) {
                              var tabId = (arrATabs && arrATabs.length > 0 && arrATabs[0].id);

                              if (tabId !== undefined && tabId !== null) {
                                 chrome.tabs.executeScript(
                                    tabId,
                                    executionDetails,
                                    completeExecuteJavascript
                                 );
                              } else {
                                 aPromiseResolve(strText);
                              }
                        });
                     }
                  } else {
                     if (this.m_logger.debugprocess ) {
                        this.m_logger.logDebug("computeToken - [TabId="+aTabId+"] LOCAL JavaScript promise result [Nothing done]: "+strText );
                     }
                     aPromiseResolve(strText);
                  }
               } else {
                  if (arrayTokenParams.length == 3) {
                     strText = eval(arrayTokenParams[2]);
                  }
                  if (this.m_logger.debugprocess ) {
                     this.m_logger.logDebug("computeToken - [TabId="+aTabId+"] LOCAL JavaScript code execution result: "+strText);
                  }
               }
               break;

            default:
               break;
         }

         if (arrayTokenParams[0] !== constants.DC_TOKENTYPE_JAVASCRIPT &&
               aPromiseResolve !== undefined) {

            aPromiseResolve(strText);
         }

         return strText;
      }
      catch ( service_e ) {
         this.m_logger.logWarning("dejaVariable - computeToken: " + service_e);
      }
      return null;
   },

   /**
    * Compute the value of the script variable. Asynchronous version.
    * @this {!DejaClick.Variable}
    * @param {!Array} aTokens Variable tokens
    * @param {!Function} aCallbackFunc The function to be called on compute.
    * @param {!number|null} aTabId The active tab id
    * @return {undefined} Computed value will be delivered via callback.
    */
   computeScriptVariableForPreview : function(aTokens, aCallbackFunc, aTabId) {
      /**
       * Create a promise instance to calculate particular token
       * @param {string} token
       * @returns {Promise}
       */
      function addPromise(token) {
         return new Promise(function(resolve) {
            this.computeToken(token, resolve, aTabId);
         }.bind(this));
      }

      var computedVariable = null,
         tokenPromises = [],
         i,
         l;

      try {
         for (i = 0, l = aTokens.length; i < l; i++) {
            tokenPromises.push(addPromise.call(this, aTokens[i]));
         }

         Promise.all(tokenPromises).then(function(values) {
            var i,
               l;

            if (values && values.length) {
               computedVariable = '';

               for (i = 0, l = values.length; i < l; i++) {
                  computedVariable += values[i];
               }

               aCallbackFunc(computedVariable);
            } else {
               aCallbackFunc(computedVariable);
            }
         });
      } catch (service_e) {
         this.m_logger.logWarning("computeScriptVariableForPreview: " + service_e);
      }
   },

   /**
    * Compute the value of the script variable asynchronously, just in case
    * we have to run JavaScript code in another tab.
    * 
    * @param {*} strAVarName 
    * @param {*} strAVarValue 
    * @param {*} aCallbackFunc Currently used from handleKeyboardEvent or processScriptVariableResult (both at dejaService.js)
    */
   computeScriptVariableAsync : function ( strAVarName, strAVarValue, aCallbackFunc )
   {
      /**
       * Create a promise instance to calculate particular token
       * @param {string} token
       * @returns {Promise}
       */
      function addPromise(token) {
         return new Promise(function(resolve) {
            this.computeToken(token, resolve);
         }.bind(this));
      }

      var computedVariable = null,
         tokenPromises = [],
         i,
         l;

      try {
         if (!strAVarName || !strAVarName.length) {
            aCallbackFunc(null, new Error("Empty script variable name"));
            return;
         }
         
         if (!strAVarValue || !strAVarValue.length) {
            aCallbackFunc(null, new Error("Empty script variable value"));
            return;
         }

         if (this.m_logger.debugprocess) {
            var strVarDesc = this.getVariableDescription(strAVarValue);
            if (strVarDesc) {
               this.m_logger.logDebug("variable substitution: using " + strAVarName + " (" + strVarDesc + ")");
            }
         }

         // Calculate the (text) value of this script var
         var arrayTokens = strAVarValue.split(constants.DC_SEPARATOR_TOKENS);
         for (var i = 0; i < arrayTokens.length; i++) {
            tokenPromises.push(addPromise.call(this, arrayTokens[i]));
         }

         Promise.all(tokenPromises).then(function(values) {
            var i,
               l;

            if (values && values.length) {
               if ( values.length == 1 ) {
                  if ( values[0] == null ) 
                     aCallbackFunc(values[0], new Error("retrieveEventParamValue: invalid value of script variable '" + strAVarName + "'"));
                  else
                     aCallbackFunc(values[0], null);
               } else {
                  computedVariable = '';

                  for (i = 0, l = values.length; i < l; i++) {
                     computedVariable += values[i];
                  }
                  aCallbackFunc(computedVariable, null);
               }      
            } else {
               aCallbackFunc(computedVariable, new Error("retrieveEventParamValue: invalid value of script variable '" + strAVarName + "'"));
            }
         });
      } catch (service_e) {
         this.m_logger.logWarning("computeScriptVariableAsync: " + service_e);
      }
   },


   /**
    * Compute the value of the script variable.
    * @this {!DejaClick.Variable}
    * @param {string} strAVarName The name of the variable <varname>
    * @param {string} strAVarValue The token value <vartext>
    * @return {null|string} The computed value of the script variable.
    */
   computeScriptVariable : function ( strAVarName, strAVarValue )
   {

      try {

         if (!strAVarName || !strAVarName.length) {
            throw new Error("Empty script variable name");
         }
         
         if (!strAVarValue || !strAVarValue.length) {
            throw new Error("Empty script variable value");
         }

         var strVarText = null;  // the computed text of the var
         var nStickyValue = -1;

         if (this.m_logger.debugprocess) {
            var strVarDesc = this.getVariableDescription(strAVarValue);
            if (strVarDesc) {
               this.m_logger.logDebug("variable substitution: using " + strAVarName + " (" + strVarDesc + ")");
            }
         }

         // Calculate the (text) value of this script var
         var arrayTokens = strAVarValue.split(constants.DC_SEPARATOR_TOKENS);
         for (var i = 0; i < arrayTokens.length; i++) {
            if (arrayTokens[i].length) {
               var strTokenText = this.computeToken(arrayTokens[i]);
               if (strTokenText) {
                  if (strVarText) {
                     strVarText += strTokenText;
                  } else {
                     strVarText = strTokenText;
                  }
               }
            }
         }

         if (!strVarText) {
            throw new Error("Empty script variable (" + strAVarName + ") value");
         }

         if (this.m_logger.debugprocess) {
            this.m_logger.logDebug("variable substitution: " + strAVarName + "'s calculated value is '" + strVarText + "'");
         }

         return strVarText;
      }
      catch ( service_e ) {
         this.m_logger.logWarning("dejaVariable - computeScriptVariable: " + service_e);
      }
      return null;
   }

};

//////////////////////////////////////////////////
// end private scope
}());
//////////////////////////////////////////////////
