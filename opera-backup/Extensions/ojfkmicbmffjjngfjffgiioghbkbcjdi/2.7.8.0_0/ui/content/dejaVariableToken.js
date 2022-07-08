/* -*- Mode: Javascript; tab-width: 3; indent-tabs-mode: nil; c-basic-offset: 3 -*- */

/*global window,DejaClickUi,$,DejaClick,document,chrome*/

'use strict';

/**
 * Preferred width of the add/edit javascript validation dialog.
 * @const
 */
var preferredWidth = 400;
/**
 * Preferred height of the add/edit javascript validation dialog.
 * @const
 */
var preferredHeight = 500;
var locationIDList = [];   
if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Class to encapsulate the functionality of editing variable tokens.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {{
 *    context: !Element,
 *    item: ?Array
 * }} aOptions The options passed to the dialog.
 * @param {!Element} aRootElement The parent element of the page's UI.
 *    This is typically the documentElement.
 * @param {!Window} aWindow The window object.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 */

DejaClickUi.VariableToken = function(aOptions, aRootElement,
                                     aWindow, aConstants, aUtils) {

   var root = $(aRootElement);

   // TODO: review when finish
   this.item = aOptions.item;
   this.window = aWindow;
   this.constants = aConstants;
   this.utils = aUtils;
   this.logger = aUtils.logger;

   this.window.returnValue = null;

   this.state = {};
   this.state.divIds = [
      '',
      'typeStaticText',
      'typeRandomText',
      'typeRandomNumber',
      'typeAutoInc',
      'typeDatetime',
      'typeDataset', // todo: not implemented yet
      'typeLocation',
      'typeJavascript'
   ];
   this.state.type = this.item ? this.item[0] : this.constants.DC_TOKENTYPE_STATICTEXT;

   this.elements = {
      title: root.find('title'),
      description: root.find('#description'),
      typeSelect: root.find('#tokenTypeSelection'),
      fsParams: root.find('fieldset#params'),
      fsLimit: root.find('fieldset#limit'),
      fsLimitLegend: root.find('fieldset#limit > legend'),

      staticText: root.find('#staticText'),

      randomTextMin: root.find('#randomTextMin'),
      randomTextMax: root.find('#randomTextMax'),

      randomNumberMin: root.find('#randomNumberMin'),
      randomNumberMax: root.find('#randomNumberMax'),

      autoIncValueStart: root.find('#autoIncValueStart'),
      autoIncValueInc: root.find('#autoIncValueInc'),

      datetimeFormat: root.find('#datetimeFormat'),
      formatSpecifiers: root.find('#formatSpecifiers'),
      datetimeOffsetDays: root.find('#offsetDays'),
      datetimeOffsetHours: root.find('#offsetHours'),
      datetimeOffsetMinutes: root.find('#offsetMinutes'),
      datetimeOffsetSeconds: root.find('#offsetSeconds'),

      //@todo
      //dataset: root.find('#dataset'),
      //datasetStartRow: root.find('#startRow'),
      //datasetStartColumn: root.find('#startColumn'),
      //datasetStartRowInc: root.find('#startRowInc'),
      //datasetStartColumnInc: root.find('#startColumnInc'),

      jsText: root.find('#jsText'),

      location: root.find('#locationID'),
      locations: root.find('#locations'),

      apply: root.find('#apply'),
      cancel: root.find('#cancel'),

      allInputs: root.find('textarea,input,select,datalist'), // removed 'a' element
      changeInputs: root.find('select,textarea'),
      allButtons: root.find('button')
   };

   // Initialize buttons.
   this.elements.allButtons.button();

   this.elements.typeSelect.on('change', this.updateType.bind(this));
   this.elements.datetimeFormat.on('contextmenu', this.showDatetimeMenu.bind(this));
   this.elements.formatSpecifiers.on('click', this.datetimeAddSpecifier.bind(this));
   this.elements.formatSpecifiers.on('mouseleave', this.hideDatetimeMenu.bind(this));
   this.elements.allInputs.on('change input', this.enableControls.bind(this));
   this.elements.apply.on('click', this.apply.bind(this));
   this.elements.cancel.on('click', this.cancel.bind(this));

   aUtils.localizeTree(aRootElement, 'deja_');

   this.init();
};

DejaClickUi.VariableToken.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.VariableToken,

   /**
    * Initialize the dialog
    * @this {!DejaClickUi.VariableToken}
    */
   init: function() {
      var token, optionElt, min, max, myLocation;

      if (this.item && Array.isArray(this.item) && this.item.length && !isNaN(this.item[0])) {
         token = this.item;
      }

      if (token) {
         this.elements.title.text(this.utils.getMessage('deja_varToken_titleEdit'));
         this.elements.description.text(this.utils.getMessage('deja_varToken_descriptionEdit'));

         this.elements.typeSelect.val(token[0]);

         switch (this.state.type) {
            case this.constants.DC_TOKENTYPE_STATICTEXT:
               this.elements.staticText.val(token[2]);
               break;

            case this.constants.DC_TOKENTYPE_RANDOMTEXT:
               this.elements.randomTextMin.val(this.getNumericValue(token[2]));
               this.elements.randomTextMax.val(this.getNumericValue(token[3]));
               break;

            case this.constants.DC_TOKENTYPE_RANDOMNUMBER:
               this.elements.randomNumberMin.val(this.getNumericValue(token[2]));
               this.elements.randomNumberMax.val(this.getNumericValue(token[3]));
               break;

            case this.constants.DC_TOKENTYPE_AUTOINC:
               this.elements.autoIncValueStart.val(this.getNumericValue(token[2]));
               this.elements.autoIncValueInc.val(this.getNumericValue(token[3]));
               break;

            case this.constants.DC_TOKENTYPE_DATETIME:
               this.elements.datetimeOffsetDays.val(this.getNumericValue(token[2]));
               this.elements.datetimeOffsetHours.val(this.getNumericValue(token[3]));
               this.elements.datetimeOffsetMinutes.val(this.getNumericValue(token[4]));
               this.elements.datetimeOffsetSeconds.val(this.getNumericValue(token[5]));
               this.elements.datetimeFormat.val(token[6]);

               break;

            case this.constants.DC_TOKENTYPE_DATASET:
               // TODO
               break;

            case this.constants.DC_TOKENTYPE_LOCATION:
               break;

            case this.constants.DC_TOKENTYPE_JAVASCRIPT:
               this.elements.jsText.val(token[2]);
               break;

            default:
               return false;
         }
      }
      else {
         this.elements.title.text(this.utils.getMessage('deja_varToken_titleAdd'));
         this.elements.description.text(this.utils.getMessage('deja_varToken_descriptionAdd'));
      }

      myLocation = this.utils.prefService.getPrefOption('DC_OPTID_LOCATIONID');

      DejaClick.utils.restApi.listLocations('',this.populateLocationIDs);

      this.updateType();
      this.enableControls();
      
      //UXM-11237 - Adding a timeout as otherwise in Chrome it doesn't set the correct height.
      setTimeout(function() {
         DejaClick.service.__modal.resizeModal($('body').outerHeight() + 50);
      }, 50);
   },

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * page.
    * @this {!DejaClickUi.VariableToken}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allInputs.off('change input contextmenu');
         this.elements.allButtons.off('click');
         this.elements.formatSpecifiers.off('click mouseleave');
      }

      delete this.elements;
      delete this.state;
      delete this.logger;
      delete this.utils;
      delete this.constants;
      delete this.window;
      delete this.item;
   },

   /**
    * Apply the changes to this token. Close the window.
    * @this {!DejaClickUi.VariableToken}
    * @param {!Event} aEvent A jQuery click event on the apply button.
    */
   apply: function (aEvent) {
      var token = [], win;

      try {
         token.push(this.state.type);
         var locationID = this.elements.location.val();
         var actual = locationIDList.filter((index)=>{
            var id = index.split('-')[1].trim();
            if(id === locationID || index === locationID){
               return index;
            }
         });

         locationID = actual.length > 0 ? actual[0].split('-')[1].trim() : "";
         
         var prevLocation = DejaClick.service.__modal.arguments.item !== null ? DejaClick.service.__modal.arguments.item[1]:null;
         locationID = locationIDList.length == 0 ? prevLocation : locationID;

         token.push(locationID);

         switch (this.state.type) {
            case this.constants.DC_TOKENTYPE_STATICTEXT:
               token.push(this.elements.staticText.val());
               break;

            case this.constants.DC_TOKENTYPE_RANDOMTEXT:
               token.push(this.getNumericValue(this.elements.randomTextMin.val()));
               token.push(this.getNumericValue(this.elements.randomTextMax.val()));
               break;

            case this.constants.DC_TOKENTYPE_RANDOMNUMBER:
               token.push(this.getNumericValue(this.elements.randomNumberMin.val()));
               token.push(this.getNumericValue(this.elements.randomNumberMax.val()));
               break;

            case this.constants.DC_TOKENTYPE_AUTOINC:
               token.push(this.getNumericValue(this.elements.autoIncValueStart.val()));
               token.push(this.getNumericValue(this.elements.autoIncValueInc.val()));
               break;

            case this.constants.DC_TOKENTYPE_DATETIME:
               token.push(this.getNumericValue(this.elements.datetimeOffsetDays.val()));
               token.push(this.getNumericValue(this.elements.datetimeOffsetHours.val()));
               token.push(this.getNumericValue(this.elements.datetimeOffsetMinutes.val()));
               token.push(this.getNumericValue(this.elements.datetimeOffsetSeconds.val()));
               token.push(this.elements.datetimeFormat.val());
               break;

            case this.constants.DC_TOKENTYPE_DATASET:
               break;

            case this.constants.DC_TOKENTYPE_LOCATION:
               break;

            case this.constants.DC_TOKENTYPE_JAVASCRIPT:
               token.push(this.elements.jsText.val());
               break;

            default:
               return false;
         }

         this.close();
         DejaClick.service.__modal.close(Array.prototype.slice.call(token));

      }
      catch (ex) {
            DejaClick.utils.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, discarding any changes.
    * @this {!DejaClickUi.VariableToken}
    * @param {!Event} aEvent A jQuery click event on the cancel button.
    */
   cancel: function (aEvent) {
      try {
         this.close();
         DejaClick.service.__modal.close();
      } catch (ex) {
            DejaClick.utils.logger.logException(ex);
      }
   },

   populateLocationIDs:function(status,results){
      var locationList = document.getElementById('locations');
      var currentLocation = DejaClick.service.__modal.arguments.item === null? null: DejaClick.service.__modal.arguments.item[1];
      results.forEach(item=>{
         let option = document.createElement('option');
         let locationOption = item.code.split('|')[0]
         option.value = item.name +' - '+item.code.split('|')[0];
         if(locationOption === currentLocation){
            document.getElementById('locationID').value = option.value;
         }
         locationIDList.push(option.value);
         locationList.appendChild(option);
      });
      document.getElementById('limit').style.visibility = 'visible'; 
      
   },

   /**
    * Show datetime specifiers menu
    * @param aEvent
    */
   showDatetimeMenu: function (aEvent) {
      aEvent.preventDefault();
      this.elements.formatSpecifiers.show();
   },

   /**
    * Hide datetime specifiers menu
    * @param aEvent
    */
   hideDatetimeMenu: function (aEvent) {
      this.elements.formatSpecifiers.hide();
   },

   /**
    * Add datetime specifier from the menu. Close the menu
    * @param aEvent
    */
   datetimeAddSpecifier: function (aEvent) {
      var formatSpecifier = aEvent.target.getAttribute('data-dt-string');
      if (formatSpecifier) {
         this.elements.datetimeFormat.val(this.elements.datetimeFormat.val() + formatSpecifier);
         this.hideDatetimeMenu();
      }
   },

   /**
    * Update the form based on selected token type.
    * @this {!DejaClickUi.VariableToken}
    * @param aEvent
    */
   updateType: function(aEvent) {
      this.state.type = this.elements.typeSelect.val();
      this.elements.fsParams.children('div.tokenType').hide();

      if (this.state.type != this.constants.DC_TOKENTYPE_LOCATION) {
         this.elements.fsParams.show();
         this.elements.fsParams.children('div#' + this.state.divIds[this.state.type]).
            //UXM-11237 - Changed from "show" to "attr" because, don't ask me why, but "show" doesn't work 
            //for the initial load in Chrome... while attr seems to be working all the time.
            attr("style", "display: block"); 
         this.elements.fsLimitLegend.text(this.utils.getMessage('deja_varToken_legendLimitTo'));
      }
      else {
         this.elements.fsParams.hide();
         this.elements.fsLimitLegend.text(this.utils.getMessage('deja_varToken_legendParameters'));
      }

      //UXM-11237 - Minor enhancenment to force a resize of the modal after any update of visible options.
      DejaClick.service.__modal.resizeModal($('body').outerHeight() + 50);
   },

   /**
    * Transform string numeric value to a number
    * @this {!DejaClickUi.VariableToken}
    * @param {string} strValue string value
    * @returns {number}
    */
   getNumericValue: function( strValue ) {
      var intValue = 0;

      if (strValue && strValue.length) {
         intValue = parseInt(Number(strValue)) || 0;
      }

      return intValue;
   },

   /**
    * Manage controls state based on the form filling
    * @this {!DejaClickUi.VariableToken}
    * @returns {boolean}
    */
   enableControls: function() {
      var btnOkDisabled = true,
         maxInteger = Number.MAX_SAFE_INTEGER || 9007199254740991,
         min, max;

      switch (this.state.type) {

         case this.constants.DC_TOKENTYPE_STATICTEXT:
            btnOkDisabled = this.elements.staticText.val().length === 0;
            break;

         case this.constants.DC_TOKENTYPE_RANDOMTEXT:
            min = this.getNumericValue(this.elements.randomTextMin.val());
            max = this.getNumericValue(this.elements.randomTextMax.val());

            btnOkDisabled = min < 0 || max < min;
            break;

         case this.constants.DC_TOKENTYPE_RANDOMNUMBER:
            min = this.getNumericValue(this.elements.randomNumberMin.val());
            max = this.getNumericValue(this.elements.randomNumberMax.val());

            btnOkDisabled = max < min || max > maxInteger;
            break;

         case this.constants.DC_TOKENTYPE_AUTOINC:
            btnOkDisabled = false; // default values will be used if empty values
            break;

         case this.constants.DC_TOKENTYPE_DATETIME:
            btnOkDisabled = false; // default values will be used if empty values
            break;

         case this.constants.DC_TOKENTYPE_DATASET:
            btnOkDisabled = true; // TODO: implement after dataset implementation
            break;

         case this.constants.DC_TOKENTYPE_LOCATION:
            btnOkDisabled = false;
            break;

         case this.constants.DC_TOKENTYPE_JAVASCRIPT:
            btnOkDisabled = this.elements.jsText.val().trim().length === 0;
            break;

         default:
            return false;

      }

      this.elements.apply.button('option', 'disabled', btnOkDisabled);
   }

};

$(function () {
   /**
    * Clean up when the page is unloaded.
    * @param {!Event} aEvent jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('variableToken')) {
            DejaClickUi.variableToken.close();
            delete DejaClickUi.variableToken;
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
         DejaClickUi.variableToken = new DejaClickUi.VariableToken(
            DejaClick.service.__modal.arguments,
            document.documentElement,
            window,
            DejaClick.constants,
            DejaClick.utils);
         $(window).on('unload', unload);
         DejaClick.service.__modal.resizeModal($('body').outerHeight() + 50);
         DejaClick.service.__modal.setTitle('deja_varToken_titleAdd');
         document.getElementById('limit').style.visibility = 'hidden';
         
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