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

/*jslint browser: true, curly: false */
/*global DejaClick, DejaClickCs, chrome, djCS, Node */

'use strict';

(function() {


// constants
var VALIDATIONTYPE_KEYWORD = 1;

var NONTEXT_TARGETS = {
   "HTML": true,
   "BODY": true,
   "FORM": true,
   "FRAMESET": true,
   "SCRIPT": true,
   "IMG": true
};

var AUTOSUGGEST_LENGTH = 50;

// keyword source selection markers
var DC_MARK_SELECTION_START = 'dcKeywordSelectionStart';
var DC_MARK_SELECTION_END   = 'dcKeywordSelectionEnd';

// various and sundry
var DC_NS_XHTML             = 'http://www.w3.org/1999/xhtml';


/**
 * Class to encapsulate the functionality of DejaClick validations.
 * @constructor
 * @param {!Object.<string,*>} aConstants The global set of constants.
 * @param {!DejaClick.Logger} aLogger The logging service.
 * @param {!DejaClick.PageObserverService} aObserverService The observer notification service.
 * @param {function(new:DejaClick.EventRegistration)} AEventRegistration
 *    The event registration constructor.
 */
DejaClickCs.Validation = function( aConstants, aLogger, aObserverService, AEventRegistration ) {

   // references to common services
   this.constants = aConstants;
   this.logger = aLogger;
   this.observerService = aObserverService;
   this.EventRegistration = AEventRegistration;

   // event registration
   this.events = new this.EventRegistration().
      addDejaListener(djCS.observerService, 'dejaclick:validationmode',
         this.setValidationType, this).
      addDejaListener(djCS.observerService, 'dejaclick:validationmode',
         this.activateKeywordFinder, this).
      addDomListener(window, "load", false, this.init, this).
      addDomListener(window, "unload", false, this.done, this);
};

DejaClickCs.Validation.prototype = {

   myname: "DejaClickCs.Validation",
   elems : {},
   state : {},

   /**
    * Initialize references to external objects.
    * @this {!DejaClickCs.Validation}
    * @param {!Event} evt The DOM event object.
    */
   init: function(evt) {
   },

   /**
    * Release references to external objects.
    * @this {!DejaClickCs.Validation}
    * @param {!Event} evt The DOM event object.
    */
   done: function(evt) {
      try {
         this.events.close();
         return;

      } catch( e ) {
         this.logger.logException( e, this.myname+".done" );
      }
   },

   /**
    * Activate/deactivate the keyword finder.
    * Called in response to the 'dejaclick:validationmode' notification.
    * @this {!DejaClickCs.Validation}
    * @param {!{enabled: boolean, type: integer}} aData The new validation mode setting.
    */
   activateKeywordFinder: function(aData) {
      try {
         if (aData.enabled && aData.type === 'keyword') {
            this.events_autosuggest = new this.EventRegistration().
               addDomListener( window, 'mouseover', true, this.suggestKeywords, this );
         } else {
            if (this.events_autosuggest) {
               this.events_autosuggest.close();
            }
         }

         return;

      } catch( e ) {
         this.logger.logException( e, this.myname+".activateKeywordFinder" );
      }
   },

   /**
    * Extract keyword suggestions from the moused over text.
    * @this {!DejaClickCs.Validation}
    * @param {!Event} evt The DOM event object.
    */
   suggestKeywords: function(evt) {
      try {
         var suggestedText = "", mouseTarget = evt.target;

         // the following check speeds up processing when hovering over same doc
         if ((this.state.htmlDoc != mouseTarget.ownerDocument ) || !this.state.htmlText) {
            // get the HTML page as a string (only needed once per location hit)
            var htmlElements = mouseTarget.ownerDocument.getElementsByTagName('html');
            if (!htmlElements.length) {
               return;
            }
            this.state.htmlDoc = mouseTarget.ownerDocument;
            // normalize any spaces or quotes in source document
            var htmlText = htmlElements[0].innerHTML.replace(/&nbsp;|[\s\"]/g, " ");
            this.state.htmlText = htmlText;
         }

         if (this.state.htmlText) {
            // filter out any non-sensible text targets
            var targetNodeName = mouseTarget.nodeName.toUpperCase();
            if (!(targetNodeName in NONTEXT_TARGETS)) {
               var targetText = mouseTarget.textContent;
               suggestedText = targetText.substr(0, AUTOSUGGEST_LENGTH);

               if (targetText.length > suggestedText.length) {
                  // trim any trailing 'partial word' matches if the original text was truncated
                  suggestedText = suggestedText.replace(/(.*\W)[^\W]*$/, "$1");
               }

               // XXX some of this stuff may need tweaking...(embedded hex code and quote conversion)
               suggestedText = suggestedText.replace(/&#[\d]+;/g, " ");  // convert any embedded hex codes to spaces
               suggestedText = suggestedText.replace(/["]/g, " ");  // convert any quotes to spaces
               suggestedText = suggestedText.replace(/^[\s]*[\n\r]*([^\s\n\r]*?)/, "$1");  // trim any outside newlines/whitespace
               suggestedText = suggestedText.replace(/([^\s]*)[\s|<]*$/, "$1");  // trim any trailing whitespace or markup
               suggestedText = suggestedText.replace(/([^\n\r]*?)/, "$1");  // trim anything after a trailing newline
            }
         }

         if (suggestedText && this.state.htmlText) {
            // Now do a pre-search on the page, if we can't find it now, we won't find it later.
            // Note:  Part of the reason this is done is because the 'textContent' property value
            // scrubs off any html markup before it hands us a text string.  So when we search the
            // page during replay, the text string's missing inner markup (like <br> and <b> tags)
            // will cause the match to fail.  That is, we recorded "foo bar" but the page source
            // actually shows it as "foo <b>bar</b>".  We can still keyword this, but the user
            // will be required to select the text range directly to use the HTML page source.
            if (!this.searchForKeywordText( suggestedText, this.state.htmlText )) {
               // the suggestion can't be found in the page source
               // so we have to discard it
               suggestedText = "";
            }
         } else {
            // if we get here, then we have no suggestion, so clear text
            suggestedText = "";
         }

         this.observerService.notifyObservers('dejaclick:suggestedkeyword', {keyword: suggestedText});

         // Save the suggested text in case the user decides to use it.
         // (The value will be consumed in dejaServiceCs.onContentEvent().)
         this.state.suggestedText = suggestedText;

      } catch( e ) {
         this.logger.logException( e, this.myname+".suggestKeywords" );
      }
   },

   /**
    * Pre-search for the suggested keyword text in the page source.
    * @this {!DejaClickCs.Validation}
    * @param {!string} aRawMatchText The suggested keyword text.
    * @param {!string} aHtmlText The page source.
    */
   searchForKeywordText: function(aRawMatchText, aHtmlText) {
      try {
         // escape any characters with special meaning in regular expressions
         var matchText = aRawMatchText.replace(/([\"\^\$\.\*\+\?\=\!\:\|\\\/\(\)\[\]\{\}])(.)/g, "\\$1$2");

         // apply word-boundary delimiters to the suggesting text
         matchText = "\\W" + matchText + "\\W";

         var reObj;   // wrap the regexp to handle syntax errors silently
         try { reObj = new RegExp( matchText, "m" ); } catch (ex) {}
         if (reObj) { // perform the regexp search
            return reObj.test( aHtmlText );
         } else {
            return false;
         }
      } catch( e ) {
         // log any errors here as a failure only, not an exception (which will abort activities)
         this.logger.logFailure( "Failure (exception" + e.message + " in " +  this.myname+".searchForKeywordText" );
      }
      return false;
   },

   /**
    * Get the source of the currently selected text.
    * @this {!DejaClickCs.Validation}
    */
   getMatchTextSource: function() {
      try {
         var focusedWindow = window;
         var sourceText = "";
         var selectionObj = focusedWindow.getSelection();
         if (selectionObj.rangeCount > 0 && !selectionObj.isCollapsed) {
            // page has a highlighted selection, so get the associated selection source
            sourceText = this.getSourceForSelection( selectionObj );
            // do a pre-search on the page, if we can't find it now, we won't find it later
            if (!this.searchForSourceText( sourceText )) {
               // not found, clear the match text and use default keyword option settings
               sourceText = "";
            }
         }
         return sourceText;

      } catch( e ) {
         this.logger.logException( e, this.myname+".getMatchTextSource" );
      }
      return "";
   },

   /**
    * Retrieve the source associated with the highlighted selection on the page.
    * (significantly based on code from Firefox's chrome://global/content/viewPartialSource.js)
    * @this {!DejaClickCs.Validation}
    * @param {!Selection} aSelection The selected text.
    */
   getSourceForSelection: function(aSelection) {
      try {
         var range = aSelection.getRangeAt(0);
         var ancestorContainer = range.commonAncestorContainer;
         var doc = ancestorContainer.ownerDocument;

         var startContainer = range.startContainer;
         var endContainer = range.endContainer;
         var startOffset = range.startOffset;
         var endOffset = range.endOffset;

         // let the ancestor be an element
         if (ancestorContainer.nodeType == Node.TEXT_NODE ||
         ancestorContainer.nodeType == Node.CDATA_SECTION_NODE)
         ancestorContainer = ancestorContainer.parentNode;

         // for selectAll, let's use the entire document, including <html>...</html>
         // @see DocumentViewerImpl::SelectAll() for how selectAll is implemented
         try {if (ancestorContainer == doc.body) ancestorContainer = doc.documentElement;} catch (ex){}

         // each path is a "child sequence" (a.k.a. "tumbler") that
         // descends from the ancestor down to the boundary point
         var startPath = this.getPath(ancestorContainer, startContainer);
         var endPath = this.getPath(ancestorContainer, endContainer);

         // clone the fragment of interest and reset everything to be relative to it
         // note: it is with the clone that we operate/munge from now on
         ancestorContainer = ancestorContainer.cloneNode(true);
         startContainer = ancestorContainer;
         endContainer = ancestorContainer;

         // Only bother with the selection if it can be remapped. Don't mess with
         // leaf elements (such as <isindex>) that secretly use anynomous content
         // for their display appearance.
         var tmpNode;
         var canDrawSelection = ancestorContainer.hasChildNodes();
         if (canDrawSelection) {
            var i;
            for (i = startPath ? startPath.length-1 : -1; i >= 0; i--) {
               startContainer = startContainer.childNodes.item(startPath[i]);
            }
            for (i = endPath ? endPath.length-1 : -1; i >= 0; i--) {
               endContainer = endContainer.childNodes.item(endPath[i]);
            }

            // add special markers to record the extent of the selection
            // note: |startOffset| and |endOffset| are interpreted either as
            // offsets in the text data or as child indices (see the Range spec)
            // (here, munging the end point first to keep the start point safe...)
            if (endContainer.nodeType == Node.TEXT_NODE ||
                endContainer.nodeType == Node.CDATA_SECTION_NODE) {
               // do some extra tweaks to try to avoid the view-source output to look like
               // ...<tag>]... or ...]</tag>... (where ']' marks the end of the selection).
               // To get a neat output, the idea here is to remap the end point from:
               // 1. ...<tag>]...   to   ...]<tag>...
               // 2. ...]</tag>...  to   ...</tag>]...
               if ((endOffset > 0 && endOffset < endContainer.data.length) ||
                   !endContainer.parentNode || !endContainer.parentNode.parentNode) {
                  endContainer.insertData(endOffset, DC_MARK_SELECTION_END);
               } else {
                  tmpNode = doc.createTextNode(DC_MARK_SELECTION_END);
                  endContainer = endContainer.parentNode;
                  if (endOffset === 0) {
                     endContainer.parentNode.insertBefore(tmpNode, endContainer);
                  } else {
                     endContainer.parentNode.insertBefore(tmpNode, endContainer.nextSibling);
                  }
               }
            } else {
               tmpNode = doc.createTextNode(DC_MARK_SELECTION_END);
               endContainer.insertBefore(tmpNode, endContainer.childNodes.item(endOffset));
            }

            if (startContainer.nodeType == Node.TEXT_NODE ||
                startContainer.nodeType == Node.CDATA_SECTION_NODE) {
               // do some extra tweaks to try to avoid the view-source output to look like
               // ...<tag>[... or ...[</tag>... (where '[' marks the start of the selection).
               // To get a neat output, the idea here is to remap the start point from:
               // 1. ...<tag>[...   to   ...[<tag>...
               // 2. ...[</tag>...  to   ...</tag>[...
               if ((startOffset > 0 && startOffset < startContainer.data.length) ||
                   !startContainer.parentNode || !startContainer.parentNode.parentNode ||
                   startContainer != startContainer.parentNode.lastChild) {
                  startContainer.insertData(startOffset, DC_MARK_SELECTION_START);
               } else {
                  tmpNode = doc.createTextNode(DC_MARK_SELECTION_START);
                  startContainer = startContainer.parentNode;
                  if (startOffset === 0) {
                     startContainer.parentNode.insertBefore(tmpNode, startContainer);
                  } else {
                     startContainer.parentNode.insertBefore(tmpNode, startContainer.nextSibling);
                  }
               }
            } else {
               tmpNode = doc.createTextNode(DC_MARK_SELECTION_START);
               startContainer.insertBefore(tmpNode, startContainer.childNodes.item(startOffset));
            }
         }

        // now extract and display the syntax highlighted source
        tmpNode = doc.createElementNS(DC_NS_XHTML, 'div');
        tmpNode.appendChild(ancestorContainer);

         var containerSource = tmpNode.innerHTML;

         // grab the indexes of the selection text based on our injected markers
         var startPos = containerSource.indexOf( DC_MARK_SELECTION_START ) + DC_MARK_SELECTION_START.length;
         var endPos = containerSource.indexOf( DC_MARK_SELECTION_END );

         var sourceFragment = containerSource.slice( startPos, endPos );
         if (!sourceFragment) {
            // if no source between the markers, grab the entire
            // selection and remove our temporary start/end markers
            sourceFragment = containerSource.replace( DC_MARK_SELECTION_START,'').replace( DC_MARK_SELECTION_END,'');
         }
         return sourceFragment;

      } catch( e ) {
         this.logger.logException( e, this.myname+".getSourceForSelection" );
      }
      return "";
   },

   /**
    * Helper to get a path like FIXptr, but with an array instead of the "tumbler" notation.
    * @this {!DejaClickCs.Validation}
    * @param {!Node|null} ancestor
    * @param {!Node|null} node
    */
   getPath: function(ancestor, node) {
      try {
         var n = node;
         var p = n.parentNode;
         if (n == ancestor || !p) return null;

         var path = [];
         if (!path) return null;

         do {
            for (var i = 0; i < p.childNodes.length; i++) {
               if (p.childNodes.item(i) == n) {
                  path.push(i);
                  break;
               }
            }
            n = p;
            p = n.parentNode;
         } while (n != ancestor && p);

         return path;

      } catch( e ) {
         this.logger.logException( e, this.myname+".getPath" );
      }
      return "";
   },

   /**
    * Pre-search for the user-selected text in the page source.
    * @this {!DejaClickCs.Validation}
    * @param {!string} aRawMatchText The source of the selected text.
    */
   searchForSourceText: function(aRawMatchText) {
      try {
         var htmlText;
         try { htmlText = this.state.htmlDoc.documentElement.innerHTML; } catch(ex){}
         if (!htmlText) return false;

         // escape any characters with special meaning in regular expressions
         var matchText = aRawMatchText.replace(/([\"\^\$\.\*\+\?\=\!\:\|\\\/\(\)\[\]\{\}])(.)/g, "\\$1$2");

         var reObj;   // wrap the regexp to handle syntax errors silently
         try { reObj = new RegExp( matchText, "m" ); } catch (err) {}
         if (reObj) { // perform the regexp search
            return reObj.test( htmlText );
         } else {
            return false;
         }

      } catch( e ) {
         this.logger.logException( e, this.myname+".searchForSourceText" );
      }
      return false;
   },

   /**
    * Clear the current selection of page text.
    * @this {!DejaClickCs.Validation}
    */
   clearSelection: function() {
      try {
         // clear any previously selected ranges
         var focusedWindow = window;
         var selectionObj = focusedWindow.getSelection();
         selectionObj.removeAllRanges();

      } catch( e ) {
         this.logger.logException( e, this.myname+".clearSelection" );
      }
   },

   setValidationType: function(aData) {
      this.state.validationtype = aData.type;
   }
};


try {
   DejaClickCs.validation = new DejaClickCs.Validation(
         DejaClickCs.constants,
         DejaClickCs.logger, DejaClickCs.observerService,
         DejaClick.EventRegistration );
} catch( e ) {
   DejaClickCs.logger.logException( e, "DejaClickCs.Validation" );
}

}());
