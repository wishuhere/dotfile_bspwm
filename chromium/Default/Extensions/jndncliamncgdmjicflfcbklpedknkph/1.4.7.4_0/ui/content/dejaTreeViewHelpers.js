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

(function() {

// constants
   var NODENAME_SCRIPT    = 'script',
      NODENAME_SUBSCRIPT  = 'subscript',
      NODENAME_ACTIONS    = 'actions',
      NODENAME_ACTION     = 'action',
      NODENAME_EVENT      = 'event',
      ATTRNAME_SEQ        = 'seq',
      ATTRNAME_TYPE       = 'type',
      ATTRNAME_TRUESCREEN = 'screen',
      ATTRNAME_HASHKEY    = 'hashkey',
      ATTRNAME_BREAKPOINT = 'breakpoint',
      EXPANDLEVEL_SCRIPT  = 0,
      EXPANDLEVEL_ACTION  = 1,
      EXPANDLEVEL_EVENT   = 2,
      STATE_NORMAL        = 'norm',
      STATE_PAUSED        = 'pause',
      STATE_REPLAYING     = 'play',
      STATE_CHECKED       = 'check',
      STATE_WARNING       = 'warn',
      STATE_ERROR         = 'error',
      STATE_OFF           = 'off',
      ROOT_HASHKEY        = '1:script';

DejaClickUi.TreeViewHelpers = function () {

   // references to background services
   this.logger = DejaClick.utils.logger;
   this.getString = DejaClick.utils.getMessage;
   this.script = DejaClick.getScript();
   this.service = DejaClick.service;
   this.constants = DejaClick.constants;

   this._treeViewNodes = {};
};

DejaClickUi.TreeViewHelpers.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.TreeViewHelpers,

   /**
    * Generate a tree data structure from the script DOM
    *    (in the format required by JSTree)
    * @this {DejaClickUi.TreeViewHelpers}
    * @returns {Array}
    */
   getScopeTreeViewData: function () {
      var script, tvNode;

      try {
         if (this.script != null) {
            script = this.script.getScriptElement();
            tvNode = this._calcTreeViewNode(script);
            return tvNode.children;
         }

         return null;
      }
      catch(ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Generate a treeview node from a script DOM node recursively
    *    (in the format required by JSTree)
    * @this {DejaClickUi.TreeViewHelpers}
    * @param {?Element} aNode
    * @param {?Number|null=null} aSubNum
    * @returns {Object}
    * @private
    */
   _calcTreeViewNode: function( aNode, aSubNum ) {
      var nodeType, seq, subNum, tvNode, nodeChildren, subscripts, subhash;

      function getType() {
         var type;
         if (nodeType == NODENAME_SUBSCRIPT) {
            type = NODENAME_SCRIPT;
         } else if (nodeType == NODENAME_EVENT) {
            type = aNode.getAttribute( ATTRNAME_TYPE );
         } else {
            type = nodeType;
         }
         return type;
      }

      try {
         nodeType = (aNode) ? aNode.nodeName : null;
         seq = (!aNode || nodeType == NODENAME_SCRIPT) ? 1 : aNode.getAttribute( ATTRNAME_SEQ );
         subNum = Number(aSubNum) || 0;

         if (!aNode) {
            // no script is loaded
            tvNode = {
               data: this.getString("dcTreeview_noScriptLabel"),
               attr: {
                  type: NODENAME_SCRIPT,
                  seq: seq
               }
            };

         } else {
            tvNode = {
               data: this._getTreeViewNodeLabel(aNode),
               attr: {
                  type: nodeType,
                  seq: seq
               },
               state: nodeType !== NODENAME_EVENT && 'open' || 'close'
            };

            // check for child nodes and additional properties
            switch (nodeType) {
               case NODENAME_SCRIPT:
                  var actTreeRoots = aNode.getElementsByTagName( NODENAME_ACTIONS );
                  if (actTreeRoots.length > 0) {
                     nodeChildren = actTreeRoots[0].getElementsByTagName( NODENAME_ACTION );

                     // get subscripts
                     if (actTreeRoots.length > 1) {
                        subscripts = aNode.getElementsByTagName( NODENAME_SUBSCRIPT );
                     }
                  }
                  break;
               case NODENAME_SUBSCRIPT:
                  nodeChildren = aNode.getElementsByTagName( NODENAME_ACTION );
                  break;
               case NODENAME_ACTION:
                  nodeChildren = aNode.getElementsByTagName( NODENAME_EVENT );
                  break;
               case NODENAME_EVENT:
                  // has no children

                  // TrueScreen event
                  if (aNode.hasAttribute( ATTRNAME_TRUESCREEN )) {
                     tvNode.attr.truescreen = true;
                  }
                  break;
               default:
                  break;
            }

            // add the tree view node to the hashtable for future reference
            this._treeViewNodes[ tvNode.attr.hashkey ] = tvNode;

            // bubble up the node state to our parent tree nodes

            // recursively generate treeview nodes for the children
            if (nodeChildren) {
               tvNode.children = [];
               for (var i=0; i < nodeChildren.length; i++) {
                  tvNode.children.push( this._calcTreeViewNode( nodeChildren[i], subNum ) );
               }

               // and then for each subscript
               if (subscripts) {
                  for (var s=0; s < subscripts.length; s++) {
                     tvNode.children.push( this._calcTreeViewNode( subscripts[s], s + 1 ) );
                  }
               }
            }
         }

         return tvNode;

      } catch( e ) {
         this.logger.logException( e );
      }
   },

   /**
    * Return a descriptive label for a script DOM node
    * @this {DejaClickUi.TreeViewHelpers}
    * @param {!Element} aNode
    * @param {?Boolean} aIgnoreUser
    * @returns {string}
    * @private
    */
   _getTreeViewNodeLabel: function( aNode, aIgnoreUser ) {
      try {
         if (aNode == null) {
            return '';
         }
         var newLabel = "";

         // try getting the user-specified name
         var nodeType = aNode.nodeName;
         if ((nodeType != NODENAME_EVENT) && !aIgnoreUser) {
            newLabel = this.script.domTreeGetAttribute(aNode, nodeType + 'name');
         }

         // try getting the user-specified description
         if (!newLabel && !aIgnoreUser) {  // XXX add this as a user config setting?
            newLabel = this.script.domTreeGetAttribute(aNode, 'description');
         }

         // try some other information, depending on the type of node
         if (!newLabel) {
            switch (nodeType) {
               case NODENAME_SCRIPT:
                  // During recording, we won't have a description for the script or its filepath value.
                  // So we show a default script name for it until we can backfill it with the file name
                  // from the save script method or from the user's description change.  During import
                  // however, we may have some of this information, so we try to use it.

                  // show the script's filename as the display label
                  var scriptPath = this.script.getFilename();
                  if (scriptPath) {
                     var path = scriptPath.split( "/" );
                     var filename = path[ path.length - 1 ];
                     var name = filename.split( ".xml" );
                     newLabel = decodeURIComponent(name[0]);
                  }
                  break;

               case NODENAME_ACTION:
                  // During recording, we may not have a user description or a urlfinalized data value yet
                  // until the browser has had a chance to process the results of the user's events. So we
                  // show a default action name for it until we can backfill it with finalized data from
                  // the onLocationChange method.

                  // show the finalized url as the display label
                  newLabel = this.script.domTreeGetAttribute(aNode, 'urlfinalized');
                  break;

               case NODENAME_EVENT:
                  // show the event type as event tree label
                  newLabel = this._getEventLabelByType(aNode);
                  break;

               default:
                  newLabel = "";
                  break;
            }
         }

         // still nothing, so show the default label
         if (!newLabel) {
            // XXX hardcode script seq number for now (until playlists are added)
            var nodeSeq = (nodeType == NODENAME_SCRIPT) ? 1 : aNode.getAttribute( ATTRNAME_SEQ );
            newLabel = this.getString("dcTreeview_" + nodeType + "Label", [nodeSeq]);
         }

         return newLabel;

      } catch( e ) {
         this.logger.logException( e );
      }
   },

   /**
    * Get the label to display on the treeview node for the event
    * @this {DejaClickUi.TreeViewHelpers}
    * @param {!Element} aEventNode
    * @returns {string}
    * @private
    */
   _getEventLabelByType: function (aEventNode) {
      var eventType, eventLabel, params;
      try {
         // show the event type and target as event tree label
         eventType = aEventNode.getAttribute( ATTRNAME_TYPE );

         switch (eventType) {
            case "navigate":
               var url = this.script.domTreeGetEventParam(aEventNode, "urlrequested");
               params = [url];
               break;
            case "click":
            case "hover":
            case "move":
            case "drag":
            case "focus":
            case "change":
               var elt = this._getFirstCrumbLabel(aEventNode);
               params = [elt];
               break;
            case "submit":
            case "winopen":
            case "winclose":
            case "tabopen":
            case "tabclose":
            case "tabfocus":
               params = [];
               break;
            default:
               // unknown type
               eventLabel = "";
               break;
         }

         if (params) {
            eventLabel = this.getString("dcTreeview_" + eventType + "Label", params);
         }

         return eventLabel;

      } catch(ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Get the label for the event based on crumb element
    * @this {DejaClickUi.TreeViewHelpers}
    * @param {!Element} aEventNode
    * @returns {string}
    * @private
    */
   _getFirstCrumbLabel: function (aEventNode) {
      // drill down for the target element type
      var xpath = "child::targets/target",
         targetNodes = this.script.processXPath(aEventNode, xpath),
         firstCrumb;

      for (var i = 0; i < targetNodes.length; i++) {
         if (targetNodes[i].getAttribute('type') == 'element') {
            firstCrumb = targetNodes[i].getElementsByTagName('crumb')[0];
            return (firstCrumb) ? firstCrumb.getAttribute('tag') : "???";
         }
      }

      return "???";
   }
};

// window load and unload handlers
$(document).ready( function() {
   DejaClickUi.treeViewHelpers = new DejaClickUi.TreeViewHelpers;
} );
}());