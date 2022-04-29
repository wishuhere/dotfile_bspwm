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

/**
 * Preferred width of the add/edit branch dialog.
 * @const
 */
var preferredWidth = 450;

/**
 * Preferred height of the add/edit branch dialog.
 * @const
 */
var preferredHeight = 350;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Class to encapsulate the functionality of adding/editing branch.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {{
 *    context: !Element,
 *    item: ?Element
 * }} aOptions The options passed to the dialog.
 * @param {!Element} aRootElement The parent element of the page's UI.
 *    This is typically the documentElement.
 * @param {!Window} aWindow The window object.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!DejaClick.DejaService} aService The DejaClick record/replay service.
 * @param {DejaClick.Script} aScript The script to which the edited
 *    branch applies.
 * @param {DejaClick.Search} aSearch The search utilities.
 */
DejaClickUi.Branch = function (aOptions, aRootElement, aWindow, aConstants,
                               aUtils, aService, aScript, aSearch) {

   var root;

   aWindow.returnValue = null;

   this.context = aOptions.context;
   this.item = aOptions.item;
   this.window = aWindow;
   this.constants = aConstants;
   this.utils = aUtils;
   this.service = aService;
   this.script = aScript;
   this.search = aSearch;
   this.targets = [];
   this.validTargets = [];

   // Find/create UI elements.
   root = $(aRootElement);
   this.elements = {
      title: root.find('title'),
      description: root.find('#description'),

      branchName: root.find('#branchName'),

      conditionTypeList: root.find('#conditionTypeList'),
      replayStatusList: root.find('#replayStatusList'),

      actionList: root.find('#actionList'),
      scriptList: root.find('#scriptList'),
      targetTypeList: root.find('#targetTypeList'),
      targetSeqList: root.find('#targetSeqList'),

      branchOrder: root.find('#branchOrder'),

      remove: root.find('#remove'),
      apply: root.find('#apply'),
      cancel: root.find('#cancel'),

      allButtons: root.find('button'),
      allInputs: root.find('input'),
      toggleSelects: root.find('#conditionTypeList, #actionList')
   };

   // Initialize buttons.
   this.elements.allButtons.button();

   // Initialize event handlers.
   this.elements.allInputs.on('change input', this.enableControls.bind(this));
   this.elements.toggleSelects.on('change', this.toggleSelects.bind(this));
   this.elements.scriptList.on('change', this.updateTargetTypes.bind(this));
   this.elements.targetTypeList.on('change', this.updateTargetSequences.bind(this));

   this.elements.apply.on('click', this.apply.bind(this));
   this.elements.cancel.on('click', this.cancel.bind(this));
   this.elements.remove.on('click', this.remove.bind(this));

   // Display initial values in UI.
   aUtils.localizeTree(aRootElement, 'deja_');
   this.init();
};

DejaClickUi.Branch.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Branch,

   /****************************
    *    UI initialization
    ****************************/
   /**
    * Initialize the UI
    * @this {!DejaClickUi.Branch}
    */
   init: function () {
      var condition = [], target = [], order;

      try {
         this.prepareTargets();
         this.initSelects();
         this.initBranchOrder();

         // Create new branch
         if (this.item == null) {
            this.elements.title.text(this.utils.getMessage(
               'deja_branch_title_add'));
            this.elements.description.text(this.utils.getMessage(
               'deja_branch_description_add_' + this.context.tagName));

            this.elements.remove.hide();
         }
         // Edit a branch
         else {
            this.elements.title.text(this.utils.getMessage(
               'deja_branch_title_edit'));
            this.elements.description.text(this.utils.getMessage(
               'deja_branch_description_edit_' + this.context.tagName));

            // Name
            this.elements.branchName.val(this.getParam('name'));

            // Condition
            condition = this.getParam('condition')
               .split(this.constants.BRANCH_CONDITION_DELIMITER);

            if (condition.length) {
               this.elements.conditionTypeList
                  .val(condition[0])
                  .trigger('change');

               condition[1] !== undefined && this.elements.replayStatusList
                  .val(condition[1])
                  .trigger('change');
            }

            // Target
            target = this.getParam('target')
               .split(this.constants.BRANCH_TARGET_DELIMITER);

            if (target.length) {
               if (target[1] == this.constants.BRANCH_TARGET_END) {
                  this.elements.actionList.val(0).trigger('change');
               }
               else {
                  this.elements.actionList.val(1).trigger('change');
                  this.elements.scriptList.val(target[2]).trigger('change');
                  this.elements.targetTypeList.val(target[1]).trigger('change');
                  this.elements.targetSeqList.val(target[0]).trigger('change');
               }
            }

            // Order
            order = this.item.getAttribute('ordinal');
            $.isNumeric(order) && this.elements.branchOrder.val(order);
         }

         this.enableControls();
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Initialize select dropdowns based on valid targets tree
    * @this {!DejaClickUi.Branch}
    */
   initSelects: function () {
      var targets, scriptElem, scriptLabel, i, l;

      try {
         targets = this.validTargets;

         // Condition selection
         this.elements.conditionTypeList
            .val(this.constants.BRANCH_CONDITION_REPLAYSTATUS)
            .trigger('change');

         // Target selection
         if (targets && targets.length) {
            // Target type selection
            this.elements.actionList
               .val(this.constants.BRANCH_TARGET_TYPE_JUMP)
               .trigger('change');

            // Target script selection
            this.elements.scriptList.empty();

            for (i = 0, l = targets.length; i < l; i++) {
               if (targets[i].seq === 0) {
                  scriptLabel = this.utils
                     .getMessage('deja_branch_targetMainScript');
               } else {
                  scriptLabel = this.utils
                     .getMessage('deja_branch_targetSubscript') + targets[i].seq;
               }

               scriptElem = $(document.createElement('option'))
                  .val(targets[i].seq)
                  .text(scriptLabel);

               this.elements.scriptList.append(scriptElem);
            }

            this.elements.scriptList
               .prop('disabled', targets.length < 2)
               .trigger('change');
         } else {
            this.handleAbsentTargets();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Set the ordinal value for the added/edited branching rule
    * @this {!DejaClickUi.Branch}
    */
   initBranchOrder: function () {
      var count, ordinal;

      try {
         count = this.getBranchCount();

         this.elements.branchOrder
            .attr('max', this.item && count || count + 1)
            .val(this.item && this.item.getAttribute('ordinal') || count + 1);

         this.elements.branchOrder.prop('disabled', this.item && count == 1 || !count);
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /****************************
    *    Data preparation
    ****************************/

   /**
    * Search the transaction script for all actions and events that
    * cannot precede the action/event from which we are branching.
    * @this {!DejaClickUi.Branch}
    */
   prepareTargets: function () {
      this.initTargets();
      this.markPredecessors();
      this.markAllValid();
      this.markPredecessorsInvalid();
      this.collectValidTargets();
   },

   /**
    * Search the transaction script for all actions and events that
    * cannot precede the action/event from which we are branching.
    * @this {!DejaClickUi.Branch}
    */
   initTargets: function () {
      var rootElt, subscripts, subscript, subscriptSeq, i;

      try {
         rootElt = this.script.getScriptElement();
         this.targets.push({
            scriptNum: 0,
            actions: this.getActionsForScript(rootElt, 0)
         });

         subscripts = this.search.processXPath(rootElt, 'child::subscripts/subscript');
         for (i = 0; i < subscripts.length; i++) {
            subscript = subscripts[i];
            subscriptSeq = Number(subscript.getAttribute('seq'));
            this.targets.push({
               scriptNum: subscriptSeq,
               actions: this.getActionsForScript(subscript, subscriptSeq)
            });
         }
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Get the details of all actions within a script.
    * @this {!DejaClickUi.Branch}
    * @param {!Element} aScriptElt The script or subscript element being queried.
    * @param {number} aNum The sequence number of the queried script.
    * @returns {!Array.<!Object>} Array of objects describing each action
    *    and their contained events.
    */
   getActionsForScript: function (aScriptElt, aNum) {
      var actions = [], targets = [], actionsNode, action, actionNum, hashkey, i;

      try {
         actions = this.search.processXPath(aScriptElt, 'child::actions[@type="record"]/action');

         for (i = 0; i < actions.length; i++) {
            action = actions[i];
            actionNum = Number(action.getAttribute('seq'));
            hashkey = actionNum + ':action:' + aNum;
            targets.push({
               scriptNum: aNum,
               actionNum: actionNum,
               name: this.getParamByHashkey(hashkey, 'description', 'attributes'),
               events: this.getEventsForAction(action, actionNum, aNum),
               branches: this.getBranchesForElement(action),
               predecessors: []
            });
         }
         return targets;
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Get the details of all events within an action.
    * @this {!DejaClickUi.Branch}
    * @param {!Element} aActionElt The node representing the action.
    * @param {number} aActionNum The sequence number of the action.
    * @param {number} aScriptNum The sequence number of the script to
    *    which the action belongs.
    * @return {!Array.<!Object>} Array of objects describing each event.
    */
   getEventsForAction: function (aActionElt, aActionNum, aScriptNum) {
      var events = [], targets = [], event, eventNum, hashkey, i;

      try {
         events = this.search.processXPath(aActionElt, 'child::event');
         for (i = 0; i < events.length; i++) {
            event = events[i];
            eventNum = Number(event.getAttribute('seq'));
            hashkey = eventNum + ':event:' + aScriptNum;
            targets.push({
               scriptNum: aScriptNum,
               actionNum: aActionNum,
               eventNum: eventNum,
               name: this.getParamByHashkey(hashkey, 'description', 'attributes'),
               branches: this.getBranchesForElement(event),
               predecessors: []
            });
         }
         return targets;
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Find all of the active branches associated with an action or event.
    * @this {!DejaClickUi.Branch}
    * @param {!Element} aElement The action or event for which to find the
    *    branches.
    * @return {!Array.<string>} Array of strings giving the hashkeys of
    *    the targets of all active branches for the given action or event.
    */
   getBranchesForElement: function (aElement) {
      var branches = [], targets = [], branch, hashkey, condition, target, parts, branchNum, i;

      try {
         branches = this.search.processXPath(aElement, 'child::branches/branch');
         for (i = 0; i < branches.length; i++) {
            branch = branches[i];
            hashkey = branch.getAttribute('seq') + ':' + 'branch';

            condition = this.getParamByHashkey(hashkey, 'condition', 'branchparams').split(this.constants.BRANCH_CONDITION_DELIMITER);
            if (condition[0] !== this.constants.BRANCH_CONDITION_NEVER) {
               target = this.getParamByHashkey(hashkey, 'target', 'branchparams');
               parts = target.split(this.constants.BRANCH_TARGET_DELIMITER);

               if (parts[1] !== this.constants.BRANCH_TARGET_END) {
                  if (target.split(this.constants.BRANCH_TARGET_DELIMITER).length === 2) {
                     target += this.constants.BRANCH_TARGET_DELIMITER + '0';
                  }
                  targets.push(target);
               }
            }
         }
         return targets;
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Find the successors of each action and event within the transaction.
    * Mark each successor as having the appropriate predecessor.
    * @this {!DejaClickUi.Branch}
    */
   markPredecessors: function () {
      var i;

      try {
         for (i = 0; i < this.targets.length; i++) {
            this.markActionPredecessors(this.targets[i]);
         }
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Mark each action in a subscript as a predecessor to the first
    * event of the next action in the subscript. Also find all event
    * predecessors in the script.
    * @this {!DejaClickUi.Branch}
    * @param {!Object} aScript Object describing a subscript and its
    *    component actions and events.
    */
   markActionPredecessors: function (aScript) {
      var action, nextAction, i;

      try {
         for (i = aScript.actions.length; i--;) {
            action = aScript.actions[i];
            if (nextAction) {
               if (nextAction.events.length !== 0) {
                  nextAction.events[0].predecessors.push(action);
               }
               else {
                  nextAction.predecessors.push(action);
               }
            }

            this.markBranchPredecessors(action);
            this.markEventPredecessors(action);
            nextAction = action;
         }
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Mark each event in an action as a predecessor to the next event
    * in the action and the action itself.
    * @this {!DejaClickUi.Branch}
    * @param {!Object} aAction Object describing an action and its
    *    component events.
    */
   markEventPredecessors: function (aAction) {
      var event, nextEvent, i;

      try {
         for (i = aAction.events.length; i--;) {
            event = aAction.events[i];
            if (nextEvent) {
               nextEvent.predecessors.push(event);
            }
            aAction.predecessors.push(event);

            this.markBranchPredecessors(event);
            nextEvent = event;
         }
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Mark the specified actionOrEvent as a predecessor of the target
    * of each of its branches.
    * @this {!DejaClickUi.Branch}
    * @param {!Object} aActionOrEvent description an action or event and its
    *    branches.
    */
   markBranchPredecessors: function (aActionOrEvent) {
      var target, i;

      try {
         for (i = aActionOrEvent.branches.length; i--;) {
            target = this.findBranchTargetFromHashkey(aActionOrEvent.branches[i]);
            if (target) {
               // If the target is an action, use its first event as the successor
               if ((target.events !== undefined) && (target.events.length !== 0)) {
                  target = target.events[0];
               }
               target.predecessors.push(aActionOrEvent);
            }
         }
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Mark all action and event objects as valid.
    * @this {!DejaClickUi.Branch}
    */
   markAllValid: function () {
      var script, action, i, j, k;

      try {
         for (i = this.targets.length; i--;) {
            script = this.targets[i];
            for (j = script.actions.length; j--;) {
               action = script.actions[j];
               action.valid = true;
               for (k = action.events.length; k--;) {
                  action.events[k].valid = true;
               }
            }
         }
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Mark all action and event objects that can precede start as invalid.
    * @this {!DejaClickUi.Branch}
    */
   markPredecessorsInvalid: function () {
      var start, invalid, index, element, preds, predIndex;

      try {
         start = this.findObjectForActionElement();

         if (start !== null) {
            invalid = [ start ];
            for (index = 0; index < invalid.length; ++index) {
               element = invalid[index];
               element.valid = false;
               preds = element.predecessors;
               predIndex = preds.length;
               while (predIndex !== 0) {
                  --predIndex;
                  if (preds[predIndex].valid) {
                     invalid.push(preds[predIndex]);
                  }
               }
            }
         }
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Find the object in our local object tree corresponding to an action
    * or event node in the transaction.
    * @this {!DejaClickUi.Branch}
    * @return {?Object} Object within scripts corresponding to this.context, or
    *    null if no such object exists.
    */
   findObjectForActionElement: function () {
      var hashkey, script, scriptIndex;

      try {
         script = this.context.parentNode;

         while (script !== null) {
            if (script.nodeName === 'script') {
               scriptIndex = '0';
               break;
            } else if (script.nodeName === 'subscript') {
               scriptIndex = script.getAttribute('seq');
               break;
            }
            script = script.parentNode;
         }
         hashkey = [this.context.getAttribute('seq'), this.context.nodeName, scriptIndex].join(this.constants.BRANCH_TARGET_DELIMITER);
         return this.findBranchTargetFromHashkey(hashkey);
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Traverse the collection of all actions and events and form a
    * collection of only those actions and events which are valid targets
    * for the current branch.
    * @this {!DejaClickUi.Branch}
    */
   collectValidTargets: function () {
      var script, actions, action, events, event, i, j, k;

      try {
         for (i = 0; i < this.targets.length; ++i) {
            script = {
               seq: this.targets[i].scriptNum,
               actions: [],
               events: []
            };
            actions = this.targets[i].actions;
            for (j = 0; j < actions.length; ++j) {
               action = actions[j];
               events = action.events;
               if (action.valid && ((events.length === 0) || (events[0].valid))) {
                  script.actions.push({
                     seq: action.actionNum,
                     name: action.name
                  });
               }
               for (k = 0; k < events.length; ++k) {
                  event = events[k];
                  if (event.valid) {
                     script.events.push({
                        seq: event.eventNum,
                        name: event.name
                     });
                  }
               }
            }

            if ((script.actions.length !== 0) || (script.events.length !== 0)) {
               this.validTargets.push(script);
            }
         }
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Update ordinal attribute for all branches inside current context
    * @this {!DejaClickUi.Branch}
    */
   updateOrdinals: function () {
      var branches, i, l;

      try {
         branches = this.context.getElementsByTagName('branch');
         for (i = 0, l = branches.length; i < l; i++) {
            branches[i].setAttribute('ordinal', i + 1);
         }
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Reorder branches based on order input field value
    * @this {!DejaClickUi.Branch}
    */
   reorderBranch: function () {
      var branch, branches, branchesElt, newPosition;

      try {
         branch = this.item;
         branchesElt = branch.parentNode;
         branches = branchesElt.getElementsByTagName('branch');
         newPosition = +this.elements.branchOrder.val();

         if (branches[newPosition - 1]) {
            branchesElt.removeChild(branch);
            branchesElt.insertBefore(branch, branches[newPosition - 1]);
         }

         this.updateOrdinals();
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /****************************
    *        Handlers
    ****************************/

   /**
    * Update select dropdowns based on condition type and target type selects change
    * @this {!DejaClickUi.Branch}
    * @param aEvent
    */
   toggleSelects: function (aEvent) {
      var conditionType, targetType;

      try {
         // Condition
         conditionType = this.elements.conditionTypeList.val();

         switch (conditionType) {
            case this.constants.BRANCH_CONDITION_ALWAYS:
            case this.constants.BRANCH_CONDITION_NEVER:
               this.elements.replayStatusList.prop('disabled', true).hide();
               break;

            case this.constants.BRANCH_CONDITION_REPLAYSTATUS:
            case this.constants.BRANCH_CONDITION_REPLAYSTATUSNOT:
               this.elements.replayStatusList.prop('disabled', false).show();
               break;

            default:
               break;
         }

         // Target
         targetType = this.elements.actionList.val();

         if (targetType == this.constants.BRANCH_TARGET_TYPE_JUMP) {
            this.elements.scriptList.prop('disabled', this.elements.scriptList[0].childElementCount < 2).show();
            this.elements.targetTypeList.prop('disabled', false).show();
            this.elements.targetSeqList.prop('disabled', this.elements.targetSeqList[0].childElementCount < 2).show();
         } else {
            this.elements.scriptList.prop('disabled', true).hide();
            this.elements.targetTypeList.prop('disabled', true).hide();
            this.elements.targetSeqList.prop('disabled', true).hide();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Update target type (action/event dropdown) according to selected script/subscript dropdown
    * @this {!DejaClickUi.Branch}
    */
   updateTargetTypes: function () {
      var target = {}, targets, scriptId, enabled, i, l;

      try {
         targets = this.validTargets;
         scriptId = this.elements.scriptList.val();

         if (targets && $.isNumeric(scriptId)) {
            for (i = 0, l = targets.length; i < l; i++) {
               if (targets[i].seq === +scriptId) {
                  target = targets[i];
                  break;
               }
            }

            this.elements.targetTypeList.children('option[value=action]')
               .prop('disabled', !(target.actions && target.actions.length));
            this.elements.targetTypeList.children('option[value=event]')
               .prop('disabled', !(target.events && target.events.length));

            enabled = this.elements.targetTypeList.children('option:enabled');

            if (enabled.length) {
               this.elements.targetTypeList
                  .val(enabled[0].getAttribute('value'))
                  .prop('disabled', enabled.length < 2)
                  .trigger('change');
            }
            else {
               this.handleAbsentTargets();
            }
         }
         else {
            this.handleAbsentTargets();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Update valid sequence dropdown according to selected action/event dropdown
    * @this {!DejaClickUi.Branch}
    */
   updateTargetSequences: function () {
      var target = {}, targets, scriptId, type, targetElem, i, l;

      try {
         this.elements.targetSeqList.empty();

         targets = this.validTargets;
         scriptId = this.elements.scriptList.val();
         type = this.elements.targetTypeList.val() + 's';

         if (targets && $.isNumeric(scriptId)) {
            for (i = 0, l = targets.length; i < l; i++) {
               if (targets[i].seq == +scriptId) {
                  target = targets[i];
                  break;
               }
            }

            if (target[type]) {
               for (i = 0, l = target[type].length; i < l; i++ ) {
                  targetElem = $(document.createElement('option'))
                     .val(target[type][i].seq)
                     .text(target[type][i].seq);

                  this.elements.targetSeqList
                     .append(targetElem)
                     .prop('disabled', target[type].length < 2);
               }
            }
            else {
               this.handleAbsentTargets();
            }
         }
         else {
            this.handleAbsentTargets();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Set target dropdown to "Stop replay" if valid targets are absent
    * @this {!DejaClickUi.Branch}
    */
   handleAbsentTargets: function () {
      try {
         this.elements.actionList
            .val(this.constants.BRANCH_TARGET_TYPE_END)
            .prop('disabled', true)
            .trigger('change');
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls in this dialog.
    * @this {!DejaClickUi.Branch}
    */
   enableControls: function () {
      var isNameEmpty, order, branchCount, isOrderInvalid;

      try {
         // Name
         isNameEmpty = this.elements.branchName.val().length === 0;

         // Condition

         // Order
         order = this.elements.branchOrder.val();
         branchCount = this.getBranchCount();
         isOrderInvalid = !($.isNumeric(order)) ||
            +order < 1 ||
            +order > (this.item == null && branchCount + 1 || branchCount);

         this.elements.apply.button('option', 'disabled', isNameEmpty || isOrderInvalid);
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /****************************
    *  Common dialog actions
    ****************************/
   /**
    * Apply the changes to this Branch. Close the window.
    * @this {!DejaClickUi.Branch}
    * @param {!Event} aEvent A jQuery click event on the apply button.
    */
   apply: function (aEvent) {
      var parent, conditionType, replayStatus, conditionParam,
         action, script, targetType, targetSeq, targetParam, win;

      try {
         // Save to script
         if (this.item == null) {
            parent = this.script.getChildWithTag(this.context, 'branches');

            if (parent == null) {
               parent = this.script.domTreeInsertNode(this.context, 'branches');
            }

            this.item = this.script.domTreeInsertNode(parent, 'branch');
            this.item.setAttribute('ordinal', this.getBranchCount());
         }

         if (this.item.getAttribute('ordinal') != this.elements.branchOrder.val()) {
            this.reorderBranch();
         }

         this.script.renumberElements('branch');

         // Name
         this.setParam('name', this.elements.branchName.val());

         // Condition
         conditionType = this.elements.conditionTypeList.val();
         replayStatus = this.elements.replayStatusList.val();

         if (+conditionType > 2) {
            conditionParam = [conditionType, replayStatus]
               .join(this.constants.BRANCH_CONDITION_DELIMITER)
         } else {
            conditionParam = conditionType;
         }

         this.setParam('condition', conditionParam);

         // Target
         action = this.elements.actionList.val();
         script = this.elements.scriptList.val();
         targetType = this.elements.targetTypeList.val();
         targetSeq = this.elements.targetSeqList.val();

         if (+action) {
            targetParam = [targetSeq, targetType, script]
               .join(this.constants.BRANCH_TARGET_DELIMITER);
         }
         else {
            targetParam = ['', this.constants.BRANCH_TARGET_END, '']
               .join(this.constants.BRANCH_TARGET_DELIMITER);
         }

         this.setParam('target', targetParam);

         this.window.returnValue = this.item;

         win = this.window;
         this.close();
         win.close();
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, discarding any changes.
    * @this {!DejaClickUi.Branch}
    * @param {!Event} aEvent A jQuery click event on the cancel button.
    */
   cancel: function (aEvent) {
      try {
         var win = this.window;
         this.close();
         win.close();
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * page.
    * @this {!DejaClickUi.Branch}
    */
   close: function () {
      try {
         if (this.hasOwnProperty('elements')) {
            this.elements.allButtons.off('click').button('destroy');
            this.elements.toggleSelects.off('change');
            this.elements.scriptList.off('change');
            this.elements.targetTypeList.off('change');
         }

         delete this.targets;
         delete this.validTargets;
         delete this.elements;
         delete this.script;
         delete this.search;
         delete this.service;
         delete this.utils;
         delete this.constants;
         delete this.window;
         delete this.item;
         delete this.context;
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Remove the branch being edited. Close the window.
    * @this {!DejaClickUi.Branch}
    * @param {!Event} aEvent A jQuery click event on the remove button.
    */
   remove: function (aEvent) {
      var parent, win;

      try {
         this.window.returnValue = this.item;

         parent = this.item.parentNode;
         this.script.domTreeRemoveNode(this.item);

         if (parent.firstElementChild == null) {
            this.script.domTreeRemoveNode(parent);
         }
         else {
            this.updateOrdinals();
         }

         this.script.renumberElements('branch');

         win = this.window;
         this.close();
         win.close();
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /****************************
    *         Helpers
    ****************************/

   /**
    * Get a parameter of the branch being edited.
    * @this {!DejaClickUi.Branch}
    * @param {string} aName The name of the parameter to retrieve.
    * @return {?string} The value of the parameter, or null if no such
    *    parameter exists.
    */
   getParam: function (aName) {
      return this.script.domTreeGetBranchParam(this.item, aName);
   },

   /**
    * Set or change the value of a parameter of the branch.
    * @this {!DejaClickUi.Branch}
    * @param {string} aName The name of the parameter to set.
    * @param {string} aValue The value of the parameter.
    */
   setParam: function (aName, aValue) {
      this.script.domTreeChangeBranchParam(this.item, aName, aValue);
   },

   /**
    * Retrive param from a script node specified with a hashkey
    * @this {!DejaClickUi.Branch}
    * @param {string} hashkey
    * @param {string} param
    * @param {string} section
    * @returns {string|string}
    */
   getParamByHashkey: function (hashkey, param, section) {
      var node, result;
      try {
         node = this.script.getHashkeyNode(hashkey);
         result = this.script.domTreeGetParam(node, param, section) || '';
         return result;
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Find the node in the object tree describing the action or event
    * indicated by the hashkey.
    * @this {!DejaClickUi.Branch}
    * @param {string} hashkey Identifier of a node in the scripts.
    * @return {?Object} The object in scripts identified by hashkey, or null
    *    if no such object exists.
    */
   findBranchTargetFromHashkey: function (hashkey) {
      var parts, key, actions, events, eventIndex, index;

      try {
         parts = hashkey.split(this.constants.BRANCH_TARGET_DELIMITER);

         actions = null;
         key = Number(parts[2]);
         index = this.targets.length;
         while (index !== 0) {
            --index;
            if (this.targets[index].scriptNum === key) {
               actions = this.targets[index].actions;
               break;
            }
         }
         if (actions === null) {
            return null;
         }

         key = Number(parts[0]);
         if (parts[1] === this.constants.BRANCH_TARGET_ACTION) {
            index = actions.length;
            while (index !== 0) {
               --index;
               if (actions[index].actionNum === key) {
                  return actions[index];
               }
            }
         } else {
            index = actions.length;
            while (index !== 0) {
               --index;
               events = actions[index].events;
               eventIndex = events.length;
               while (eventIndex !== 0) {
                  --eventIndex;
                  if (events[eventIndex].eventNum === key) {
                     return events[eventIndex];
                  }
               }
            }
         }
         return null;
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Get number of branch elements inside current context
    * @this {!DejaClickUi.Branch}
    * @returns {number}
    */
   getBranchCount: function () {
      var count;

      try {
         count = this.context.getElementsByTagName('branch').length;
         return count;
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   }
};

$(function () {
   /**
    * Clean up when the page is unloaded.
    * @param {!Event} aEvent A jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('branch')) {
            DejaClickUi.branch.close();
            delete DejaClickUi.branch;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the Branch instance once the
    * page is loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.branch = new DejaClickUi.Branch(
            window.dialogArguments,
            document.documentElement,
            window,
            DejaClick.constants,
            DejaClick.utils,
            DejaClick.service,
            DejaClick.script,
            DejaClick.search);
         $(window).on('unload', unload);
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   try {
      if (window.hasOwnProperty('dialogArguments')) {
         initialize();
      } else {
         window.onDialogArguments = initialize;
      }
   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }
});