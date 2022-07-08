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

/*global DejaClick,XPathResult,DOMParser,document,Node*/


/**
 * Script encapsulates all access and modification to the script data
 * structure.
 * @constructor
 */
DejaClick.Script = function () {
   this.m_filename = '';
   this.m_changesPending = false;
   // this.m_filename      // gDC._scriptPath
   /**
    * Stub to keep Closure compiler happy.
    * @type {!Document}
    */
   this.m_document = document;
   /**
    * Stub to keep Closure compiler happy.
    * @type {!Element}
    */
   this.m_scriptElement = document.createElement('script');
   /** @type {!Array.<!Element>} */
   this.m_actTreeRoots = [];

   this.m_monitorId = null; //UXM-12145 - Store the ID of the downloaded device (if it was downloaded)
   
   this.gDC = DejaClick.service;
};

DejaClick.Script.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.Script,

   DC_REPLAY_WARNING : 1,
   DC_REPLAY_ERROR : 2,
   
   /**
    * Get the filename (if any) for the script.
    * @this {!DejaClick.Script}
    * @return {string} The filename. Empty string if there is none.
    */
   getFilename: function () {
      return this.m_filename;
   },

   /**
    * Set the filename of the script.
    * @this {!DejaClick.Script}
    * @param {string} filename The filename.
    */
   setFilename: function (filename) {
      this.m_filename = filename;
   },

   /**
    * Get the monitor ID (if any). This value will be defined just when the script was downloaded from the platform.
    * 
    * @this {!DejaClick.Script}
    * @return {integer} The monitor ID (device ID - obj_device)
    */
   getMonitorId: function () {
      return this.m_monitorId;
   },

   /**
    * Set the monitor ID (if any). This value will be defined just when the script was downloaded from the platform.
    * 
    * @this {!DejaClick.Script}
    * @param {integer} id monitor ID (device ID - obj_device)
    */
   setMonitorId: function (id) {
      this.m_monitorId = id;
   },

   /**
    * Determine whether there are any unsaved changes in the script.
    * @this {!DejaClick.Script}
    * @return {boolean} true if the script has been modified since it was
    *    last saved (or if it has never been saved).
    */
   areChangesPending: function () {
      return this.m_changesPending;
   },

   /**
    * Clear the changes pending flag.
    * @this {!DejaClick.Script}
    */
   clearChangesPending: function () {
      this.m_changesPending = false;
   },

   /**
    * Set the changes pending flag.
    * @this {!DejaClick.Script}
    */
   setChangesPending: function () {
      this.m_changesPending = true;
   },

   /**
    * Return the DOM element node for the script tag.
    * @this {!DejaClick.Script}
    * @return {!Element}
    */
   getScriptElement: function () { return this.m_scriptElement; },

   /**
    * Return the DOM element node for the actions tag.
    * @this {!DejaClick.Script}
    * @return {!Array.<!Element>}
    */
   getActTreeRoots: function () {
      return this.m_actTreeRoots;
   },

   /**
    * Gets the XML Node for the event number
    * @param {*} aEventNum  
    * @param {*} aScriptNum Optional
    */
   getEventNode(aEventNum, aScriptNum) {
      let eventNum = ( isNaN(aEventNum) || aEventNum < 0 )?0:aEventNum;
      let scriptNumber = isNaN(aScriptNum)?0:aScriptNum;
      return this.getHashkeyNode(eventNum+":event:"+scriptNumber);
   },

   /**
    * Gets the XML Node for the action number
    * @param {*} aActionNum  
    * @param {*} aScriptNum Optional
    */
   getActionNode(aActionNum, aScriptNum) {
      let actionNum = ( isNaN(aActionNum) || aActionNum < 0 )?0:aActionNum;
      let scriptNumber = isNaN(aScriptNum)?0:aScriptNum;
      return this.getHashkeyNode(actionNum+":action:"+scriptNumber);
   },

   /**
    * Get the element corresponding to the given hash key.
    * @this {!DejaClick.Script}
    * @param {string} key The hashkey of the desired script element.
    * @return {?Element} The corresponding element of the script.
    */
   getHashkeyNode: function (key) {
      var parts, scriptNum, baseElt, index, eltList;
      
	  if (!key) {
         return null;
	  }
	  
      parts = key.split(':');
      if (parts.length > 1) {
         if (parts[1] === 'script') {
            return this.m_scriptElement;
         }
         if (!parts[1].match(/action|event/)) {
            baseElt = this.m_scriptElement;
         } else {
            scriptNum = (parts.length > 2) ? Number(parts[2]) : 0;
            if (scriptNum < this.m_actTreeRoots.length) {
               baseElt = this.m_actTreeRoots[scriptNum];
            }
         }
         index = Number(parts[0]) - 1;
         if ((baseElt !== undefined) && (index >= 0)) {
            eltList = baseElt.getElementsByTagName(parts[1]);
            if (index < eltList.length) {
               return eltList[index];
            }
         }
      }
      return null;
   },

   /**
    * Renumber the seq attribute all elements in the script with the
    * specified tag.
    * @this {!DejaClick.Script}
    * @param {string} aTag The tag name of the elements to be renumbered.
    * @param {element} parentNode Parent node where the elements should be renumbered. If null, the renumbering will happen along the whole script.
    */
   renumberElements: function (aTag, parentNode) {
      var elements, length, index;

      elements = parentNode?parentNode.getElementsByTagName(aTag):this.m_scriptElement.getElementsByTagName(aTag);
      length = elements.length;
      for (index = 0; index < length; ++index) {
         /** @type {!Element} */ (elements[index]).
            setAttribute('seq', String(index + 1));
      }
   },



   // ===== Generic DOM tree primitives =====

   /**
    * Create an element for the script, but do not attach it anywhere.
    * @this {!DejaClick.Script}
    * @param {string} aName The desired tag of the new element.
    * @return {!Element} The new element.
    */
   domTreeCreateTemporaryNode: function (aName) {
      return this.m_document.createElement(aName);
   },

   /**
    * Create an element for the script and insert before reference node.
    * @this {!DejaClick.Script}
    * @return {!Element} The new element.
    */
   domTreeInsertBefore: function(parent, name, aNum, opt_text, opt_subscript) { 
      var rootElem = this.m_scriptElement;
      if (opt_subscript) {
         rootElem = this.m_actTreeRoots[opt_subscript];
      }
      var elems = rootElem.getElementsByTagName(name);
      var referenceNode = elems[aNum];
      var elt = this.m_document.createElement(name);
      if (opt_text !== undefined) {
         elt.appendChild(this.m_document.createTextNode(opt_text || ''));
      }	 
	  
      try {
         var insertedNode = parent.insertBefore(elt, referenceNode);
      }
      catch(e) {
         var insertedNode = parent.appendChild(elt);
      }		
      return insertedNode;
   },
   
   /**
    * Restores the original script, moving the events back to the end of the previous action (Step).
    * 
    * UXM-12095
    * 
    * @param {*} actionNum 
    */
   domTreeRemoveActionBreak: function(actionNum) {

      let logPrefix = '[Undo Step Break][Step Number '+actionNum+'] ';
      let managedError = false;

      if ( isNaN(actionNum) || actionNum <= 1 ) {
         let message = 'Invalid action number [Num='+actionNum+']. Expected action number 2 or higher. ';
         this.gDC.logger.logWarning(logPrefix+message);
         throw new Error(message);
      }

      try { 
         this.gDC.logger.logInfo(logPrefix+"Starting to remove step break");
         
         //Get action that has to be removed.
         let actionNode = this.getActionNode(actionNum);
         if ( actionNode == null ) {
            let error = 'Action not found [Num='+actionNum+']';
            this.gDC.logger.logWarning(logPrefix+error);
            managedError = true;
            throw new Error(error);
         }

         if ( ! actionNode.hasAttribute('stepbreak') ||  actionNode.getAttribute('stepbreak').toLowerCase() !==  'true' ) {
            let error = "Invalid action. It wasn't created as an step break";
            this.gDC.logger.logWarning(logPrefix+error);
            managedError = true;
            throw new Error(error);
         }

         //Get the previous action (where the events have to be moved)
         let previousNode = this.getActionNode(actionNum-1);
         if ( previousNode == null ) {
            let error = 'Previous action not found [Num='+(actionNum-1)+']';
            this.gDC.logger.logWarning(logPrefix+error);
            managedError = true;
            throw new Error(error);
         }

         //Move events from action 
         let actionEvents = actionNode.getElementsByTagName('event');
         let toBeMoved = [];
         //Using two loops, becuase removing the elements inside the first for loop was causing to lose one element.
         for (let i = 0; i < actionEvents.length; i++) {
            toBeMoved.push(actionEvents[i]);
         }
         toBeMoved.forEach(evt => {
            actionNode.removeChild(evt);
            previousNode.appendChild(evt);
         });

         //Remove the step break action
         previousNode.parentNode.removeChild(actionNode);

         //Renumber the actions
         this.renumberActions(0);

         this.gDC.logger.logInfo(logPrefix+"Done. Restored "+toBeMoved.length+" events to the end of the previous step.");
         
      } catch( e ) {
         if ( managedError ) {
            throw new Error(e);
         } else {
            this.gDC.logger.logWarning(logPrefix+'Unexpected error: '+e);
            throw new Error('Unexpected error: '+e);
         }
      }
   },


   /**
    * Modifies the script, reorganizing the steps, including a "step break" from 
    * the specified event.
    * 
    * In other words, creates a new action by splitting the action from the indicated
    * event number.
    * 
    * UXM-12095
    * 
    * @param {*} actionBreakName 
    * @param {*} eventNum 
    */
   domTreeInsertActionBreak: function(actionBreakName, eventNum) {
      let logPrefix = '[Insert Step Break][Step Number '+eventNum+'] ';
      let managedError = false;

      if ( isNaN(eventNum) || eventNum < 2 ) {
         let error = 'Invalid event number [Num='+eventNum+']. Expected event number 2 or higher.';
         this.gDC.logger.logWarning(logPrefix+error);
         throw new Error(error);
      }

      try { 
         this.gDC.logger.logInfo(logPrefix+"Starting to insert step break");

         //Get event where the break should be added.
         let eventNode = this.getEventNode(eventNum);
         if ( eventNode == null ) {
            let error = 'Event not found [Num='+eventNum+']';
            this.gDC.logger.logWarning(logPrefix+error);
            managedError = true;
            throw new Error(error);
         }

         //Get the event parent action. In other words, the action that will be split
         let parentAction = eventNode.parentNode;
         if ( ! parentAction ) { 
            let error = 'Parent action of event not found [Num='+eventNum+']';
            this.gDC.logger.logWarning(logPrefix+error);
            managedError = true;
            throw new Error(error);
         }
         let actionSeq = Number(parentAction.getAttribute('seq'));
         let parentOfActions = parentAction.parentNode;
         let listOfActions = parentOfActions.getElementsByTagName('action');
         
         //Create the new action (empty and with the received description)
         var newAction = this.m_document.createElement('action');
         newAction.setAttribute('type', parentAction.getAttribute('type'));
         newAction.setAttribute('seq', ""+(actionSeq+1));
         newAction.setAttribute('stepbreak', "true");
         if (actionBreakName !== undefined) {
            this.domTreeAddAttribute(newAction, 'description', actionBreakName);
         }

         let insteredActionNode = null;
         //Append the new action at the end of the event belongs to the last action
         if ( actionSeq == listOfActions.length ) {
            insteredActionNode = parentOfActions.appendChild(newAction);
         //Othewise, insert it before the next action
         } else {
            insteredActionNode = parentOfActions.insertBefore(newAction, parentOfActions.children[actionSeq]);
         }

         //Move events from old action to new one
         let eventSeq = Number(eventNode.getAttribute('seq'));
         let originalActionEvents = parentAction.getElementsByTagName('event');
         let toBeMoved = [];
         //Using two loops, becuase removing the elements inside the first for loop was causing to lose one element.
         for (let i = 0; i < originalActionEvents.length; i++) {
            if ( Number(originalActionEvents[i].getAttribute('seq')) >= eventSeq ) {
               toBeMoved.push(originalActionEvents[i]);
            }  
         }
         toBeMoved.forEach(evt => {
            parentAction.removeChild(evt);
            insteredActionNode.appendChild(evt);
         });

         //Renumber the actions
         this.renumberActions(0);

         this.gDC.logger.logInfo(logPrefix+"Step break created. Moved "+toBeMoved.length+" events to the new step.");
         
      } catch( e ) {
         if ( managedError ) {
            throw new Error(e);
         } else {
            this.gDC.logger.logWarning(logPrefix+'Unexpected error: '+e);
            throw new Error('Unexpected error: '+e);
         }
      }
   },
   /** 
   * Add a parameter to let the replay to know to skip the event
   * @param {integer} the sequence number in the script for replay
   */
   domTreeSkipEvent: function(eventNum){
      let eventNode = this.getEventNode(eventNum);
      eventNode.setAttribute('skipstep',true);
   },
   /** 
   * Remove the skipstep parameter to let the replay to play the event
   * @param {integer} the sequence number in the script for replay
   */
   domTreeRemoveSkipEvent: function(eventNum){
      let eventNode = this.getEventNode(eventNum);
      eventNode.removeAttribute('skipstep');
   },
   /**
    * Insert a new element with an optional text child.
    * @this {!DejaClick.Script}
    * @param {!Element} parent The desired parent of the new element.
    * @param {string} name The desired tag of the new element.
    * @param {string=} opt_text Text contents of the new element, if present.
    * @return {!Element} The new element.
    */
   domTreeInsertNode: function (parent, name, opt_text) {
      var elt = this.m_document.createElement(name);
      if (opt_text !== undefined) {
         elt.appendChild(this.m_document.createTextNode(opt_text || ''));
      }
      parent.appendChild(elt);
      return elt;
   },

   /**
    * Remove a node from its parent.
    * @param {!Node} node The node to be removed.
    * @return {?Node} The element to which the node belonged (or null if it
    *    was an orphan).
    */
   domTreeRemoveNode: function (node) {
      var parent = node.parentNode;
      if (parent !== null) {
         parent.removeChild(node);
      }
      return parent;
   },

   /**
    * Add a root-level element to the script.
    * @this {!DejaClick.Script}
    * @param {!Element} parent The desired parent of the new element.
    * @param {string} name The desired tag of the new element.
    * @param {string} type Value for the type attribute of the new element.
    * @return {!Element} The new root element.
    */
   domTreeCreateRoot: function (parent, name, type) {
      var root = this.domTreeInsertNode(parent, name);
      root.setAttribute('type', type);
      root.setAttribute('generated', new Date().toUTCString());
      if ((name === 'actions') && (type === 'record')) {
         this.m_actTreeRoots.push(root);
      }
      return root;
   },

   /**
    * Remove all children with the matching name and type.
    * @param {!Element} parent The parent of the element(s) to be removed.
    * @param {string} name The tag of the element(s) to be removed.
    * @param {string} type The value of the type attribute of the element(s)
    *    to be removed.
    */
   domTreeRemoveRoot: function (parent, name, type) {
      var child, next;
      child = parent.firstElementChild;
      while (child !== null) {
         next = child.nextElementSibling;
         if ((child.tagName === name) &&
               (child.getAttribute('type') === type)) {
            parent.removeChild(child);
         }
         child = next;
      }
   },

   /**
    * Find the first immediate child of an element with the specified tag.
    * @param {!Element} parent The element in which to search.
    * @param {string} tag The tag of the desired element.
    * @return {?Element} The matching element, or null if none.
    */
   getChildWithTag: function (parent, tag) {
      var child = parent.firstElementChild;
      while ((child !== null) && (child.tagName !== tag)) {
         child = child.nextElementSibling;
      }
      return child;
   },

   /**
    * Collection of names of parameters that can be changed without
    * affecting the script modified status.
    * @const
    */
   MUTABLE_PARAMETERS: {
      scriptstatus: true,
      urlfinalized: true,
      lctoken: true,
      rctoken: true
   },

   /**
    * Insert a new element for a parameter setting.
    * @this {!DejaClick.Script}
    * @param {!Element} parent The desired grandparent of the parameter.
    * @param {string} name The name of the parameter.
    * @param {string} value The value of the parameter.
    * @param {string} section The tag of the child
    *    element of parent to which the parameter will belong.
    * @param {string} tag The tag of the parameter element.
    * @param {string=} opt_modTag The name of the attribute to contain
    *    a time stamp.
    * @return {!Element} The new parameter element.
    */
   domTreeInsertParam: function (parent, name, value, section, tag,
         opt_modTag) {
      var sectionElt, paramElt;

      // Find or create the section element.
      sectionElt = this.getChildWithTag(parent, section);
      if (sectionElt === null) {
         sectionElt = this.domTreeInsertNode(parent, section);
      }

      paramElt = this.domTreeInsertNode(sectionElt, tag, value);
      paramElt.setAttribute('name', name);
      if (opt_modTag !== undefined) {
         paramElt.setAttribute(opt_modTag, Date.now());
      }
      if (!this.MUTABLE_PARAMETERS.hasOwnProperty(name)) {
         this.m_changesPending = true;
      }
      return paramElt;
   },

   /**
    * Change the value of an existing parameter setting or add it.
    * @this {!DejaClick.Script}
    * @param {!Element} parent The grandparent of the parameter.
    * @param {string} name The name of the parameter.
    * @param {string} value The new value of the parameter.
    * @param {string} section The tag of the child
    *    element of parent to which the parameter should belong.
    * @param {string} tag The tag of the parameter element.
    * @param {string=} opt_modTag The name of the attribute to contain
    *    a time stamp.
    * @return {boolean} true if the setting was change, false if it
    *    was added.
    */
   domTreeChangeParam: function (parent, name, value, section, tag,
         opt_modTag) {
      var sectionElt, paramElt, result;

      // Find the section element.
      // Find or create the section element.
      sectionElt = this.getChildWithTag(parent, section);
      if (sectionElt === null) {
         sectionElt = this.domTreeInsertNode(parent, section);
      }

      result = false;
      // Find the matching parameter element, if any.
      paramElt = sectionElt.firstElementChild;
      while (paramElt !== null) {
         if (paramElt.getAttribute('name') === name) {
            result = true;
            break;
         }
         paramElt = paramElt.nextElementSibling;
      }
      if (paramElt === null) {
         paramElt = this.domTreeInsertNode(sectionElt, tag, value);
         paramElt.setAttribute('name', name);
      } else {
         paramElt.textContent = value;
      }
      if (opt_modTag !== undefined) {
         paramElt.setAttribute(opt_modTag, Date.now());
      }
      if (!this.MUTABLE_PARAMETERS.hasOwnProperty(name)) {
         this.m_changesPending = true;
      }
      return result;
   },

   /**
    * Set the value of an existing parameter setting.
    * @this {!DejaClick.Script}
    * @param {!Element} parent The grandparent of the parameter.
    * @param {string} name The name of the parameter.
    * @param {string} value The new value of the parameter.
    * @param {string} section The tag of the child
    *    element of parent to which the parameter belongs.
    * @param {string=} opt_modTag The name of the attribute to contain
    *    a time stamp.
    * @return {boolean} true if the setting was found, false if not.
    */
   domTreeSetParam: function (parent, name, value, section, opt_modTag) {
      var sectionElt, paramElt;

      // Find the section element.
      sectionElt = this.getChildWithTag(parent, section);
      if (sectionElt !== null) {
         // Find the matching parameter element.
         paramElt = sectionElt.firstElementChild;
         while (paramElt !== null) {
            if (paramElt.getAttribute('name') === name) {
               paramElt.textContent = value;
               if (opt_modTag !== undefined) {
                  paramElt.setAttribute(opt_modTag, Date.now());
               }
               if (!this.MUTABLE_PARAMETERS.hasOwnProperty(name)) {
                  this.m_changesPending = true;
               }
               return true;
            }
            paramElt = paramElt.nextElementSibling;
         }
      }
      return false;
   },

   /**
    * Get the value (text content) of a parameter element.
    * @this {!DejaClick.Script}
    * @param {!Element} parent The grandparent of the parameter.
    * @param {string} name The name of the parameter.
    * @param {string} section The tag of the child
    *    element of parent to which the parameter belongs.
    * @return {?string} The value of the parameter, or null if it does
    *    not exist.
    */
   domTreeGetParam: function (parent, name, section) {
      var sectionElt, paramElt;

      // Find the section element.
      sectionElt = this.getChildWithTag(parent, section);
      if (sectionElt !== null) {
         // Find the matching parameter element.
         paramElt = sectionElt.firstElementChild;
         while (paramElt !== null) {
            if (paramElt.getAttribute('name') === name) {
               return paramElt.textContent;
            }
            paramElt = paramElt.nextElementSibling;
         }
      }
      return null;
   },

   /**
    * Determine whether a parameter with the given name exists.
    * @this {!DejaClick.Script}
    * @param {!Element} parent The grandparent of the parameter.
    * @param {string} name The name of the parameter.
    * @param {string} section The tag of the child
    *    element of parent to which the parameter belongs.
    * @param {string=} opt_modTag The name of an attribute that must
    *    be present on the parameter element.
    * @return {boolean} true if the parameter is present, false if not.
    */
   domTreeHasParam: function (parent, name, section, opt_modTag) {
      var sectionElt, paramElt;
      // Find the section element.
      sectionElt = this.getChildWithTag(parent, section);
      if (sectionElt !== null) {
	     // Find the matching parameter element.
         paramElt = sectionElt.firstElementChild;
         while (paramElt !== null) {
            if ((paramElt.getAttribute('name') === name) &&
                  ((opt_modTag === undefined) ||
                   paramElt.hasAttribute(opt_modTag))) {
               return true;
            }
            paramElt = paramElt.nextElementSibling;
         }
      }
      return false;
   },

   /**
    * Remove a parameter element.
    * @this {!DejaClick.Script}
    * @param {!Element} parent The grandparent of the parameter to remove.
    * @param {string} name The name of the parameter.
    * @param {string} section The tag of the child
    *    element of parent to which the parameter belongs.
    * @return {boolean} true if the parameter was removed, false if it did
    *    not exist.
    */
   domTreeRemoveParam: function (parent, name, section) {
      var sectionElt, paramElt;

      // Find the section element.
      sectionElt = this.getChildWithTag(parent, section);
      if (sectionElt !== null) {
         // Find the matching parameter element.
         paramElt = sectionElt.firstElementChild;
         while (paramElt !== null) {
            if (paramElt.getAttribute('name') === name) {
               sectionElt.removeChild(paramElt);
               if (!this.MUTABLE_PARAMETERS.hasOwnProperty(name)) {
                  this.m_changesPending = true;
               }
               return true;
            }
            paramElt = paramElt.nextElementSibling;
         }
      }
      return false;
   },


   // ===== Wrapper functions for specific types of parameters elements =====

   /**
    * Add a new dialog parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The desired grandparent of the dialog parameter.
    * @param {string} name The name of the parameter.
    * @param {string} val The value of the parameter.
    * @return {!Element} The new dialog parameter element.
    */
   domTreeAddDialogParam: function (elt, name, val) {
      return this.domTreeInsertParam(elt, name, val, 'dialogparams', 'param');
   },
   /**
    * Add or change a dialog parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The dialog element to which the parameter
    *    applies.
    * @param {string} name The name of the parameter.
    * @param {string} value The value of the parameter.
    * @return {boolean} true if the parameter was changed, false if added.
    */
   domTreeChangeDialogParam: function (elt, name, value) {
      return this.domTreeChangeParam(elt, name, value, 'dialogparams', 'param');
   },
   /**
    * Change the value of an existing dialog parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter element.
    * @param {string} name The name of the dialog parameter.
    * @param {string} value The new value of the dialog parameter.
    * @return {boolean} true if the parameter was found, false if not.
    */
   domTreeSetDialogParam: function (elt, name, value) {
      return this.domTreeSetParam(elt, name, value, 'dialogparams');
   },
   /**
    * Get the value (text content) of a dialog parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the dialog parameter.
    * @param {string} name The name of the dialog parameter.
    * @return {?string} The value of the parameter, or null if it does
    *    not exist.
    */
   domTreeGetDialogParam: function (elt, name) {
      return this.domTreeGetParam(elt, name, 'dialogparams');
   },
   /**
    * Determine whether a dialog parameter with the given name exists.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the dialog parameter.
    * @return {boolean} true if the parameter is present, false if not.
    */
   domTreeHasDialogParam: function (elt, name) {
      return this.domTreeHasParam(elt, name, 'dialogparams');
   },
   /**
    * Remove a dialog parameter element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter to remove.
    * @param {string} name The name of the dialog parameter.
    * @return {boolean} true if the parameter was removed, false if it did
    *    not exist.
    */
   domTreeDelDialogParam: function (elt, name) {
      return this.domTreeRemoveParam(elt, name, 'dialogparams');
   },

   /**
    * Add a new validation parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The desired grandparent of the validation
    *    parameter.
    * @param {string} name The name of the parameter.
    * @param {string} v The value of the parameter.
    * @return {!Element} The new validation parameter element.
    */
   domTreeAddValidateParam: function (elt, name, v) {
      return this.domTreeInsertParam(elt, name, v, 'validateparams', 'param');
   },
   /**
    * Add or change the value of an validation parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The validation element grandparent of the parameter.
    * @param {string} name The name of the validation parameter.
    * @param {string} v The new value of the parameter.
    * @return {boolean} true if the validation parameter was changed, false
    *    if added.
    */
   domTreeChangeValidateParam: function (elt, name, v) {
      return this.domTreeChangeParam(elt, name, v, 'validateparams', 'param');
   },
   /**
    * Change the value of an existing validation parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the parameter.
    * @param {string} value The new value of the parameter.
    * @return {boolean} true if the parameter was found, false if not.
    */
   domTreeSetValidateParam: function (elt, name, value) {
      return this.domTreeSetParam(elt, name, value, 'validateparams');
   },
   /**
    * Get the value (text content) of a validation parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the validation parameter.
    * @param {string} name The name of the validation parameter.
    * @return {?string} The value of the parameter, or null if it does
    *    not exist.
    */
   domTreeGetValidateParam: function (elt, name) {
      return this.domTreeGetParam(elt, name, 'validateparams');
   },
   /**
    * Determine whether a validation parameter with the given name exists.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the validation parameter.
    * @return {boolean} true if the parameter is present, false if not.
    */
   domTreeHasValidateParam: function (elt, name) {
      return this.domTreeHasParam(elt, name, 'validateparams');
   },
   /**
    * Remove a validation parameter element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter to remove.
    * @param {string} name The name of the validation parameter.
    * @return {boolean} true if the parameter was removed, false if it did
    *    not exist.
    */
   domTreeDelValidateParam: function (elt, name) {
      return this.domTreeRemoveParam(elt, name, 'validateparams');
   },

   /**
    * Add a new event parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The desired grandparent of the event parameter.
    * @param {string} name The name of the parameter.
    * @param {string} value The value of the parameter.
    * @return {!Element} The new event parameter element.
    */
   domTreeAddEventParam: function (elt, name, value) {
      return this.domTreeInsertParam(elt, name, value, 'eventparams', 'param');
   },
   /**
    * Add or change the value of an event parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the event parameter.
    * @param {string} value The new value of the parameter.
    * @return {boolean} true if the event parameter was changed, false if added.
    */
   domTreeChangeEventParam: function (elt, name, value) {
      return this.domTreeChangeParam(elt, name, value, 'eventparams', 'param');
   },
   /**
    * Change the value of an existing event parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the event parameter.
    * @param {string} value The new value of the parameter.
    * @return {boolean} true if the event parameter was found, false if not.
    */
   domTreeSetEventParam: function (elt, name, value) {
      return this.domTreeSetParam(elt, name, value, 'eventparams');
   },
   /**
    * Get the value (text content) of an event parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the event parameter.
    * @param {string} name The name of the event parameter.
    * @return {?string} The value of the parameter, or null if it does
    *    not exist.
    */
   domTreeGetEventParam: function (elt, name) {
      return this.domTreeGetParam(elt, name, 'eventparams');
   },
   /**
    * Determine whether an event parameter with the given name exists.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the event parameter.
    * @return {boolean} true if the parameter is present, false if not.
    */
   domTreeHasEventParam: function (elt, name) {
      return this.domTreeHasParam(elt, name, 'eventparams');
   },
   /**
    * Remove an event parameter element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter to remove.
    * @param {string} name The name of the event parameter.
    * @return {boolean} true if the parameter was removed, false if it did
    *    not exist.
    */
   domTreeDelEventParam: function (elt, name) {
      return this.domTreeRemoveParam(elt, name, 'eventparams');
   },

   /**
    * Add a new replay hint.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The desired grandparent of the replay hint.
    * @param {string} name The name of the hint.
    * @param {string} value The value of the hint.
    * @return {!Element} The new replay hint element.
    */
   domTreeAddReplayHint: function (elt, name, value) {
      return this.domTreeInsertParam(elt, name, value, 'replayhints', 'hint');
   },
   /**
    * Add or change the value of a replay hint.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the replay hint.
    * @param {string} name The name of the hint.
    * @param {string} value The value of the hint.
    * @return {boolean} true if the hint was changed, false if added.
    */
   domTreeChangeReplayHint: function (elt, name, value) {
      return this.domTreeChangeParam(elt, name, value, 'replayhints', 'hint');
   },
   /**
    * Change the value of an existing replay hint.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the hint.
    * @param {string} name The name of the hint.
    * @param {string} value The new value of the hint.
    * @return {boolean} true if the hint was found, false if not.
    */
   domTreeSetReplayHint: function (elt, name, value) {
      return this.domTreeSetParam(elt, name, value, 'replayhints');
   },
   /**
    * Get the value (text content) of a replay hint.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the replay hint.
    * @param {string} name The name of the replay hint.
    * @return {?string} The value of the hint, or null if it does not exist.
    */
   domTreeGetReplayHint: function (elt, name) {
      return this.domTreeGetParam(elt, name, 'replayhints');
   },
   /**
    * Determine whether a replay hint with the given name exists.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the hint.
    * @param {string} name The name of the replay hint.
    * @return {boolean} true if the hint is present, false if not.
    */
   domTreeHasReplayHint: function (elt, name) {
      return this.domTreeHasParam(elt, name, 'replayhints');
   },
   /**
    * Remove a replay hint element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the hint to remove.
    * @param {string} name The name of the replay hint.
    * @return {boolean} true if the hint was removed, false if it did
    *    not exist.
    */
   domTreeDelReplayHint: function (elt, name) {
      return this.domTreeRemoveParam(elt, name, 'replayhints');
   },

   /**
    * Add a new script attribute element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The desired grandparent of the attribute.
    * @param {string} name The name of the attribute.
    * @param {string} value The value of the attribute.
    * @param {string=} opt_modTag The name of the DOM attribute to assign
    *    a time stamp.
    * @return {!Element} The new attribute element.
    */
   domTreeAddAttribute: function (elt, name, value, opt_modTag) {
      return this.domTreeInsertParam(elt, name, value, 'attributes', 'attrib',
         opt_modTag);
   },
   /**
    * Add or change a script attribute element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The desired grandparent of the attribute.
    * @param {string} name The name of the attribute.
    * @param {string} value The value of the attribute.
    * @param {string=} opt_modTag The name of the DOM attribute to assign
    *    a time stamp.
    * @return {boolean} true if the element was changed, false if added.
    */
   domTreeChangeAttribute: function (elt, name, value, opt_modTag) {
      return this.domTreeChangeParam(elt, name, value, 'attributes', 'attrib',
         opt_modTag);
   },
   /**
    * Change the value of an existing script attribute.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the script attribute.
    * @param {string} name The name of the script attribute.
    * @param {string} value The new value of the attribute.
    * @param {string=} opt_modTag The name of the DOM attribute to assign
    *    a time stamp.
    * @return {boolean} true if the attribute was found, false if not.
    */
   domTreeSetAttribute: function (elt, name, value, opt_modTag) {
      return this.domTreeSetParam(elt, name, value, 'attributes', opt_modTag);
   },
   /**
    * Get the value (text content) of a script attribute.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the attribute.
    * @param {string} name The name of the script attribute.
    * @return {?string} The value of the attribute, or null if it does
    *    not exist.
    */
   domTreeGetAttribute: function (elt, name) {
      return this.domTreeGetParam(elt, name, 'attributes');
   },
   /**
    * Determine whether a script attribute with the given name exists.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the attribute.
    * @param {string} name The name of the script attribute.
    * @param {string=} opt_modTag The name of a DOM attribute that must
    *    be present in a matching element.
    * @return {boolean} true if the script attribute is present, false if not.
    */
   domTreeHasAttribute: function (elt, name, opt_modTag) {
      return this.domTreeHasParam(elt, name, 'attributes', opt_modTag);
   },
   /**
    * Remove a script attribute element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the attribute to remove.
    * @param {string} name The name of the script attribute.
    * @return {boolean} true if the attribute was removed, false if it did
    *    not exist.
    */
   domTreeDelAttribute: function (elt, name) {
      return this.domTreeRemoveParam(elt, name, 'attributes');
   },

   /**
    * Add a new preference element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The desired grandparent of the preference.
    * @param {string} name The name of the preference.
    * @param {string} value The value of the preference.
    * @param {string} type The type of data held by the preference.
    * @return {!Element} The new preference element.
    */
   domTreeAddPreference: function (elt, name, value, type) {
      return this.domTreeInsertParam(elt, name, value, type, 'pref');
   },
   /**
    * Change the value of an existing preference.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the preference.
    * @param {string} name The name of the preference.
    * @param {string} value The new value of the preference.
    * @param {string} type The type of data held by the preference.
    * @return {boolean} true if the preference was found, false if not.
    */
   domTreeSetPreference: function (elt, name, value, type) {
      return this.domTreeSetParam(elt, name, value, type);
   },
   /**
    * Get the value (text content) of a preference element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the preference.
    * @param {string} name The name of the preference.
    * @param {string} type The type of data held by the preference.
    * @return {?string} The value of the preference, or null if it does
    *    not exist.
    */
   domTreeGetPreference: function (elt, name, type) {
      return this.domTreeGetParam(elt, name, type);
   },
   /**
    * Determine whether a preference with the given name exists.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the preference.
    * @param {string} name The name of the preference.
    * @param {string} type The type of data held by the preference.
    * @return {boolean} true if the preference is present, false if not.
    */
   domTreeHasPreference: function (elt, name, type) {
      return this.domTreeHasParam(elt, name, type);
   },
   /**
    * Remove a preference element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the preference to remove.
    * @param {string} name The name of the preference.
    * @param {string} type The type of data held by the preference.
    * @return {boolean} true if the preference was removed, false if it did
    *    not exist.
    */
   domTreeDelPreference: function (elt, name, type) {
      return this.domTreeRemoveParam(elt, name, type + 'prefs');
   },

   /**
    * Add a new url mask parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The desired grandparent of the url mask parameter.
    * @param {string} name The name of the parameter.
    * @param {string} val The value of the parameter.
    * @return {!Element} The new url mask parameter element.
    */
   domTreeAddUrlMaskParam: function (elt, name, val) {
      return this.domTreeInsertParam(elt, name, val, 'urlmaskparams', 'param');
   },
   /**
    * Add or change a url mask parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The urlmask element to which the parameter applies.
    * @param {string} name The name of the parameter.
    * @param {string} value The value of the parameter.
    * @return {boolean} true if the parameter was changed, false if added.
    */
   domTreeChangeUrlMaskParam: function (elt, name, value) {
      return this.domTreeChangeParam(elt, name, value,
         'urlmaskparams', 'param');
   },
   /**
    * Change the value of an existing url mask parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the url mask parameter.
    * @param {string} value The new value of the parameter.
    * @return {boolean} true if the parameter was found, false if not.
    */
   domTreeSetUrlMaskParam: function (elt, name, value) {
      return this.domTreeSetParam(elt, name, value, 'urlmaskparams');
   },
   /**
    * Get the value (text content) of a url mask parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the url mask parameter.
    * @param {string} name The name of the url mask parameter.
    * @return {?string} The value of the parameter, or null if it does
    *    not exist.
    */
   domTreeGetUrlMaskParam: function (elt, name) {
      return this.domTreeGetParam(elt, name, 'urlmaskparams');
   },
   /**
    * Determine whether a url mask parameter with the given name exists.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the url mask parameter.
    * @return {boolean} true if the parameter is present, false if not.
    */
   domTreeHasUrlMaskParam: function (elt, name) {
      return this.domTreeHasParam(elt, name, 'urlmaskparams');
   },
   /**
    * Remove a url mask parameter element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter to remove.
    * @param {string} name The name of the url mask parameter.
    * @return {boolean} true if the parameter was removed, false if it did
    *    not exist.
    */
   domTreeDelUrlMaskParam: function (elt, name) {
      return this.domTreeRemoveParam(elt, name, 'urlmaskparams');
   },

   /**
    * Add a new header parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The desired grandparent of the header parameter.
    * @param {string} name The name of the parameter.
    * @param {string} val The value of the parameter.
    * @return {!Element} The new header parameter element.
    */
   domTreeAddHeaderParam: function (elt, name, val) {
      return this.domTreeInsertParam(elt, name, val, 'headerparams', 'param');
   },
   /**
    * Add or change a header parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The header element to which the parameter applies.
    * @param {string} name The name of the parameter.
    * @param {string} value The value of the parameter.
    * @return {boolean} true if the parameter was changed, false if added.
    */
   domTreeChangeHeaderParam: function (elt, name, value) {
      return this.domTreeChangeParam(elt, name, value,
         'headerparams', 'param');
   },
   /**
    * Change the value of an existing header parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the header parameter.
    * @param {string} value The new value of the parameter.
    * @return {boolean} true if the parameter was found, false if not.
    */
   domTreeSetHeaderParam: function (elt, name, value) {
      return this.domTreeSetParam(elt, name, value, 'headerparams');
   },
   /**
    * Get the value (text content) of a header parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the header parameter.
    * @param {string} name The name of the header parameter.
    * @return {?string} The value of the parameter, or null if it does
    *    not exist.
    */
   domTreeGetHeaderParam: function (elt, name) {
      return this.domTreeGetParam(elt, name, 'headerparams');
   },
   /**
    * Determine whether a header parameter with the given name exists.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the header parameter.
    * @return {boolean} true if the parameter is present, false if not.
    */
   domTreeHasHeaderParam: function (elt, name) {
      return this.domTreeHasParam(elt, name, 'headerparams');
   },
   /**
    * Remove a header parameter element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter to remove.
    * @param {string} name The name of the header parameter.
    * @return {boolean} true if the parameter was removed, false if it did
    *    not exist.
    */
   domTreeDelHeaderParam: function (elt, name) {
      return this.domTreeRemoveParam(elt, name, 'headerparams');
   },

   /**
    * Add a new note parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The desired grandparent of the note parameter.
    * @param {string} name The name of the parameter.
    * @param {string} value The value of the parameter.
    * @return {!Element} The new note parameter element.
    */
   domTreeAddNoteParam: function (elt, name, value) {
      return this.domTreeInsertParam(elt, name, value, 'noteparams', 'param');
   },
   /**
    * Change the value of an existing note parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the note parameter.
    * @param {string} value The new value of the parameter.
    * @return {boolean} true if the parameter was found, false if not.
    */
   domTreeSetNoteParam: function (elt, name, value) {
      return this.domTreeSetParam(elt, name, value, 'noteparams');
   },
   /**
    * Get the value (text content) of a note parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the note parameter.
    * @param {string} name The name of the note parameter.
    * @return {?string} The value of the parameter, or null if it does
    *    not exist.
    */
   domTreeGetNoteParam: function (elt, name) {
      return this.domTreeGetParam(elt, name, 'noteparams');
   },
   /**
    * Determine whether a note parameter with the given name exists.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the note parameter.
    * @return {boolean} true if the parameter is present, false if not.
    */
   domTreeHasNoteParam: function (elt, name) {
      return this.domTreeHasParam(elt, name, 'noteparams');
   },
   /**
    * Remove a note parameter element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter to remove.
    * @param {string} name The name of the note parameter.
    * @return {boolean} true if the parameter was removed, false if it did
    *    not exist.
    */
   domTreeDelNoteParam: function (elt, name) {
      return this.domTreeRemoveParam(elt, name, 'noteparams');
   },

   /**
    * Add a new file list parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The desired grandparent of the file list parameter.
    * @param {string} name The name of the parameter.
    * @param {string} v The value of the parameter.
    * @return {!Element} The new file list parameter element.
    */
   domTreeAddFileListParam: function (elt, name, v) {
      return this.domTreeInsertParam(elt, name, v, 'filelistparams', 'param');
   },
   /**
    * Change the value of an existing file list parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the file list parameter.
    * @param {string} value The new value of the parameter.
    * @return {boolean} true if the parameter was found, false if not.
    */
   domTreeSetFileListParam: function (elt, name, value) {
      return this.domTreeSetParam(elt, name, value, 'filelistparams');
   },
   /**
    * Get the value (text content) of a file list parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the file list parameter.
    * @return {?string} The value of the parameter, or null if it does
    *    not exist.
    */
   domTreeGetFileListParam: function (elt, name) {
      return this.domTreeGetParam(elt, name, 'filelistparams');
   },
   /**
    * Determine whether a file list parameter with the given name exists.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the file list parameter.
    * @return {boolean} true if the parameter is present, false if not.
    */
   domTreeHasFileListParam: function (elt, name) {
      return this.domTreeHasParam(elt, name, 'filelistparams');
   },
   /**
    * Remove a file list parameter element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter to remove.
    * @param {string} name The name of the file list parameter.
    * @return {boolean} true if the parameter was removed, false if it did
    *    not exist.
    */
   domTreeDelFileListParam: function (elt, name) {
      return this.domTreeRemoveParam(elt, name, 'filelistparams');
   },

   /**
    * Add a new branch parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The desired grandparent of the branch parameter.
    * @param {string} name The name of the parameter.
    * @param {string} val The value of the parameter.
    * @return {!Element} The new branch parameter element.
    */
   domTreeAddBranchParam: function (elt, name, val) {
      return this.domTreeInsertParam(elt, name, val, 'branchparams', 'param');
   },
   /**
    * Add or change a branch parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The branch element to which the parameter
    *    applies.
    * @param {string} name The name of the parameter.
    * @param {string} value The value of the parameter.
    * @return {boolean} true if the parameter was changed, false if added.
    */
   domTreeChangeBranchParam: function (elt, name, value) {
      return this.domTreeChangeParam(elt, name, value,
         'branchparams', 'param');
   },
   /**
    * Change the value of an existing branch parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the branch parameter.
    * @param {string} value The new value of the parameter.
    * @return {boolean} true if the parameter was found, false if not.
    */
   domTreeSetBranchParam: function (elt, name, value) {
      return this.domTreeSetParam(elt, name, value, 'branchparams');
   },
   /**
    * Get the value (text content) of a branch parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the branch parameter.
    * @param {string} name The name of the branch parameter.
    * @return {?string} The value of the parameter, or null if it does
    *    not exist.
    */
   domTreeGetBranchParam: function (elt, name) {
      return this.domTreeGetParam(elt, name, 'branchparams');
   },
   /**
    * Determine whether a branch parameter with the given name exists.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the branch parameter.
    * @return {boolean} true if the parameter is present, false if not.
    */
   domTreeHasBranchParam: function (elt, name) {
      return this.domTreeHasParam(elt, name, 'branchparams');
   },
   /**
    * Remove a branch parameter element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter to remove.
    * @param {string} name The name of the branch parameter.
    * @return {boolean} true if the parameter was removed, false if it did
    *    not exist.
    */
   domTreeDelBranchParam: function (elt, name) {
      return this.domTreeRemoveParam(elt, name, 'branchparams');
   },

   /**
    * Add a new ContentView parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The contentview element to which the
    *    parameter applies.
    * @param {string} name The name of the parameter.
    * @param {string} val The value of the parameter.
    * @return {!Element} The new ContentView parameter element.
    */
   domTreeAddContentViewParam: function (elt, name, val) {
      return this.domTreeInsertParam(elt, name, val,
         'contentviewparams', 'param');
   },
   /**
    * Add or change a ContentView parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The contentview element to which the parameter
    *    applies.
    * @param {string} name The name of the parameter.
    * @param {string} value The value of the parameter.
    * @return {boolean} true if the parameter was changed, false if added.
    */
   domTreeChangeContentViewParam: function (elt, name, value) {
      return this.domTreeChangeParam(elt, name, value,
         'contentviewparams', 'param');
   },
   /**
    * Change the value of an existing ContentView parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The contentview element to which the parameter
    *    applies.
    * @param {string} name The name of the ContentView parameter.
    * @param {string} value The new value of the parameter.
    * @return {boolean} true if the parameter was found, false if not.
    */
   domTreeSetContentViewParam: function (elt, name, value) {
      return this.domTreeSetParam(elt, name, value, 'contentviewparams');
   },
   /**
    * Get the value (text content) of a ContentView parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the ContentView parameter.
    * @param {string} name The name of the ContentView parameter.
    * @return {?string} The value of the parameter, or null if it does
    *    not exist.
    */
   domTreeGetContentViewParam: function (elt, name) {
      return this.domTreeGetParam(elt, name, 'contentviewparams');
   },
   /**
    * Determine whether a ContentView parameter with the given name exists.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The ContentView to be searched for the parameter.
    * @param {string} name The name of the ContentView parameter.
    * @return {boolean} true if the parameter is present, false if not.
    */
   domTreeHasContentViewParam: function (elt, name) {
      return this.domTreeHasParam(elt, name, 'contentviewparams');
   },
   /**
    * Remove a ContentView parameter element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The contentview element from which the parameter
    *    is to be removed.
    * @param {string} name The name of the ContentView parameter.
    * @return {boolean} true if the parameter was removed, false if it did
    *    not exist.
    */
   domTreeDelContentViewParam: function (elt, name) {
      return this.domTreeRemoveParam(elt, name, 'contentviewparams');
   },

   /**
    * Add a new variable parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The desired grandparent of the variable
    *    parameter.
    * @param {string} name The name of the parameter.
    * @param {string} v The value of the parameter.
    * @return {!Element} The new variable parameter element.
    */
   domTreeAddVariableParam: function (elt, name, v) {
      return this.domTreeInsertParam(elt, name, v, 'varparams', 'param');
   },
   /**
    * Add or change the value of an variable parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The variable element grandparent of the parameter.
    * @param {string} name The name of the variable parameter.
    * @param {string} v The new value of the parameter.
    * @return {boolean} true if the variable parameter was changed, false
    *    if added.
    */
   domTreeChangeVariableParam: function (elt, name, v) {
      return this.domTreeChangeParam(elt, name, v, 'varparams', 'param');
   },
   /**
    * Change the value of an existing variable parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the parameter.
    * @param {string} value The new value of the parameter.
    * @return {boolean} true if the parameter was found, false if not.
    */
   domTreeSetVariableParam: function (elt, name, value) {
      return this.domTreeSetParam(elt, name, value, 'varparams');
   },
   /**
    * Get the value (text content) of a variable parameter.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the variable parameter.
    * @param {string} name The name of the variable parameter.
    * @return {?string} The value of the parameter, or null if it does
    *    not exist.
    */
   domTreeGetVariableParam: function (elt, name) {
      return this.domTreeGetParam(elt, name, 'varparams');
   },
   /**
    * Determine whether a variable parameter with the given name exists.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter.
    * @param {string} name The name of the variable parameter.
    * @return {boolean} true if the parameter is present, false if not.
    */
   domTreeHasVariableParam: function (elt, name) {
      return this.domTreeHasParam(elt, name, 'varparams');
   },
   /**
    * Remove a variable parameter element.
    * @this {!DejaClick.Script}
    * @param {!Element} elt The grandparent of the parameter to remove.
    * @param {string} name The name of the variable parameter.
    * @return {boolean} true if the parameter was removed, false if it did
    *    not exist.
    */
   domTreeDelVariableParam: function (elt, name) {
      return this.domTreeRemoveParam(elt, name, 'varparams');
   },

   // ===== Search functions =====

   /**
    * Find elements using XPath.
    * @private
    * @this {!DejaClick.Script}
    * @param {!Element} elt The element of the script from which to
    *    begin the search.
    * @param {string} expr An XPath expression.
    * @return {!Array.<!Element>} List of matching elements.
    */
   processXPath: function (elt, expr) {
      var snapshot, result, index;
      // Closure would like this.m_document to be an XPathEvaluator.
      snapshot = /** @type {!XPathResult} */ (this.m_document.evaluate(expr,
         elt, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null));
      result = [];
      for (index = 0; index < snapshot.snapshotLength; ++index) {
         result.push(snapshot.snapshotItem(index));
      }
      return result;
   },

   /**
    * Use XPath to determine the presence of a node in the script.
    * @private
    * @this {!DejaClick.Script}
    * @param {!Element} elt The element of the script from which to
    *    begin the search.
    * @param {string} expr An XPath expression.
    * @return {boolean} true if the expression denotes at least one node.
    */
   processXPathPresence: function (elt, expr) {
      // Closure would like this.m_document to be an XPathEvaluator.
      return this.m_document.evaluate(expr, elt, null,
         XPathResult.ANY_UNORDERED_NODE_TYPE, null).singleNodeValue !== null;
   },

   /**
    * Evaluate an XPath expression that returns a number.
    * @private
    * @this {!DejaClick.Script}
    * @param {!Element} elt The element of the script from which to
    *    begin the search.
    * @param {string} expr An XPath expression.
    * @return {integer} The result of the XPath evaluation.
    */
   processXPathCount: function (elt, expr) {
      // Closure would like this.m_document to be an XPathEvaluator.
      return this.m_document.evaluate(expr, elt, null,
         XPathResult.NUMBER_TYPE, null).numberValue;
   },

   /**
    * Evaluate an XPath expression that returns a string.
    * @private
    * @this {!DejaClick.Script}
    * @param {!Element} elt The element of the script from which to
    *    begin the serach.
    * @param {string} expr An XPath expression.
    * @return {string} The result of the XPath evaluation.
    */
   processXPathString: function (elt, expr) {
      return this.m_document.evaluate(expr, elt, null,
         XPathResult.STRING_TYPE, null).stringValue;
   },

   /**
    * Evaluate an XPath expression that returns a single node.
    * @private
    * @this {!DejaClick.Script}
    * @param {!Element} elt The element of the script from which to
    *    begin the serach.
    * @param {string} expr An XPath expression.
    * @return {?Element} The first node resulting from the XPath evaluation,
    *    or null if it returned an empty set.
    */
   processXPathFirstNode: function (elt, expr) {
      return this.m_document.evaluate(expr, elt, null,
         XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
   },

   /**
    * Determine whether the script USES any script variables.
    * @this {!DejaClick.Script}
    * @return {boolean} true if the script uses script variables.
    */
   usesScriptVariables: function () {
      return this.processXPathPresence(this.m_scriptElement,
         'descendant::param[@name="varreference"]/text()');
   },

   /**
    * Determine whether the script is encrypted.
    * @this {!DejaClick.Script}
    * @return {boolean} true if the script is encrypted.
    */
   isEncrypted: function () {
      return this.domTreeHasAttribute(this.m_scriptElement, 'lctoken') ||
         this.domTreeHasAttribute(this.m_scriptElement, 'rctoken');
   },

   /**
    * Determine whether the script contains any data that should
    * be encrypted.
    * @this {!DejaClick.Script}
    * @param {boolean} aAnyInput If true, all text input should be
    *    encrypted. If false, only password values should be encrypted.
    * @return {boolean} true if the script contains any data that should
    *    be encrypted.
    */
   needsEncryption: function (aAnyInput) {
      var events, index, event;
      events = this.processXPath(this.m_scriptElement,
         '//actions[@type="record"]//event[@type="change"]');
      index = events.length;
      while (index !== 0) {
         --index;
         event = events[index];
         // Check crumbs for inputs and eventparams for values.
         if (this.isInputEvent(event, aAnyInput) &&
               (this.domTreeHasEventParam(event, 'value') ||
                this.domTreeHasEventParam(event, 'keycodes') ||
                this.domTreeHasEventParam(event, 'varreference'))) {
            return true;
         }
      }
      return false;
   },

   /**
    * Collection of tags identifying input elements.
    * @const
    */
   INPUT_TAGS: {
      textarea: true,
      TEXTAREA: true,
      object: true,
      OBJECT: true,
      embed: true,
      EMBED: true
   },

   /**
    * Determine whether the target element of an event is an input element
    * that should be encrypted.
    * @this {!DejaClick.Script}
    * @param {!Element} aEvent The event in question.
    * @param {boolean} aAnyInput If true, all text input elements should
    *    be encrypted. If false, only password inputs should be encrypted.
    * @return {boolean} true if the event's target is an input element
    *   that should be encrypted.
    */
   isInputEvent: function (aEvent, aAnyInput) {
      var crumbs, index, crumb, type;
      crumbs = this.processXPath(aEvent, '//target[@type="element"]//crumb');
      index = crumbs.length;
      while (index !== 0) {
         --index;
         crumb = crumbs[index];
         type = this.domTreeGetAttribute(crumb, 'type');
         if (type === 'password') {
            return true;
         } else if (aAnyInput) {
            if ((type === 'text') ||
                  this.INPUT_TAGS.hasOwnProperty(crumb.getAttribute('tag'))) {
               return true;
            }
         }
      }
      return false;
   },

   /**
    * Get the password digest for encrypting the script locally. This
    * digest is also used when running the script on an AlertSite
    * server. In this case, it should be equivalent to the remote
    * password digest. The best explanation that I have for this is
    * that it simplifies manual testing of encrypted customer
    * transactions.
    * @this {!DejaClick.Script}
    * @return {?string} Digest of the password for this script.
    *    null if no encryption is needed.
    */
   getLocalPasswordDigest: function() {
      return this.domTreeGetAttribute(this.m_scriptElement, 'lctoken');
   },

   /**
    * Get the password digest for encrypting the script for remote
    * upload and download.
    * @this {!DejaClick.Script}
    * @return {?string} Digest of the password for this script.
    *    null if no encryption is needed.
    */
   getRemotePasswordDigest: function() {
      return this.domTreeGetAttribute(this.m_scriptElement, 'rctoken');
   },

   /**
    * Determine whether the script USES a script variable for an
    * elementpath value.
    * @this {!DejaClick.Script}
    * @return {boolean} true if the script uses a script variable to
    *    create an elementpath value.
    */
   usesScriptVariableInElementPath: function () {
      return this.processXPathPresence(this.m_scriptElement,
         'descendant::elementpath[@varreference="true"]/text()');
   },

   /**
    * Determine whether the script has a focus event.
    * @this {!DejaClick.Script}
    * @return {boolean} true if the script has a focus event.
    */
   hasFocusEvents: function () {
      return this.processXPathPresence(this.m_scriptElement,
         'descendant::event[@type="focus"]');
   },

   /**
    * Determine whether the script contains any screen events.
    * @this {!DejaClick.Script}
    * @return {boolean} true if the script has a screen event.
    */
   hasScreenEvents: function () {
      return this.processXPathPresence(this.m_scriptElement,
         'descendant::event[@screen="true"]');
   },

   /**
    * Determine whether the script was recorded using mobile simulation mode.
    * @this {!DejaClick.Script}
    * @return {boolean} true if the script was recorded in mobile
    *    simulation mode.
    */
   isMobileSimulation: function () {
      return this.domTreeHasAttribute(this.m_scriptElement, 'simulatemobile');
   },

   /**
    * Determine whether the script USES keyboard events.
    * @this {!DejaClick.Script}
    * @return {boolean} true if the script has keyboard events.
    */
   usesKeyboardEvents: function () {
      return this.processXPathPresence(this.m_scriptElement,
         'descendant::event[@type="keyboard"]');
   },

   /**
    * Determine whether the script USES file lists.
    * @this {!DejaClick.Script}
    * @return {boolean} true if the script uses file lists.
    */
   usesFileLists: function () {
      return this.processXPathPresence(this.m_scriptElement,
         'descendant::param[@name="filelistref"]/text()');
   },

   /**
    * Determine whether the script USES downloads feature or not
    * @this {!DejaClick.Script}
    * @return {boolean} true if the script uses downloads.
    */
   usesDownloads: function () {
      return this.processXPathPresence(this.m_scriptElement,
         'descendant::param[@name="downloads"]/text()');
   },

   /** 
    * Determine whether the script USES mousedown events.
    * @this {!DejaClick.Script}
    * @return {boolean} true if the script has mousedown events.
    */
   usesMouseDown: function () {
      return this.processXPathPresence(this.m_scriptElement,
         'descendant::event[@type="mousedown"]');
   },

   /** 
    * Determine whether the script USES dialog prompts.
    * @this {!DejaClick.Script}
    * @return {boolean} true if the script has dialog prompts configured.
    */
   usesDialogPrompts: function () {
      return this.processXPathPresence(this.m_scriptElement,
         'descendant::dialogs');
   },

   /**
    * Determine whether the script uses image validation.
    * @this {!DejaClick.Script}
    * @return {boolean} true if the script uses image validation.
    */
   hasImageValidation: function () {
      return this.processXPathPresence(this.m_scriptElement,
         'descendant::validation[@type=3]');
   },

   /**
    * Determine whether the script uses branching.
    * @this {!DejaClick.Script}
    * @return {boolean} true if the script uses branching.
    */
   hasBranching: function () {
      return this.processXPathPresence(this.m_scriptElement,
         'descendant::branches|descendant::subscripts');
   },

   /**
    * Determine whether the script USES cookies.
    * @this {!DejaClick.Script}
    * @return {boolean} true if the script uses cookies.
    */
   usesCookies: function () {
      return this.processXPathPresence(this.m_scriptElement,
         'child::cookies/cookie');
   },

   /**
    * Determine whether the script uses triggers.
    * @this {!DejaClick.Script}
    * @return {boolean} true if the script uses triggers.
    */
   hasTriggers: function () {
      return this.processXPathPresence(this.m_scriptElement,
         'descendant::trigger');
   },

   /**
    * Get the total number of events in the script.
    * @this {!DejaClick.Script}
    * @return {integer} The number of events.
    */
   getTotalEventCount: function () {
      var count, index;
      count = 0;
      index = this.m_actTreeRoots.length;
      while (index !== 0) {
         --index;
         count +=
            this.m_actTreeRoots[index].getElementsByTagName('event').length;
      }
      return count;
   },

   /**
    * check if the selected event is the last event of the script.
    * @this {!DejaClick.Script}
    * @return {integer} The number of events.
    */
   checkIfLastEvent: function (scriptIndx , eventIndx) {
      var event_count = this.m_actTreeRoots[scriptIndx].getElementsByTagName('event').length;
      if(event_count == eventIndx)  {
            return true;
      } else {
            return false;
      }   
   },

   /**
    * Get the number of recorded actions in the script.
    * @this {!DejaClick.Script}
    * @return {integer} The number of actions.
    */
   getTotalActionCount: function () {
      return this.processXPathCount(this.m_scriptElement,
         'count(child::actions[@type="record"]/action)');
   },

   /**
    * Set the script's description attribute if it does not already have
    * a value.
    * @this {!DejaClick.Script}
    * @param {string} aDescription The new description.
    */
   updateMissingDescription: function (aDescription) {
      var description;

      description =
         this.domTreeGetAttribute(this.m_scriptElement, 'description');
      if ((description == null) || (description.length === 0)) {
         this.domTreeChangeAttribute(this.m_scriptElement, 'description',
            aDescription);
      }
   },


   /**
    * Build a list of the features used by this script.
    * @this {!DejaClick.Script}
    * @return {!Array.<string>}
    */
   getUsedFeatures: function () {
      var features = [];
      if (this.usesScriptVariables()) {
         features.push('script variables');
      }
      if (this.isEncrypted()) {
         features.push('encryption');
      }
      if (this.usesScriptVariableInElementPath()) {
         features.push('elementpath variables');
      }
      if (this.hasFocusEvents()) {
         features.push('focus');
      }
      if (this.hasScreenEvents()) {
         features.push('TrueScreen');
      }
      if (this.usesKeyboardEvents()) {
         features.push('keyboard_events');
      }
      if (this.isMobileSimulation()) {
         features.push('mobile');
      }
      if (this.usesFileLists()) {
         features.push('filelist');
      }
      if (this.usesDownloads()) {
         features.push('downloads');
      }
      if (this.hasImageValidation()) {
         features.push('image validation');
      }
      if (this.hasBranching()) {
         features.push('branching');
      }
      if (this.usesMouseDown()) {
         features.push('mousedown');
      }
      if (this.usesCookies()) {
         features.push('cookies');
      }
      if (this.hasTriggers()) {
         features.push('triggers');
      }
      return features;
   },

   /**
    * Remove all eventtimeout event attributes that were created
    * by the replay advisor.
    * @this {!DejaClick.Script}
    */
   removeReplayAdvisorEventTimeouts: function () {
      var elts, index;
      elts = this.processXPath(this.m_scriptElement, 'descendant::event/' +
         'attributes/attrib[@name="eventtimeout"and(not(@modifiedbyuser))]');
      index = elts.length;
      while (index !== 0) {
         --index;
         this.domTreeRemoveNode(elts[index]);
      }
   },


   // ===== Script creation methods =====

   /**
    * Create a new script.
    * @this {!DejaClick.Script}
    * @param {!DOMImplementation} domImpl Factory for documents.
    * @return {!DejaClick.Script} this
    */
   createScript: function (domImpl) {
      var doc = domImpl.createDocument('','',null);
      if (doc == null) {
         throw new Error('Failed to create script document.');
      }
      this.m_document = doc;
      this.m_scriptElement = this.m_document.createElement('script');
      this.m_document.appendChild(this.m_scriptElement);
      this.m_filename = '';
      this.m_actTreeRoots.length = 0;
      this.m_changesPending = false;

      this.domTreeAddAttribute(this.m_scriptElement, 'scriptname', '');
      this.domTreeAddAttribute(this.m_scriptElement, 'description', '');
      this.domTreeAddAttribute(this.m_scriptElement, 'company', 'SmartBear Software Inc');
      this.domTreeAddAttribute(this.m_scriptElement, 'appname', 'Deja');
      this.domTreeAddAttribute(this.m_scriptElement, 'scripttype', ( typeof browser !== "undefined" )?'DejaClick for Firefox':'DejaClick for Chrome');
      return this;
   },

   /**
    * Collection of feature names that are supported by this extension.
    * These should match the feature names in getUsedFeatures.
    * This list may become variable if optional extensions like
    * TrueScreen become supported.
    * @const
    */

   SUPPORTED_FEATURES: {
      focus: true, 
      encryption: true, 
      variables : true, 
      "elementpath variables" : true, 
      "script variables" : true, 
      //TODO Firefox Quantum UXM-11026 - Mobile simulation not supported for Firefox Quantum
      mobile : typeof browser !== "undefined"?false:true, 
      branching : true,
      filelist: true,
      downloads: true,
      //TODO Firefox Quantum UXM-11026 - Keystrokes not supported for Firefox Quantum
      keyboard_events: typeof browser !== "undefined"?false:true,
      mousedown: true,
      //TODO Firefox Quantum UXM-11026 - Dialog prompts not supported for Firefox Quantum
      dialog_prompts : typeof browser !== "undefined"?false:true, 
      cookies: true,
      triggers: true
   },

   /**
    * Determine whether the script is appropriate for uploading.
    * @this {!DejaClick.Script}
    * @return {string} not null if the script validation fails.
    */
   isUploadable :  function(){
      var scriptStatus = this.getScriptStatus();
      var error;
      if (!scriptStatus) {
         // no replay status -- can't upload
         error = 'dcMessage_unverifiedScript';
         return error;
      }
    
      // check if the script contains any keyword validations
      var hasKeywords = false;
      var valNodes = this.getScriptElement().getElementsByTagName('validation');
      for (var i=0; i < valNodes.length; i++) {
         if (valNodes[i].getAttribute('type') == DejaClick.constants.VALIDATION_TYPE_KEYWORD) {
            hasKeywords = true;
            break;
         }
      }

      if (!hasKeywords) {
         // confirm before upload if no (keyword) validations are available
         error = 'dcMessage_warnKeywordsUpload';
         this.setScriptStatus(scriptStatus);
         return error;
         // no keywords, but user wants to upload anyway
      }

      if (scriptStatus != "scriptCheck" && scriptStatus != "scriptWarn") {
         error = 'dcMessage_warnUnverifiedUpload';
         return error;
      }

      this.setScriptStatus(scriptStatus);

      return null;
   },
   
   /**
    * Validate the document tree, ensuring that it has the expected structure.
    * @private
    * @this {!DejaClick.Script}
    * @return {string} Description of any error detected in the document.
    *    An empty string if successful.
    */
   validate: function () {
      var elts, features, missing, index, elt;

      elts = this.m_document.getElementsByTagName('script');
      if (elts.length !== 1) {
         return 'Corrupt or invalid script file. Missing script element.';
      }
      this.m_scriptElement = /** @type {!Element} */ (elts[0]);

      features = this.domTreeGetAttribute(this.m_scriptElement, 'rfeatures');
      if (features === '') {
         features = [];
      } else if (features !== null) {
         features = decodeURIComponent(features).split(',');
      } else {
         features = this.getUsedFeatures();
      }

      //TODO Firefox Quantum UXM-11026 - Dialog prompts not supported
      if ( typeof browser !== "undefined" && this.usesDialogPrompts() ) {
         features.push('dialog_prompts');
      }

      missing = [];
      index = features.length;
      while (index !== 0) {
         --index;
         if (!this.SUPPORTED_FEATURES.hasOwnProperty(features[index]) 
               || ! this.SUPPORTED_FEATURES[features[index]] )  
         {
            missing.push(features[index]);
         } 
      }
      if (missing.length !== 0) {
         return 'Requires unsupported DejaClick features: ' +
            missing.join(', ');
      }

      this.m_actTreeRoots.length = 0;
      elts = this.m_scriptElement.getElementsByTagName('actions');
      for (index = 0; index < elts.length; ++index) {
         elt = /** @type {!Element} */ (elts[index]);
         if (elt.getAttribute('type') === 'record') {
            this.m_actTreeRoots.push(elt);
         }
      }

      if ((this.m_actTreeRoots.length === 0) ||
          (this.m_actTreeRoots[0].getElementsByTagName('event').length === 0)) {
         return 'Script has no events';
      }
      return '';
   },

   /**
    * Reload the variables m_scriptElement and m_actTreeRoots from the script document.
    * 
    * This function should be called after the deletion of elements, such as 
    * subscripts, so be sure that the m_actTreeRoots variable that is used
    * for replay (at dejaService.js) has the correct content.
    * 
    */
   reloadScriptAndSubscripts: function () {
      var elts, elt;
      try {
         elts = this.m_document.getElementsByTagName('script');
         if (elts.length !== 1) {
            throw new Error('Corrupt or invalid script file. Missing script element.');
         }
         this.m_scriptElement = /** @type {!Element} */ (elts[0]);

         this.m_actTreeRoots.length = 0;
         elts = this.m_scriptElement.getElementsByTagName('actions');
         for (let index = 0; index < elts.length; ++index) {
            elt = /** @type {!Element} */ (elts[index]);
            if (elt.getAttribute('type') === 'record') {
               this.m_actTreeRoots.push(elt);
            }
         }

         this.gDC.logger.logInfo("Reloaded action nodes of script from XML document.");

      } catch( e ) {
         let message = `Unexpected error reloading script info: ${e}`;
         this.gDC.logger.logWarning(message);
         throw new Error(message);
      }
   },

   /**
    * Clone a script tree from part of another DOM tree.
    * @this {!DejaClick.Script}
    * @param {!Node} node The script element to be cloned.
    * @return {string} Description of any errors that occurred.
    *    An empty string if successful.
    */
   cloneFromDomSubtree: function (node) {
      var owner, result, doc;
      owner = node.ownerDocument;
      if (owner === null) {
         result = 'Source node does not have a document';
      } else {
         doc = owner.implementation.createDocument('', '', null);
         if (doc == null) {
            result = 'Failed to create script document.';
         } else {
            this.m_document = doc;
            this.m_document.appendChild(this.m_document.importNode(node, true));
            this.m_changesPending = false;
            result = this.validate();
         }
      }
      return result;
   },

   /**
    * Load the script from an XML text string.
    * @this {!DejaClick.Script}
    * @param {string} xmlText The string to be decoded into a DOM tree.
    * @return {string} Description of any errors that occurred.
    *    An empty string if successful.
    */
   loadFromText: function (xmlText) {
      var doc, result, errorElts, errorElt, divElts;
      doc = new DOMParser().parseFromString(xmlText, 'text/xml');
      if (doc == null) {
         return 'Failed to parse XML';
      }
      this.m_document = doc;
      this.m_changesPending = false;
      result = '';
      errorElts = this.m_document.getElementsByTagName('parsererror');
      if (errorElts.length !== 0) {
         errorElt = /** @type {!Element} */ (errorElts[0]);
         divElts = errorElt.getElementsByTagName('div');
         if (divElts.length !== 0) {
            result = /** @type {!Element} */ (divElts[0]).textContent;
         }
         if (result.length === 0) {
            result = errorElt.textContent;
            if (result.length === 0) {
               result = 'XML parsing failed';
            }
         }
      } else {
         result = this.validate();
      }
      return result;
   },

   /**
    * Decode all attribute values below the given node. Decode or
    * decrypt all text nodes. Remove extraneous text nodes.
    * @private
    * @this {!DejaClick.Script}
    * @param {Node} node The node to be decoded.
    * @param {!function(string):string} decode Function to decode
    *    attribute values.
    * @param {!function(string):string} decodeText Function to decode
    *    text node values.
    * @param {!function(string):string} decryptText Function to decode
    *    text node values below an element with a 'protected' attribute.
    */
   normalizeNode: function (node, decode, decodeText, decryptText) {
      var parent, decodeTextChild, elt, index, child, nextChild;
      if (node.nodeType === Node.TEXT_NODE) {
         parent = node.parentNode;
         if (parent.childNodes.length !== 1) {
            // This text node merely separates elements. It is not needed.
            parent.removeChild(node);
         } else {
            node.nodeValue = decodeText(node.nodeValue);
         }

      } else if (node.nodeType === Node.ELEMENT_NODE) {
         elt = /** @type {!Element} */ (node);
         decodeTextChild = decodeText;
         if (elt.hasAttribute('protected')) {
            decodeTextChild = decryptText;
            elt.removeAttribute('protected');
         }

         // Closure thinks elt.attributes should still be a NamedNodeMap.
         index = elt.attributes.length;
         while (index !== 0) {
            --index;
            elt.attributes[index].value = decode(/** @type {!Attr} */ (elt.attributes[index]).value);
         }

         for (child = elt.firstChild; child !== null; child = nextChild) {
            nextChild = child.nextSibling;
            this.normalizeNode(child, decode, decodeTextChild, decryptText);
         }
      }
   },

   /**
    * Decode method for a non-encoded string.
    * @private
    * @param {string} str The plain text string to be decoded.
    * @return {string} The string argument itself.
    */
   decodePlain: function (str) { return str; },

   /**
    * Normalize the script DOM tree. Decrypt protected text nodes and
    * decode attribute values. Discard extraneous text nodes.
    * @this {!DejaClick.Script}
    * @param {boolean} serverMode true if the extension is operating in
    *    server mode.
    * @param {function(string):string=} opt_decrypt Optional decryption
    *    method. Normal decoding will be performed if not supplied.
    * @return {boolean} True if the script was initially URI-encoded.
    */
   normalize: function (serverMode, opt_decrypt) {
      var decrypt, decode, result;

      if (serverMode) {
         this.removeReplayAdvisorEventTimeouts();
      }
      this.m_scriptElement.normalize();

      // Remove previous password digest.
      while (this.domTreeDelAttribute(this.m_scriptElement, 'lctoken')) { }

      if (this.m_scriptElement.getAttribute('uriencoded') !== 'no') {
         decode = decodeURIComponent;
         result = true;
      } else {
         decode = this.decodePlain;
         result = false;
      }
      decrypt = (opt_decrypt == null) ? decode : opt_decrypt;
      this.normalizeNode(this.m_scriptElement, decode, decode, decrypt);
      return result;
   },


   // ===== Script export methods =====

   /**
    * Get the time of the most recent user modification.
    * @private
    * @this {!DejaClick.Script}
    * @return {number} Time (in milliseconds) of the most recent user mod.
    */
   getLastUserModificationTime: function () {
      var lastModTime, modifiedNodes, index, modTime;

      lastModTime = -Infinity;
      modifiedNodes = this.processXPath(this.m_scriptElement,
         'descendant::attrib[@modifiedbyuser]');
      index = modifiedNodes.length;
      while (index !== 0) {
         --index;
         modTime = Number(modifiedNodes[index].getAttribute('modifiedbyuser'));
         if (lastModTime < modTime) {
            lastModTime = modTime;
         }
      }
      return lastModTime;
   },

   /**
    * Set script attributes for the script's creation and modification time.
    * @private
    * @this {!DejaClick.Script}
    * @param {DejaClick.VersionInfo} versionInfo Version information for
    *    the extension and browser.
    */
   updateScriptVersion: function (versionInfo) {
      var now, modTime, addModAttrs, version;

      now = Date.now();
      modTime = this.getLastUserModificationTime();
      addModAttrs = false;
      if (modTime !== -Infinity) {
         this.domTreeChangeAttribute(this.m_scriptElement, 'modifiedbyuser',
            new Date(modTime).toUTCString());
         addModAttrs = true;
      } else {
         this.domTreeDelAttribute(this.m_scriptElement, 'modifiedbyuser');
      }

      if (!this.domTreeHasAttribute(this.m_scriptElement, 'produced')) {
         if ((modTime === -Infinity) || (modTime > now)) {
            modTime = now;
         }
         this.domTreeAddAttribute(this.m_scriptElement, 'produced',
            new Date(modTime).toUTCString());
         this.domTreeChangeAttribute(this.m_scriptElement, 'pversion',
            versionInfo.extension.version);
         this.domTreeChangeAttribute(this.m_scriptElement, 'pbrowser',
            versionInfo.application.name);
         this.domTreeChangeAttribute(this.m_scriptElement, 'pbrowserversion',
            versionInfo.application.version);
         this.domTreeDelAttribute(this.m_scriptElement, 'pffversion');
      } else {
         addModAttrs = true;
         version = this.domTreeGetAttribute(this.m_scriptElement, 'pffversion');
         if (version !== null) {
            this.domTreeChangeAttribute(this.m_scriptElement, 'pbrowser',
               'Firefox');
            this.domTreeChangeAttribute(this.m_scriptElement, 'pbrowserversion',
               version);
            this.domTreeDelAttribute(this.m_scriptElement, 'pffversion');
         }
      }

      if (addModAttrs) {
         this.domTreeChangeAttribute(this.m_scriptElement, 'modified',
            new Date(now).toUTCString());
         this.domTreeChangeAttribute(this.m_scriptElement, 'mversion',
            versionInfo.extension.version);
         this.domTreeChangeAttribute(this.m_scriptElement, 'mbrowser',
            versionInfo.application.name);
         this.domTreeChangeAttribute(this.m_scriptElement, 'mbrowserversion',
            versionInfo.application.version);
         this.domTreeDelAttribute(this.m_scriptElement, 'mffversion');
      } else {
         version = this.domTreeGetAttribute(this.m_scriptElement, 'mffversion');
         if (version !== null) {
            this.domTreeChangeAttribute(this.m_scriptElement, 'mbrowser',
               'Firefox');
            this.domTreeChangeAttribute(this.m_scriptElement, 'mbrowserversion',
               version);
            this.domTreeDelAttribute(this.m_scriptElement, 'mffversion');
         }
      }

      this.domTreeChangeAttribute(this.m_scriptElement, 'rfeatures',
         this.getUsedFeatures().join(','));
   },

   /**
    * Get the script modified/created version.
    * @private
    * @this {!DejaClick.Script}
    * 
    */
   getScriptModificationInfo: function () {
      var info = {};


      info.modTime = this.domTreeGetAttribute(this.m_scriptElement, 'modifiedbyuser');
      info.produced = this.domTreeGetAttribute(this.m_scriptElement, 'produced');
      info.pversion = this.domTreeGetAttribute(this.m_scriptElement, 'pversion');
      info.modified = this.domTreeGetAttribute(this.m_scriptElement, 'modified');
      info.mversion = this.domTreeGetAttribute(this.m_scriptElement, 'mversion');
     
      return info;
   },

   /**
    * Compares the version of DejaClick used for modifying/recording the script 
    * with the parameter received.
    * 
    * If the Script version is older returns -1, if it is the same returns 0, if higher returns 1.
    * 
    * @this {!DejaClick.Script}
    * @param {string} versionToCompare Version required
    * @return {integer} If the Script version is older returns -1, if it is the same returns 0, if higher returns 1.
    */
   isScriptVersionNewerThan: function (versionToCompare) {
      
      var scriptVersion = null;
      if ( this.domTreeHasAttribute(this.m_scriptElement, 'mversion') ) {
         scriptVersion = this.domTreeGetAttribute(this.m_scriptElement, 'mversion');
      } else if ( this.domTreeHasAttribute(this.m_scriptElement, 'pversion') ) {
         scriptVersion = this.domTreeGetAttribute(this.m_scriptElement, 'pversion');
      }
 
      if ( scriptVersion ) {
         return this.compareScriptsVersion(scriptVersion, versionToCompare);
      } else {
         return 0;
      }
   },

   /**
    * Compare two version strings.
    * @param {string} v1 The first version.
    * @param {string} v2 The second version.
    * @return {integer} Less than zero, zero, or greater than zero if
    *    v1 is less than, equal to, or greater than v2.
    */
   compareScriptsVersion: function (v1, v2) {
      var v1Ary, v2Ary, index, v1Digit, v2Digit;

      v1Ary = v1.split('.');
      v2Ary = v2.split('.');
      for (index = 0; (index < v1Ary.length) || (index < v2Ary.length); ++index) {
         v1Digit = (index < v1Ary.length) ? Number(v1Ary[index]) : 0;
         v2Digit = (index < v2Ary.length) ? Number(v2Ary[index]) : 0;
         if (v1Digit < v2Digit) {
            return -1;
         } else if (v1Digit > v2Digit) {
            return 1;
         }
      }
      return 0;
   },


   /**
    * Get the current script status.
    * @this {!DejaClick.Script}
    * @return {string} The status of the script.
    */
   getScriptStatus: function()
   {
      var i, newState = "";

      // we need an active recording to proceed further
      if (!this.m_scriptElement) {
         // no script or recording
         return newState;
      }


      //UXM-11286 - INTERNAL USE ONLY - Force the script to be marked as replayed successfully
      if ( this.gDC.getSystemBoolPref('DC_OPTID_MARKSCRIPTASREPLAYED') ) {
         newState = "scriptCheck";
         return newState;
      }

      // get the replayed events in this script
      var actionType, replayResultsRootNode, elt;
      var nodeList = this.m_scriptElement.getElementsByTagName('actions');
      for (var index = 0; index < nodeList.length; ++index) {
         elt = /** @type {!Element} */ (nodeList[index]);
         if (elt.getAttribute('type') === 'replay') {
            replayResultsRootNode = elt;
            break;
         }
      }
      
      // count up the errors and warnings to determine final replay status
      var statusType, totalWarnings=0, totalErrors=0;
      if (replayResultsRootNode) {
         var eventNodes = replayResultsRootNode.getElementsByTagName('event');
         if (eventNodes.length) {
            for (i=0; i < eventNodes.length; i++) {
               elt = /** @type {!Element} */ (eventNodes[i]);
               statusType = elt.getAttribute("statustype");
               if (statusType == this.DC_REPLAY_WARNING) {
                  ++totalWarnings;
               } else if (statusType == this.DC_REPLAY_ERROR) {
                  ++totalErrors;
               }
            }
            // match the icon state to the final script status
            if (totalErrors > 0) {
               newState = "scriptError";
            } else if (totalWarnings > 0) {
               newState = "scriptWarn";
            } else {
               // This special case ensures that we don't report a success
               // for the script unless all (expected) events were replayed.
               if (replayResultsRootNode.hasAttribute("replaycomplete")) {
                  newState = "scriptCheck";
               } else {
                  newState = "scriptNorm";
               }
            }
         }
      }

      return newState;

   },

   /**
    * Store the script status as an attribute within the script.
    * @this {!DejaClick.Script}
    * @param {string} aScriptStatus The status
    */
   setScriptStatus: function (aScriptStatus) {
      this.domTreeChangeAttribute(this.m_scriptElement, 'scriptstatus',
         aScriptStatus);
   },

   /**
    * Get the last replay type actions element in the script.
    * @this {!DejaClick.Script}
    * @return {?Element} The root of the most recent results tree, if any.
    */
   getResultsTree: function() {
      var result, child;
      result = null;
      for (child = this.m_scriptElement.firstElementChild;
            child !== null;
            child = child.nextElementSibling) {
         if ((child.tagName === 'actions') &&
               (child.getAttribute('type') === 'replay')) {
            result = child;
         }
      }
      return result;
   },

   /**
    * Store details of the replay in the script.
    * @this {!DejaClick.Script}
    * @param {?{
    *    message:string,
    *    statusCode:integer,
    *    statusLogId:string
    * }} aDetails Result of replay.
    * @param {string} aMessageText
    */
   storeErrorDetails: function (aDetails, aMessageText) {
      var results, events, error;

      results = this.getResultsTree();
      if (results == null) {
         results = this.domTreeCreateRoot(this.m_scriptElement, 'actions',
            'replay');
      }
      events = this.processXPath(results,
         '//event[@orig_seq="1" and not(@orig_subscriptseq)]');
      if ((events.length === 0) ||
            !events[events.length - 1].hasAttribute('statustype')) {
         // No results for first? event, so insert an error node.
         error = this.domTreeInsertNode(results, 'error');
         error.setAttribute('type', 'internal');
         error.setAttribute('seq', '1');
         error.setAttribute('timestamp', (new Date()).toISOString());
         error.setAttribute('statustype', 2); // replay error
         if (aDetails != null) {
            error.setAttribute('statuscode', String(aDetails.statusCode ||
               DejaClick.constants.STATUS_INTERNAL_ERROR));
            error.setAttribute('statusmsg', aDetails.message);
            error.setAttribute('statusmsgtext', aMessageText);
            if (aDetails.statusLogId.length !== 0) {
               error.setAttribute('statuslogid', aDetails.statusLogId);
            }
         }
      }
   },
   
   /**
    * Renumber the event elements in the script.  The 'seq' attribute
    * of each event will be updated according to its order within the
    * enclosing 'actions' element.
    * @private
    * @this {!DejaClick.Script}
    */
   renumberEvents: function (aStartIndex) {
      var actIndex, events, evtIndex;
      actIndex = this.m_actTreeRoots.length;
	  
      if (aStartIndex === undefined) {
         aStartIndex = 0;
      }

      while (actIndex !== 0) {
         --actIndex;
         events = this.m_actTreeRoots[actIndex].getElementsByTagName('event');
         for (evtIndex = aStartIndex; evtIndex < events.length; ++evtIndex) {
	    if (aStartIndex) {
               (events[evtIndex]).setAttribute('seq', String(evtIndex + 2));				  
	    }
	    else {
               /** @type {!Element} */ (events[evtIndex]).
               setAttribute('seq', String(evtIndex + 1));
	    }

         }
      }
   },

   
   /**
    * Renumber the action elements in the script.  The 'seq' attribute
    * of each action will be updated according to its order within the
    * enclosing 'actions' element.
    * @private
    * @this {!DejaClick.Script}
    */
   renumberActions: function (aStartIndex) {
      var actIndex, actions, actionIndex;
      actIndex = this.m_actTreeRoots.length;
	  
      if (aStartIndex === undefined) {
	  aStartIndex = 0;
      }

      while (actIndex !== 0) {
         --actIndex;
         actions = this.m_actTreeRoots[actIndex].getElementsByTagName('action');
         for (actionIndex = aStartIndex; actionIndex < actions.length; ++actionIndex) {
            if (aStartIndex) {
               (actions[actionIndex]).setAttribute('seq', String(actionIndex + 2));				  
	     }
	    else {
               /** @type {!Element} */ (actions[actionIndex]).
               setAttribute('seq', String(actionIndex + 1));
	    }

         }
      }
   },

   /**
   /**
    * Build a string representation of the script structure for use in
    * capture reporting.
    * @private
    * @this {!DejaClick.Script}
    */
   assignTxnStruct: function () {
      var structure, index1, actionElts, index2;

      structure = [];
      for (index1 = 0; index1 < this.m_actTreeRoots.length; ++index1) {
         actionElts = this.m_actTreeRoots[index1].getElementsByTagName('action');
         for (index2 = 0; index2 < actionElts.length; ++index2) {
            structure.push(/** @type {!Element} */ (actionElts[index2]).
                  getElementsByTagName('event').length);
         }
      }
      this.domTreeChangeAttribute(this.m_scriptElement, 'txnstruct',
         structure.join(':'));
   },

   /**
    * Recursively create a serialized representation of a DOM node and
    * its children. Encode or encrypt attribute values and text content
    * on the fly.
    * @private
    * @this {!DejaClick.Script}
    * @param {!Node} node The node to be encoded.
    * @param {string} prefix Indentation prefix to be added to each line.
    * @param {function(string):string} textEncode Function to encode
    *    (or encrypt) text nodes.
    * @param {!{
    *    indent:string,
    *    lineEnd:string,
    *    encode:function(string):string,
    *    encrypt:function(string):string,
    *    ignore:!Object.<string,boolean>
    * }} options Additional serialization options.
    * @return {string} Serialized XML.
    */
   serializeNode: function (node, prefix, textEncode, options) {
      var result, elt, childEncode, index, attr, name, textChild,
         childPrefix, child;

      if (node.nodeType === Node.TEXT_NODE) {
         result = textEncode(node.nodeValue);

      } else if (node.nodeType === Node.COMMENT_NODE) {
         result = '<!--' + node.nodeValue + '-->';

      } else if (node.nodeType === Node.ELEMENT_NODE) {
         // Create the element tag.
         elt = /** @type {!Element} */ (node);
         result = prefix + '<' + elt.tagName;

         // Add attributes.
         childEncode = textEncode;
         for (index = 0; index < elt.attributes.length; ++index) {
            attr = /** @type {!Attr} */ (elt.attributes[index]);
            name = attr.name;
            if (!options.hasOwnProperty.call(options.ignore, name)) {
               if (name === 'protected') {
                  childEncode = options.encrypt;
               }
               result += ' ' + name + '="' + options.encode(attr.value) + '"';
            }
         }

         // Add children
         if (elt.firstChild === null) {
            // Abbreviate end tag for element with no children.
            result += '/>' + options.lineEnd;
         } else {
            textChild = (elt.childNodes.length === 1) &&
               (elt.firstChild.nodeType === Node.TEXT_NODE);
            if (textChild && (elt.firstChild.nodeValue === '')) {
               // Abbreviate end tag for element with only an empty text node.
               result += '/>' + options.lineEnd;

            } else {
               result += '>';
               if (!textChild) {
                  result += options.lineEnd;
               }

               childPrefix = prefix + options.indent;
               if (elt.childNodes.length === 1) {
                  result += this.serializeNode(elt.firstChild, childPrefix,
                     childEncode, options);
               } else {
                  child = elt.firstChild;
                  while (child !== null) {
                     if (child.nodeType !== Node.TEXT_NODE) {
                        result += this.serializeNode(child, childPrefix,
                           childEncode, options);
                     }
                     child = child.nextSibling;
                  }
               }
               if (!textChild) {
                  result += prefix;
               }
               result += '</' + elt.tagName + '>' + options.lineEnd;
            }
         }
      } else {
         result = '';
      }
      return result;
   },

   /**
    * Serialize the top-level script attributes.
    * @private
    * @this {!DejaClick.Script}
    * @param {!{
    *    indent: string,
    *    lineEnd: string,
    *    encode: function(string):string,
    *    encrypt: function(string):string,
    *    ignore: !Object.<string,boolean>
    * }} options Serialization options controlling pretty printing,
    *    URI encoding, encryption, and suppression of attributes.
    * @return {string} A serialized text representation of the
    *    script/attributes element (and its descendants).
    */
   serializeScriptAttributes: function (options) {
      var child, result;
      child = this.getChildWithTag(this.m_scriptElement, 'attributes');
      if (child !== null) {
         result = this.serializeNode(child, options.indent, options.encode, {
            indent: options.indent,
            lineEnd: options.lineEnd,
            encode: options.encode,
            encrypt: options.encode, // Never encrypt this.
            ignore: options.ignore
         });
      } else {
         result = '';
      }
      return result;
   },

   /**
    * List of tags that compose the script details.
    * @const
    */
   EVENT_TAGS: [
      'subscripts',
      'urlmasks',
      'cookies',
      'headers',
      'boolprefs',
      'intprefs',
      'charprefs',
      'notes',
      'variables',
      'datasets',
      'filelists',
      'contentviews',
      'branches'
   ],

   /**
    * Serialize the script instructions.
    * @private
    * @this {!DejaClick.Script}
    * @param {!{
    *    indent: string,
    *    lineEnd: string,
    *    encode: function(string):string,
    *    encrypt: function(string):string,
    *    ignore: !Object.<string,boolean>
    * }} options Serialization options controlling pretty printing,
    *    URI encoding, encryption, and suppression of attributes.
    * @return {string} A serialized text representation of the
    *    script instruction elements and their descendants.
    */
   serializeEvents: function (options) {
      var result, index, child;
      result = '';
      if (this.m_actTreeRoots.length !== 0) {
         result += this.serializeNode(this.m_actTreeRoots[0], options.indent,
            options.encode, options);
      }
      for (index = 0; index < this.EVENT_TAGS.length; ++index) {
         child = this.getChildWithTag(this.m_scriptElement,
            this.EVENT_TAGS[index]);
         if (child !== null) {
            result += this.serializeNode(child, options.indent, options.encode,
               options);
         }
      }
      return result;
   },

   /**
    * Serialize the navigation subtree(s).
    * @private
    * @this {!DejaClick.Script}
    * @param {!{
    *    indent: string,
    *    lineEnd: string,
    *    encode: function(string):string,
    *    encrypt: function(string):string,
    *    ignore: !Object.<string,boolean>
    * }} options Serialization options controlling pretty printing,
    *    URI encoding, encryption, and suppression of attributes.
    * @return {string} A serialized text representation of the
    *    navigation subtree(s).
    */
   serializeNavigation: function (options) {
      var result, suboptions, navElts, index;
      result = '';
      suboptions = {
         indent: options.indent,
         lineEnd: options.lineEnd,
         encode: options.encode,
         encrypt: options.encode, // Never encrypt this.
         ignore: options.ignore
      };
      navElts = this.m_scriptElement.getElementsByTagName('navigation');
      for (index = 0; index < navElts.length; ++index) {
         result += this.serializeNode(navElts[index], options.indent,
            options.encode, suboptions);
      }
      return result;
   },

   /**
    * Serialize the results subtree(s).
    * @private
    * @this {!DejaClick.Script}
    * @param {!{
    *    indent: string,
    *    lineEnd: string,
    *    encode: function(string):string,
    *    encrypt: function(string):string,
    *    ignore: !Object.<string,boolean>
    * }} options Serialization options controlling pretty printing,
    *    URI encoding, encryption, and suppression of attributes.
    * @return {string} A serialized text representation of the
    *    results subtree(s).
    */
   serializeResults: function (options) {
      var result, suboptions, actionsElts, index, elt;
      result = '';
      suboptions = {
         indent: options.indent,
         lineEnd: options.lineEnd,
         encode: options.encode,
         encrypt: options.encode, // Never encrypt this.
         ignore: options.ignore
      };
      actionsElts = this.m_scriptElement.getElementsByTagName('actions');
      for (index = 0; index < actionsElts.length; ++index) {
         elt = /** @type {!Element} */ (actionsElts[index]);
         if (elt.getAttribute('type') === 'replay') {
            // @todo Remove docSteps with no starttime attribute.
            result += this.serializeNode(elt, options.indent,
               options.encode, suboptions);
         }
      }
      return result;
   },

   /**
    * Remove any information about encryption from the DOM tree.
    * Discards the local password hash and all protected attributes.
    * @this {!DejaClick.Script}
    * @private
    */
   removeCryptoDetails: function () {
      var eltList, index;
      while (this.domTreeDelAttribute(this.m_scriptElement, 'lctoken')) { }
      eltList = this.processXPath(this.m_scriptElement, '//*[@protected]');
      index = eltList.length;
      while (index !== 0) {
         --index;
         eltList[index].removeAttribute('protected');
      }
   },

   /**
    * Add protected attributes to the script elements that should be
    * encrypted. Also store the password digest in the script attributes.
    * @this {!DejaClick.Script}
    * @param {string} aDigest Cryptographic digest of the password to
    *    be used to encrypt this script.
    * @param {boolean} aLocal If true, the script is being prepared to
    *    be saved to local disk. If false, the script is being
    *    prepared to be uploaded to AlertSite.
    * @param {boolean} aAnyInput If true, encrypt text to be entered
    *    into all input elements. If false, only encrypt text for
    *    passwords.
    */
   markElementsForEncryption: function (aDigest, aLocal, aAnyInput) {
      var events, index, event, params, param, name, variables;
      this.domTreeChangeAttribute(this.m_scriptElement, 'lctoken', aDigest);
      if (!aLocal) {
         this.domTreeChangeAttribute(this.m_scriptElement, 'rctoken', aDigest);
      }

      events = this.processXPath(this.m_scriptElement,
         '//actions[@type="record"]//event[@type="change"]');
      variables = {};
      index = events.length;
      while (index !== 0) {
         --index;
         event = events[index];
         // Check crumbs for input elements.
         if (this.isInputEvent(event, aAnyInput)) {
            params = this.getChildWithTag(event, 'eventparams');
            param = (params == null) ? null : params.firstElementChild;
            while (param !== null) {
               name = param.getAttribute('name');
               if ((name === 'value') || (name === 'keycodes')) {
                  param.setAttribute('protected', 'true');
               } else if (name === 'varreference') {
                  variables[param.textContent] = true;
               }
               param = param.nextElementSibling;
            }
         }
      }
      // TODO: Encrypt referenced script variables.
   },

   /**
    * @this {!DejaClick.Script}
    * @param {!{
    *    writeActions:boolean,
    *    writeNavigation:boolean,
    *    writeResults:boolean,
    *    writeFingerprints:boolean,
    *    uriEncode:boolean,
    *    pretty:boolean,
    *    encrypt:?DejaClick.Encryption,
    *    local:boolean,
    *    encryptAllInput:boolean
    * }} options
    * @param {!DejaClick.VersionInfo} versionInfo Version information for
    *    the extension and browser.
    * @return {string} Text representation of the script.
    */
   serializeScript: function (options, versionInfo) {
      var encode, encrypt, suboptions, result;
      try {
         result = '';

         this.removeCryptoDetails();
         // @todo If necessary, configure encryption, add protected attributes.

         this.updateScriptVersion(versionInfo);
         if (options.writeActions) {
            this.renumberEvents();
         }
         this.assignTxnStruct();

         encode = options.uriEncode ? encodeURIComponent : this.decodePlain;
         if (options.encrypt == null) {
            encrypt = encode;
         } else {
            encrypt = options.encrypt.encrypt.bind(options.encrypt);
            this.markElementsForEncryption(options.encrypt.getPasswordDigest(),
               options.local, options.encryptAllInput);
         }
         suboptions = {
            indent: options.pretty ? '   ' : '',
            lineEnd: options.pretty ? '\n' : '',
            encode: encode,
            encrypt: encrypt,
            ignore: {}
         };
         if (!options.writeFingerprints) {
            suboptions.ignore.dcdocid = true;
            suboptions.ignore.dcvalue = true;
         }

         result = '<script' +
            (options.uriEncode ? '>' : ' uriencoded="no">') +
            suboptions.lineEnd +
            this.serializeScriptAttributes(suboptions);

         if (options.writeActions) {
            result += this.serializeEvents(suboptions);
         }
         if (options.writeNavigation) {
            result += this.serializeNavigation(suboptions);
         }
         if (options.writeResults) {
            result += this.serializeResults(suboptions);
         }
         // Cleanup the results in server mode
         if (options.cleanup) {
            var resultsNode = this.getResultsTree();
            // remove docSteps (and objSteps if fullpage mode is enabled) without a starttime attribute
            // (an objStep only has a timestamp if fullpage is enabled (see dejaExtras.handleRequestHeader())
            var xpathQuery = "//httpstep[not(@starttime)] | //objstep[@timestamp and not(@starttime)]";
            if (resultsNode) {
               var nodeList = this.processXPath( resultsNode, xpathQuery );
               if (nodeList && nodeList.length) {
                  for (var i in nodeList) {
                     if (nodeList.hasOwnProperty(i)) {
                        this.domTreeRemoveNode(nodeList[i]);
                     }
                  }
               }
            }
         }
         result += '</script>' + suboptions.lineEnd;

      } finally {
         this.removeCryptoDetails();
      }
      return result;
   }
};
