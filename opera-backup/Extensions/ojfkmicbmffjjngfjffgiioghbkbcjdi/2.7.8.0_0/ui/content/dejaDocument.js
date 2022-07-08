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

/*
 * Dialog to select the document in which to perform a validation.
 * Input: {{
 *    context:!Element,
 *    targetDocument:?Element
 * }} The event or action element in which the validation occurs and,
 *    optionally, the suggested document in which to perform the validation.
 * Output: {?Element} The selected document element from the navigation tree,
 *    or null if the selection operation was canceled.
 */

/*global window,DejaClickUi,$,DejaClick,document,chrome*/

'use strict';

/**
 * Preferred width of the document selection dialog.
 * @const
 */
var preferredWidth = 600;
/**
 * Preferred height of the document selection dialog.
 * @const
 */
var preferredHeight = 350;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Encapsulates the functionality of selecting a document from a list
 * of documents that have been loaded while recording or replaying a
 * script.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {!Element} aContext The action or event element in the script
 *    during which the document will be accessed.
 * @param {?Element} aTarget The target document to be initially selected.
 *    A null value indicates no initial selection.
 * @param {!Element} aRootElement The root element of the UI for URL
 *    mask editing (i.e., the documentElement).
 * @param {!Window} aWindow The window object.
 * @param {!chrome.WindowsApi} aWindowsApi The chrome.windows API.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!DejaClick.Script} aScript The script containing the documents
 *    from which to select.
 * @param {function(new:DejaClick.EventRegistration)} AEventRegistration
 *    The event registration constructor.
 */
DejaClickUi.Document = function (aContext, aTarget, aRootElement, aWindow,
      aWindowsApi, aUtils, aScript, AEventRegistration) {
   var root;

   aWindow.returnValue = null;

   this.window = aWindow;
   this.windowsApi = aWindowsApi;
   this.logger = aUtils.logger;

   /**
    * Index of the selected row. -1 indicates none.
    * @type {integer}
    */
   this.selected = -1;
   /**
    * IDs of the window(s) opened to display document sources.
    * @type {!Array.<integer>}
    */
   this.sourceWindows = [];

   this.events = new AEventRegistration().
      enable(false).
      addChromeListener(aWindowsApi.onRemoved, this.removeWindow, this);

   // Initialize the UI.
   aUtils.localizeTree(aRootElement, 'deja_');

   root = $(aRootElement);
   this.elements = {
      table: root.find('table'),
      tableBody: root.find('tbody'),
      viewSource: root.find('#viewSource'),
      apply: root.find('#ok'),
      cancel: root.find('#cancel')
   };

   this.elements.tableBody.on('click', this.selectDocument.bind(this));
   this.elements.viewSource.button().on('click', this.viewSource.bind(this));
   this.elements.cancel.button().on('click', this.cancel.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));

   // List the relevant documents.
   this.documents = this.listDocuments(aScript, aContext);
   if (this.documents.length === 0) {
      this.window.alert(aUtils.getMessage('deja_document_noDocuments'));
      this.window.close();
      return;
   }
   // Select the suggested document.
   this.selected = this.documents.indexOf(aTarget);
   if (this.selected === -1) {
      this.elements.viewSource.button('disable');
      this.elements.apply.button('disable');
   } else {
      $(this.elements.tableBody.prop('rows')[this.selected]).
         addClass('trSelected');
   }

   this.elements.table.flexigrid({
      singleSelect: true,
      showToggleBtn: false,
      colResize: false
   });
};

DejaClickUi.Document.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Document,

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * page.
    * @this {!DejaClickUi.Document}
    */
   close: function () {
      var index;

      if (this.hasOwnProperty('elements')) {
         this.elements.tableBody.off('click');
         this.elements.cancel.off('click').button('destroy');
         this.elements.apply.off('click').button('destroy');
         this.elements.viewSource.off('click').button('destroy');
         this.elements.table.flexigrid('destroy');
      }

      if (this.hasOwnProperty('events')) {
         this.events.close();
      }

      if (this.hasOwnProperty('sourceWindows') &&
            this.hasOwnProperty('windowsApi')) {
         while (this.sourceWindows.length !== 0) {
            this.windowsApi.remove(this.sourceWindows.pop());
         }
      }

      delete this.documents;
      delete this.elements;
      delete this.events;
      delete this.sourceWindows;
      delete this.selected;
      delete this.logger;
      delete this.windowsApi;
      delete this.window;
   },

   /**
    * Select a document in the list.
    * @this {!DejaClickUi.Document}
    * @param {!Event} aEvent A jQuery click event on an element within
    *    the table body.
    */
   selectDocument: function (aEvent) {
      var target;
      try {
         target = aEvent.target;
         while (target.tagName !== 'TR') {
            target = target.parentNode;
            if (target == null) {
               return;
            }
         }
         this.elements.apply.button('enable');
         this.elements.viewSource.button('enable');
         this.selected = target.sectionRowIndex;
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Close the dialog without selecting a document.
    * @this {!DejaClickUi.Document}
    * @param {!Event} aEvent A jQuery click event on the cancel button.
    */
   cancel: function (aEvent) {
      var win;
      try {
         win = this.window;
         this.close();
         win.close();
         DejaClick.service.__modal.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Close the dialog and return the selected document to the opener.
    * @this {!DejaClickUi.Document}
    * @param {!Event} aEvent A jQuery click event on the OK button.
    */
   apply: function (aEvent) {
      var win;
      try {
         if ((0 <= this.selected) && (this.selected < this.documents.length)) {
            this.window.returnValue = this.documents[this.selected];
            DejaClick.service.__modal.returnValue = this.window.returnValue;
         }
         win = this.window;
         this.close();
         win.close();
         DejaClick.service.__modal.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Open a window containing the source of the selected document.
    * @this {!DejaClickUi.Document}
    * @param {!Event} aEvent A jQuery click event on the view source button.
    */
   viewSource: function (aEvent) {
      try {
         if ((0 <= this.selected) && (this.selected < this.documents.length)) {
            this.windowsApi.create({
               url: 'view-source:' +
                  this.documents[this.selected].getAttribute('urldocument'),
               focused: true,
               incognito: false,
               type: 'popup'
            }, this.rememberViewSourceWindow.bind(this));
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Record a window to be closed with the Document object.
    * @this {!DejaClickUi.Document}
    * @param {chrome.Window=} opt_window The window that was opened.
    */
   rememberViewSourceWindow: function (opt_window) {
      try {
         if (this.hasOwnProperty('sourceWindows') &&
               (opt_window !== null) &&
               (opt_window !== undefined)) {
            this.sourceWindows.push(opt_window.id);
            this.events.enable(true);
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Detect when a source window has been closed.
    * @this {!DejaClickUi.Document}
    * @param {integer} aId The id of the window that has been closed.
    */
   removeWindow: function (aId) {
      var index;
      try {
         index = this.sourceWindows.indexOf(aId);
         if (index !== -1) {
            this.sourceWindows.splice(index, 1);
            if (this.sourceWindows.length === 0) {
               this.events.enable(false);
            }
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Display the relevant documents in the UI.
    * @this {!DejaClickUi.Document}
    * @param {!DejaClick.Script} aScript The script containing the documents
    *    to be listed.
    * @param {!Element} aContext The action or event element defining which
    *    documents are to be listed. Only documents that have been loaded
    *    prior to the completion of this element are listed.
    * @return {!Array.<!Element>} A list of the document elements that
    *    correspond to each row of the table.
    */
   listDocuments: function (aScript, aContext) {
      var navTree, child, docs, attrName, seqNum, index, doc, result;

      // Find the navigation tree root. Prefer a replay tree to a record tree.
      navTree = null;
      child = aScript.getScriptElement().firstElementChild;
      while (child !== null) {
         if (child.tagName === 'navigation') {
            if (child.getAttribute('type') === 'replay') {
               navTree = child;
               break;
            } else {
               navTree = child;
            }
         }
         child = child.nextElementSibling;
      }

      result = [];
      this.elements.tableBody.empty();
      if (navTree !== null) {
         docs = navTree.getElementsByTagName('document');
         attrName = aContext.tagName;
         seqNum = Number(aContext.getAttribute('seq'));
         for (index = 0; index < docs.length; ++index) {
            doc = docs[index];
            if ((Number(doc.getAttribute(attrName)) <= seqNum) &&
                  !doc.hasAttribute('docunloaded')) {
               this.addDocument(doc);
               result.push(doc);
            }
         }
      }
      return result;
   },

   /**
    * Add a document to the table.
    * @this {!DejaClickUi.Document}
    * @param {!Element} aDocument The document element to be added.
    */
   addDocument: function (aDocument) {
      var row, cell;
      row = this.elements.tableBody[0].insertRow(-1);
      this.addCell(row, aDocument, 'action', 'columnAction').
         addCell(row, aDocument, 'event', 'columnEvent').
         addCell(row, aDocument, 'seq', 'columnOrdinal').
         addCell(row, aDocument, 'type', 'columnType').
         addCell(row, aDocument, 'title', 'columnTitle').
         addCell(row, aDocument, 'urldocument', 'columnAddress');
   },

   /**
    * Add a cell to a row in the table.
    * @this {!DejaClickUi.Document}
    * @param {!HTMLTableRowElement} aRow The row to which to add a cell.
    * @param {!Element} aDocument The document containing the cell's value.
    * @param {string} aAttribute The name of the attribute of aDocument
    *    containing the cell's value.
    * @param {string} aClass Class for the cell.
    */
   addCell: function (aRow, aDocument, aAttribute, aClass) {
      var cell = aRow.insertCell(-1);
      if (aDocument.hasAttribute(aAttribute)) {
         cell.textContent = aDocument.getAttribute(aAttribute);
      }
      cell.setAttribute('class', aClass);
      return this;
   }
};


$(function () {
   /**
    * Clean up when the page is unloaded.
    * @param {!Event} A jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('document')) {
            DejaClickUi.document.close();
            delete DejaClickUi.document;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the Document instance once the page is
    * loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.document = new DejaClickUi.Document(
            DejaClick.service.__modal.arguments.context,
            ((DejaClick.service.__modal.arguments.targetDocument == null) ? null :
            DejaClick.service.__modal.arguments.targetDocument),
            document.documentElement,
            window,
            chrome.windows,
            DejaClick.utils,
            DejaClick.script,
            DejaClick.EventRegistration);
         $(window).on('unload', unload);
       DejaClick.service.__modal.resizeModal($('body').outerHeight() + 50);
       DejaClick.service.__modal.setTitle('deja_document_title');

      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   try {
      if (DejaClick.service.__modal.arguments) {
         initialize();
      } else {
         window.onDialogArguments = initialize;
      }
   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }
});
