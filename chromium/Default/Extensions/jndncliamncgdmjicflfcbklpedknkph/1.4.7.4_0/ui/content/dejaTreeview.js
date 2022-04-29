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

/*jslint browser: true, jquery: true, curly: false, eqeqeq: false, nomen: false, onevar: false,
   forin: false, undef: false */
/*global chrome, DejaClick, DejaClickUi, Node */

'use strict';

(function() {


// constants
var NODENAME_SCRIPT     = 'script';
var NODENAME_SUBSCRIPT  = 'subscript';
var NODENAME_ACTIONS    = 'actions';
var NODENAME_ACTION     = 'action';
var NODENAME_EVENT      = 'event';

var ATTRNAME_SEQ        = 'seq';
var ATTRNAME_TYPE       = 'type';
var ATTRNAME_TRUESCREEN = 'screen';
var ATTRNAME_HASHKEY    = 'hashkey';
var ATTRNAME_BREAKPOINT = 'breakpoint';

var EXPANDLEVEL_SCRIPT  = 0;
var EXPANDLEVEL_ACTION  = 1;
var EXPANDLEVEL_EVENT   = 2;

var STATE_NORMAL     = 'norm';
var STATE_PAUSED     = 'pause';
var STATE_REPLAYING  = 'play';
var STATE_CHECKED    = 'check';
var STATE_WARNING    = 'warn';
var STATE_ERROR      = 'error';
var STATE_OFF        = 'off';

var ROOT_HASHKEY     = '1:script';


// references to background services
var gDC = {
   logger         : DejaClick.utils.logger,
   getString      : DejaClick.utils.getMessage,
   observerService: DejaClick.utils.observerService,
   script         : null
};


// module definition
var gDejaTreeView = {

   myname: "DejaTreeView",
   elems : {},

   _treeviewObj: null,
   _expandLevel: 0,
   _hashkey    : null,
   _treeViewNodes:   {},
   _treeViewNodeStates : [ STATE_NORMAL, STATE_PAUSED, STATE_REPLAYING, STATE_CHECKED,
                           STATE_WARNING, STATE_ERROR, STATE_OFF ],

   init: function(evt) {
      try {
         // get handles to frequently accessed elements
         gDejaTreeView.elems.expandLevel  = $("#expandLevel");
         gDejaTreeView.elems.treeview     = $("#treeview");

         // set up event handlers
         gDejaTreeView.elems.expandLevel.click( gDejaTreeView.expandLevel );
         gDC.observerService.addObserver( 'dejaclick:updatetreeview', gDejaTreeView.updateTreeView );
         gDC.observerService.addObserver( 'dejaclick:updatetreeviewstate', gDejaTreeView.updateTreeViewState );
         gDC.observerService.addObserver( 'dejaclick:updatetreeviewnodestate', gDejaTreeView.updateTreeViewNodeState );
         gDC.observerService.addObserver( 'dejaclick:updatetreeviewnodelabel', gDejaTreeView.updateTreeViewNodeLabel );
         gDC.observerService.addObserver( 'dejaclick:preferences', gDejaTreeView.updateProperty);
         gDC.observerService.addObserver( 'dejaclick:propertyupdated', gDejaTreeView.updateProperty );
         gDC.observerService.addObserver( 'dejaclick:validationpropertyupdated', gDejaTreeView.updateValidationProperty );
         // get initial preference value
         gDejaTreeView._expandLevel = DejaClick.utils.prefService.getPrefOption('DC_OPTID_EXPANDLEVEL');

         // initialize the treeview
         gDejaTreeView._createTreeView();
         return;

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".init" );
      }
   },

   done: function(evt) {
      try {
         //TODO destroy treeview?
         return;

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".done" );
      }
   },

   // create a treeview based on the currently loaded script
   _createTreeView: function( aHashkey ) {
      try {
         this._createTreeViewObj( this._getTreeViewData(), aHashkey );
         return;

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._createTreeView" );
      }
   },

   // create a treeview from the given data
   _createTreeViewObj: function( aTreeViewData, aHashkey ) {
      try {
         var treeview;

         gDejaTreeView.elems.treeview.bind("loaded.jstree", function(evt, data) {
            // update the treeview to the current expand level
            gDejaTreeView._setExpandLevel( gDejaTreeView._expandLevel );

            // reset the current selection to the root node
            gDejaTreeView.onTreeNodeSelected( ROOT_HASHKEY );

            // delete href attributes to disable link display on mouseover
            gDejaTreeView.elems.treeview.find('a').removeAttr('href');

            // scroll to the node with the given hashkey
            if (aHashkey) {
               gDejaTreeView._ensureVisible( aHashkey );
            }
         });

         // create a new treeview object using the given data
         gDejaTreeView.elems.treeview.jstree({
            plugins: [ "themes", "json_data", "types", "contextmenu", "ui", "hotkeys" ],
            core: {
               animation: 0   // duration of open/close animations
            },
            json_data: {
               data: aTreeViewData
            },
            types: {
               types: {
                  "default": {
                     // don't highlight the hovered node
                     hover_node: false
                  }
               }
            },
            contextmenu: {
               select_node: true,
               show_at_node: false,
               items: gDejaTreeView.getContextMenuItems
            },
            ui: {
               select_limit: 1
            },
            hotkeys: {
               // in this context, |this| is the currently focused node
               up: function() {
                  treeview.select_node( this._get_prev(), true );
               },
               down: function() {
                  treeview.select_node( this._get_next(), true );
               },
               left: function() {
                  treeview.select_node( this._get_parent(), true );
               },
               right: function() {
                  treeview.select_node( this._get_children()[0], true );
               },
               home: function() {
                  var first_node = $(".jstree-wholerow-real li:first");
                  treeview.select_node( first_node, true );
               },
	           del: function() {
		          var curr_node = this._get_node();
		          gDejaTreeView.delNode(curr_node);
	           },
		       backspace: function() {
		          var curr_node = this._get_node();
		          gDejaTreeView.delNode(curr_node);
	           },
               end: function() {
                  // select the last displayed node i.e. the last node that has no closed ancestors
                  var displayed_last_child_nodes = $(".jstree-wholerow-real li.jstree-last").not("li.jstree-closed li.jstree-last");
                  var last_displayed_node = displayed_last_child_nodes.last();
                  treeview.select_node( last_displayed_node, true );
               },
               'return': function() {
                  this.toggle_node();
               }
            }
         });

         // double-click on a node should toggle it
         gDejaTreeView.elems.treeview.bind("dblclick.jstree", function(evt) {
            treeview.toggle_node( treeview.get_selected() );
         });

         // selecting a node updates the treeview's hashkey property
         gDejaTreeView.elems.treeview.bind("select_node.jstree", function(evt, data) {
            gDejaTreeView.onTreeNodeSelected( data.rslt.obj.attr("hashkey") );
         });

         // show the full node text in the tooltip when mousing over a node
         // whose text has been cut off because it was too long and got overflowed.
         gDejaTreeView.elems.treeview.on('mouseenter', 'a', function() {
            var $this = $(this);
            if (this.offsetWidth < this.scrollWidth) {
               if (!$this.attr('title')) {
                  // extract node's direct text contents (excluding any child nodes)
                  var tooltipText = $this.contents().filter(function() {
                     return this.nodeType == Node.TEXT_NODE;
                  }).text();
                  $this.attr('title', tooltipText);
               }
            } else {
               // remove the tooltip if not needed
               if ($this.attr('title')) {
                  $this.attr('title', '');
               }
            }
         });

         // get a handle to the treeview instance
         this._treeviewObj = $.jstree._reference( gDejaTreeView.elems.treeview );

         // used as a convenient shortform in event handlers above
         treeview = this._treeviewObj;
         return;

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._createTreeViewObj" );
      }
   },

   // generates a tree data structure from the script DOM (in the format required by JSTree)
   _getTreeViewData: function() {
      function getScript() {
         gDC._resTreeRoot = null;

         // check if we have a script loaded yet
         gDC.script = DejaClick.getScript();
         if (!gDC.script) return null;

         var script = gDC.script.getScriptElement();

         // get the last results tree
         var resTrees = gDC.script.processXPath( script, "//actions[@type='replay']" );
         if (resTrees && resTrees.length) {
            gDC._resTreeRoot = resTrees[ resTrees.length-1 ];
         }

         return script;
      }

      try {
         var script = getScript();
         var tvNode = this._calcTreeViewNode( script );
         return [ tvNode ];

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._getTreeViewData" );
      }
   },

   // generates a treeview node from a script DOM node recursively (in the format required by JSTree)
   _calcTreeViewNode: function( aNode, aSubNum ) {
      var nodeType, seq, subNum, tvNode, nodeChildren, subscripts, subhash;

      function getHashkey() {
         return seq + ":" + nodeType +
            (subhash && nodeType != NODENAME_SUBSCRIPT ? ":" + subhash : "");
      }

      function getSubscriptHashkey() {
         return (subNum > 0) ? subNum + ":" + NODENAME_SUBSCRIPT : "";
      }

      function getParentHashkey() {
         var phash, pseq;
         if (nodeType == NODENAME_SCRIPT) {
            phash = null;
         } else if (nodeType == NODENAME_SUBSCRIPT) {
            phash = ROOT_HASHKEY;
         } else if (nodeType == NODENAME_ACTION) {
            phash = (subhash || ROOT_HASHKEY);
         } else if (nodeType == NODENAME_EVENT) {
            pseq = aNode.parentNode.getAttribute( ATTRNAME_SEQ );
            phash = pseq + ":" + NODENAME_ACTION + (subhash ? ":" + subhash : "");
         }
         return phash;
      }

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

      function getState() {
         var state = STATE_NORMAL;
         if (nodeType == NODENAME_EVENT) {
            // update icon state by converting the result status
            // type from any available status information
            /*jslint undef: false*/
            switch (getEventResultStatusType( seq, subNum )) {
               case "0": state = STATE_CHECKED; break;
               case "1": state = STATE_WARNING; break;
               case "2": state = STATE_ERROR; break;
               default:  break; // null means no status, so keep default state
            }
         }
         return state;
      }

      function getEventResultStatusType( aEventNum, aSubscriptNum )
      {
         // dig out the status for the latest replay of this event from the results tree
         if (gDC._resTreeRoot) {
            var xpath = "//event[@orig_seq='" + aEventNum + "' and " +
               (aSubscriptNum ? "@orig_subscriptseq='" + aSubscriptNum + "'" : "not(@orig_subscriptseq)") + "]";
            var nodeList = gDC.script.processXPath( gDC._resTreeRoot, xpath );
            if (nodeList && nodeList.length) {
               return nodeList[nodeList.length-1].getAttribute("statustype");
            }
         }
         return null;  // no event result data found
      }

      try {
         nodeType = (aNode) ? aNode.nodeName : null;
         seq = (!aNode || nodeType == NODENAME_SCRIPT) ? 1 : aNode.getAttribute( ATTRNAME_SEQ );
         subNum = Number(aSubNum) || 0;
         subhash = getSubscriptHashkey();

         if (!aNode) {
            // no script is loaded
            tvNode = {
               data: gDC.getString("dcTreeview_noScriptLabel"),
               attr: {
                  hashkey: ROOT_HASHKEY,
                  type: NODENAME_SCRIPT,
                  state: STATE_OFF
               },
               _attr: {
                  phash: null
               }
            };

         } else {
            tvNode = {
               data: this._getTreeViewNodeLabel( aNode ),
               attr: {
                  hashkey: getHashkey(),
                  type: getType(),
                  state: getState()
               },
               _attr: {
                  phash: getParentHashkey()
               }
            };

            if (aNode[ATTRNAME_BREAKPOINT]) {
               tvNode.attr.breakpoint = true;
            }

            this._updateTreeViewNodeValidationIcon(aNode, tvNode);

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
            if (tvNode.attr.state != STATE_NORMAL) {
               this._updateTreeViewNodeState( tvNode, tvNode.attr.state );
            }

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
         gDC.logger.logException( e, gDejaTreeView.myname+"._calcTreeViewNode" );
      }
   },

   // returns a descriptive label for a script DOM node
   _getTreeViewNodeLabel: function( aNode, aIgnoreUser ) {
      try {
         var newLabel = "";

         // try getting the user-specified name
         var nodeType = aNode.nodeName;
         if ((nodeType != NODENAME_EVENT) && !aIgnoreUser) {
            newLabel = gDC.script.domTreeGetAttribute(aNode, nodeType + 'name');
         }

         // try getting the user-specified description
         if (!newLabel && !aIgnoreUser) {  // XXX add this as a user config setting?
            newLabel = gDC.script.domTreeGetAttribute(aNode, 'description');
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
                  var scriptPath = gDC.script.getFilename();
                  if (scriptPath) {
                     //var path = gDC._scriptPath.split( "/" );
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
                  newLabel = gDC.script.domTreeGetAttribute(aNode, 'urlfinalized');
                  break;

               case NODENAME_EVENT:
                  // show the event type as event tree label
                  //newLabel = gDC.getEventLabelByType(aNode);
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
            newLabel = gDC.getString("dcTreeview_" + nodeType + "Label", [nodeSeq]);
         }

         return newLabel;

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._getTreeViewNodeLabel" );
      }
   },

   // get the label to display on the treeview node for the event
   _getEventLabelByType: function( aEventNode )
   {
      function getFirstCrumbLabel()
      {
         // drill down for the target element type
         var firstCrumb;
         var xpath = "child::targets/target";
         var targetNodes = gDC.script.processXPath( aEventNode, xpath );
         var displayLevel = DejaClick.utils.prefService.getPrefOption('DC_OPTID_DISPLAYLEVEL');
         for (var i=0; i < targetNodes.length; i++) {
            if (targetNodes[i].getAttribute('type') == 'element') {
               if (displayLevel == DejaClick.constants.DISPLAYLEVEL_BASIC) {
                  firstCrumb = targetNodes[i].getElementsByTagName('crumb')[0];
                  return (firstCrumb) ? firstCrumb.getAttribute('tag') : "???";
               }
               else {
                  firstCrumb = targetNodes[i].getElementsByTagName('elementpath')[0];
                  return (firstCrumb) ? firstCrumb.innerHTML : "???";
               }
            }
         }
         return "???";
      }

      try {
         var eventLabel, params;

         // show the event type and target as event tree label
         var eventType = aEventNode.getAttribute( ATTRNAME_TYPE );
         switch (eventType) {
            case "navigate":
               var url = gDC.script.domTreeGetEventParam(aEventNode, "urlrequested");
               params = [url];
               break;
            case "click":
            case "hover":
            case "move":
            case "drag":
            case "focus":
            case "change":
               var elt = getFirstCrumbLabel();
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
            eventLabel = gDC.getString("dcTreeview_" + eventType + "Label", params);
         }

         return eventLabel;

      } catch ( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._getEventLabelByType" );
      }
   },

   // update the state of a TreeView data node
   _updateTreeViewNodeState : function( aTVNode, aState, aFromState )
   {
      try {
         if (!aTVNode) return;

         var mynode = aTVNode, pnode;

         // assign the new display state to the tree node
         // and its ancestors in the tree view hierarchy as needed
         do {
            // if aFromState is specified, only update nodes
            // whose current state matches aFromState.
            if (!aFromState || (mynode.attr.state == aFromState)) {
               mynode.attr.state = aState;
            }

            pnode = (mynode._attr.phash) ? this._treeViewNodes[mynode._attr.phash] : null;
         } while (pnode && (aState != STATE_NORMAL) && (mynode = pnode));

         return;

      } catch ( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._updateTreeViewNodeState" );
      }
   },

   expandLevel: function() {
      try {
         var expandLevel = gDejaTreeView._expandLevel;
         var nextLevel = (expandLevel == EXPANDLEVEL_EVENT) ? EXPANDLEVEL_SCRIPT : expandLevel + 1;
         gDejaTreeView._setExpandLevel( nextLevel );
         return;

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".expandLevel" );
      }
   },

   // update the expansion level of the treeview
   _setExpandLevel: function( aLevel ) {
      try {
         this._expandLevel = aLevel;

         var treeview = gDejaTreeView._treeviewObj;
         if (!treeview) { return; }

         var label, tooltip;
         switch(aLevel) {
            case EXPANDLEVEL_SCRIPT:
               treeview.close_all();
               label = gDC.getString("dcTreeview_expandLevelScripts");
               tooltip = gDC.getString("dcTreeview_expandLevelExpand");

               // reset the current selection to the root node
               gDejaTreeView.onTreeNodeSelected( ROOT_HASHKEY );
               break;
            case EXPANDLEVEL_ACTION:
               // display action nodes by opening script nodes
               treeview.open_node( $("li[type=" + NODENAME_SCRIPT + "]") );
               treeview.close_node( $("li[type=" + NODENAME_ACTION + "]") );
               label = gDC.getString("dcTreeview_expandLevelActions");
               tooltip = gDC.getString("dcTreeview_expandLevelExpand");
               break;
            case EXPANDLEVEL_EVENT:
               treeview.open_all();
               label = gDC.getString("dcTreeview_expandLevelEvents");
               tooltip = gDC.getString("dcTreeview_expandLevelCollapse");
               break;
         }

         // update label and tooltip text
         gDejaTreeView.elems.expandLevel.val( label );
         gDejaTreeView.elems.expandLevel.attr( "title", tooltip );
         return;

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._setExpandLevel" );
      }
   },

   delNode: function (aNode) {
	  try {
         var node = aNode;
         var scriptNodes = null;
         var runMode = DejaClick.service.getRunMode();
         if ((runMode != DejaClick.constants.RUNMODE_INACTIVE) && (runMode != DejaClick.constants.RUNMODE_STOPPED)) {
            window.alert(gDC.getString("dcTreeview_scriptActiveCantDelete"));
            return;
         }
		 
         var ok = window.confirm(gDC.getString("dcTreeview_sureDelete"));
		 if (!ok) {
            return;
         }
         var splitArray = $(node).attr(ATTRNAME_HASHKEY).split(":");
         if (splitArray && splitArray.length >= 2) {
            var nodeType = splitArray[1];
            var nodeSeq = splitArray[0];
            var prependString = "//";
            if (splitArray.length > 2) {
               var subscriptSeq = splitArray[2];
               prependString = "//subscript[@seq='" + subscriptSeq + "']/";
            }
            var appendString = (nodeType == "event") ? "action/" : "";
            var xPathString = prependString + "actions[@type='record']/" + appendString + nodeType + "[@seq='" + nodeSeq + "']";
            var script = gDC.script.getScriptElement();
            scriptNodes = gDC.script.processXPath( script, xPathString );
            var parentNode = scriptNodes[0].parentNode;

            if (parentNode.getElementsByTagName(nodeType).length > 1) {
	           gDC.script.domTreeRemoveNode(scriptNodes[0]);
            }
			else {
               var nodeName = parentNode.nodeName;
               gDC.script.domTreeRemoveNode(parentNode);
               gDC.script.renumberElements(nodeName);
            }
            gDC.script.renumberElements(nodeType);
            gDejaTreeView.updateTreeView();
         }
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".delNode" );
      }	   
   },
   
   getContextMenuItems: function( aNode ) {
      try {
         var items = {
            breakpoint: {
               label: "Pause",
               _class: "breakpoint",
               action: function() {
//                  var node = this._get_node();
                  var node = aNode;
                  var scriptNodes = null;
                  var splitArray = $(node).attr(ATTRNAME_HASHKEY).split(":");
                  if (splitArray && splitArray.length >= 2) {
                     var nodeType = splitArray[1];
                     var nodeSeq = splitArray[0];
                     var prependString = "//";
                     if (splitArray.length > 2) {
                        var subscriptSeq = splitArray[2];
                        prependString = "//subscript[@seq='" + subscriptSeq + "']/";
                     }
                     var appendString = (nodeType == "event") ? "action/" : "";
                     var xPathString = prependString + "actions[@type='record']/" + appendString + nodeType + "[@seq='" + nodeSeq + "']";
                     var script = gDC.script.getScriptElement();
                     scriptNodes = gDC.script.processXPath( script, xPathString );
                  }

                  if (node.attr( ATTRNAME_BREAKPOINT )) {
                     node.removeAttr( ATTRNAME_BREAKPOINT );
                     if (scriptNodes && scriptNodes.length) {
                        scriptNodes[0].breakpoint = false;
						scriptNodes[0].breakpointType = DejaClick.constants.BREAKPOINT_TYPE_NONE;
                     }
                  } else {
                     node.attr( ATTRNAME_BREAKPOINT, "true" );
                     if (scriptNodes && scriptNodes.length) {
                        scriptNodes[0].breakpoint = true;
						scriptNodes[0].breakpointType = DejaClick.constants.BREAKPOINT_TYPE_NONE;
                     }
                  }
                  DejaClick.utils.prefService.setPrefOption('DC_OPTID_APPENDMODE', DejaClick.constants.DC_APPENDMODE_DEFAULT);
                  //TODO add checkmark to context menu item
               }
            },
            recordAppend: {
               label: "Record Append",
               _class: "breakpoint",
               action: function() {
//                  var node = this._get_node();
                  var node = aNode;
                  var scriptNodes = null;
                  var splitArray = $(node).attr(ATTRNAME_HASHKEY).split(":");
                  if (splitArray && splitArray.length >= 2) {
                     var nodeType = splitArray[1];
                     var nodeSeq = splitArray[0];
                     var prependString = "//";
                     if (splitArray.length > 2) {
                        var subscriptSeq = splitArray[2];
                        prependString = "//subscript[@seq='" + subscriptSeq + "']/";
                     }
                     var appendString = (nodeType == "event") ? "action/" : "";
                     var xPathString = prependString + "actions[@type='record']/" + appendString + nodeType + "[@seq='" + nodeSeq + "']";
                     var script = gDC.script.getScriptElement();
                     scriptNodes = gDC.script.processXPath( script, xPathString );
                  }

                  if (node.attr( ATTRNAME_BREAKPOINT )) {
                     node.removeAttr( ATTRNAME_BREAKPOINT );
                     if (scriptNodes && scriptNodes.length) {
                        scriptNodes[0].breakpoint = false;
                        scriptNodes[0].breakpointType = DejaClick.constants.BREAKPOINT_TYPE_NONE;
                     }
                  } else {
                     node.attr( ATTRNAME_BREAKPOINT, "true" );
                     if (scriptNodes && scriptNodes.length) {
                        scriptNodes[0].breakpoint = true;
                        scriptNodes[0].breakpointType = DejaClick.constants.BREAKPOINT_RECORD_APPEND;
                     }
                  }
                  DejaClick.utils.prefService.setPrefOption('DC_OPTID_APPENDMODE', DejaClick.constants.DC_APPENDMODE_INSERT);
//		  DejaClick.utils.prefService.getPrefOption('DC_OPTID_APPENDMODE');

                  DejaClick.service.setRunMode( DejaClick.constants.RUNMODE_RECORD_APPEND );
               }
            },
	    remove : {
               label: "Delete",
               action: function() {
	          gDejaTreeView.delNode(aNode);
               }
            }
         };

         return ($(aNode).attr(ATTRNAME_HASHKEY).match(/action|event/)) ? items : null;

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".getContextMenuItems" );
      }
   },

   onTreeNodeSelected: function( aHashkey ) {
      try {
         // default to the top-level script hashkey if an invalid value is passed in.
         gDejaTreeView._hashkey = aHashkey || ROOT_HASHKEY;

         // notify observers that the treeview selection has changed.
         gDC.observerService.notifyLocalObservers('dejaclick:treeclicked', {hashkey: gDejaTreeView._hashkey});
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".onTreeNodeSelected" );
      }
   },

   // returns the hashkey of the currently selected node
   getHashkey: function() {
      try {
         return gDejaTreeView._hashkey;
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".getHashkey" );
      }
   },

   // handles the 'dejaclick:updatetreeview' observer notification
   updateTreeView: function( aData ) {
      try {
         // recreate the treeview
         gDejaTreeView._treeviewObj.destroy();

         var hashkey = (aData) ? aData.hashkey : null;
         gDejaTreeView._createTreeView( hashkey );
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".updateTreeView" );
      }
   },

   // handles the 'dejaclick:updatetreeviewstate' observer notification
   updateTreeViewState: function( aData ) {
      try {
         var toState = gDejaTreeView.getTreeViewNodeState( aData.state ),
             fromState = gDejaTreeView.getTreeViewNodeState( aData.fromState );

         // update the state of every treeview node
         for (var key in gDejaTreeView._treeViewNodes) {
            if (!gDejaTreeView._treeViewNodes.hasOwnProperty(key)) continue;

            var mynode = gDejaTreeView._treeViewNodes[key];

            // if aFromState is specified, only update nodes
            // whose current state matches aFromState.
            if (!fromState || (mynode.attr.state == fromState)) {
               mynode.attr.state = toState;
            }
         }

         // update the treeview directly
         var tvnQuery = (fromState) ? 'li[state=' + fromState + ']' : 'li[state]';
         gDejaTreeView.elems.treeview.find( tvnQuery ).attr('state', toState);
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".updateTreeViewState" );
      }
   },

   // converts from dejaService's TREETYPE_* to our STATE_* constants
   getTreeViewNodeState: function( aState ) {
      try {
         if (typeof aState === 'undefined') return null;

         return gDejaTreeView._treeViewNodeStates[ aState ];
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".getTreeViewNodeState" );
      }
   },

   // handles the 'dejaclick:updatetreeviewnodestate' observer notification
   updateTreeViewNodeState: function( aData ) {
      try {
         var tvnode = gDejaTreeView._treeViewNodes[aData.hashkey];
         if (!tvnode) return;

         var toState = gDejaTreeView.getTreeViewNodeState( aData.state ),
             fromState = gDejaTreeView.getTreeViewNodeState( aData.fromState );

         // update the treeview node's state and roll up to its parents
         gDejaTreeView._updateTreeViewNodeState( tvnode, toState, fromState );

         // update the treeview directly
         var pnode;
         var dontScroll = false;
         do {
            var tvnQuery = 'li[hashkey=\'' + tvnode.attr.hashkey + '\'][state' +
               (fromState ? '=' + fromState : '') + ']';
            gDejaTreeView.elems.treeview.find( tvnQuery ).attr('state', toState);

            if (!dontScroll) {
               // scroll the treeview node into view, if needed
               gDejaTreeView._ensureVisible( tvnode.attr.hashkey );
            }

            pnode = (tvnode._attr.phash) ? gDejaTreeView._treeViewNodes[tvnode._attr.phash] : null;

            // don't scroll to the ancestor nodes when updating them
            // so that the specified node remains visible in the treeview.
            // Make an exception for 1st child nodes, so that the
            // script node will always be scrolled into view when starting replay.
            var is1stChild = (pnode && pnode.children && pnode.children.length) ?
               pnode.children[0] == tvnode :
               false;
            dontScroll = aData.ensureVisible && !is1stChild;

         } while (pnode && (toState != STATE_NORMAL) && (tvnode = pnode));
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".updateTreeViewNodeState" );
      }
   },

   // scrolls the treeview node into view, if needed
   _ensureVisible: function( aHashkey ) {
      try {
         var tvnode = gDejaTreeView._treeViewNodes[aHashkey];
         if (!tvnode) return;

         var tvnQuery = 'li[hashkey=\'' + tvnode.attr.hashkey + '\'] > a';
         var $node = gDejaTreeView.elems.treeview.find( tvnQuery );

         var node = $node.get(0);
         if (node) {
            // check if the node is already visible relative to the treeview.
            // Else scroll it into view.
            var treeview = gDejaTreeView.elems.treeview.get(0);
            var nodeRelativeTop = node.offsetTop - treeview.offsetTop;
            if (treeview.scrollTop > nodeRelativeTop) {
               treeview.scrollTop = nodeRelativeTop;
            } else {
               var nodeRelativeBottom = (node.offsetTop + node.clientHeight) -
                  (treeview.offsetTop + treeview.clientHeight);
               if (treeview.scrollTop < nodeRelativeBottom) {
                  treeview.scrollTop = nodeRelativeBottom;
               }
            }
         }
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._ensureVisible" );
      }
   },

   // handles the 'dejaclick:updatetreeviewnodelabel' observer notification
   updateTreeViewNodeLabel: function( aData ) {
      try {
         var tvnode = gDejaTreeView._treeViewNodes[aData.hashkey];
         if (!tvnode) return;

         tvnode.data = aData.label;

         // update the treeview directly
         var $a = gDejaTreeView.elems.treeview.find('li[hashkey=\'' + aData.hashkey + '\']').
            children('a').first();
         var tvnLabel = $a.contents().last().get(0);
         if (tvnLabel) {
            tvnLabel.nodeValue = aData.label;
         }
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".updateTreeViewNodeLabel" );
      }
   },


   // handles the 'dejaclick:updateproperty' observer notification
   updateProperty: function( aData ) {

      function updateNodeLabel( hashkey, node ) {
         if (!node) {
            node = DejaClick.getScript().getHashkeyNode( hashkey );
         }

         if (node) {
            var newLabel = gDejaTreeView._getTreeViewNodeLabel( node );
            var data = {
               hashkey: hashkey,
               label: newLabel
            };
            gDejaTreeView.updateTreeViewNodeLabel( data );
         }
      }

      try {
      
         // handle event description changes when display level is changed
         if (aData.key === 'DC_OPTID_DISPLAYLEVEL') {
            var actTreeRoots = DejaClick.getScript().getActTreeRoots();
            if (actTreeRoots.length > 0) {
               var elems = actTreeRoots[0].getElementsByTagName( NODENAME_EVENT );
               for (var i = 0; i < elems.length; i++) {
                  var eventNum = i + 1;
                  var hash = eventNum + ":event";
                  updateNodeLabel(hash, elems[i]);
               }
               if (actTreeRoots.length > 1) {
                  for (var subsNum = 1; subsNum < actTreeRoots.length; subsNum++) {
                     var subsEvents = actTreeRoots[subsNum].getElementsByTagName(NODENAME_EVENT);
                     for (var j = 0; j < subsEvents.length; j++) {
                        var eventNum = j+1;
                        var hashKey = eventNum + ":event:" + subsNum + ":subscript";
                        updateNodeLabel(hashKey, subsEvents[j]);
                     }
                  }
               }
            }
            return;
         }
         
         // ignore updates to system properties
         if ((aData.category == 'play') ||
             (aData.category == 'record') ||
             (aData.category == 'none')) {
            return;
         }
         if(!DejaClick.getScript()){
            return;
         }
         var node = DejaClick.getScript().getHashkeyNode(aData.hashkey);

         switch(aData.property) {
            case 'description':
               // update the given node's label
               updateNodeLabel( aData.hashkey );
               break;
            case 'eventInput':
               // update the given node's label if it is a navigate event
               if (node && (node.nodeName == NODENAME_EVENT) &&
                           (node.getAttribute(ATTRNAME_TYPE) == 'navigate')) {

                  updateNodeLabel( aData.hashkey, node );

                  // and update its parent action's label as well
                  var parentNode = node.parentNode;
                  var parentHash = parentNode.getAttribute(ATTRNAME_SEQ) +
                     ':' + NODENAME_ACTION;
                  // handle subscripts as well
                  var hashParts = aData.hashkey.split(':');
                  if (hashParts.length > 2) {
                     parentHash += hashParts[2] + ':' + hashParts[3];
                  }
                  updateNodeLabel( parentHash, parentNode );
               }
               break;
            case 'kwValidations':
            case 'jsValidations':
               gDejaTreeView._updateTreeViewNodeValidationIcon(node, null, aData.hashkey);
               break;
            default:
               break;
         }
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".updateProperty" );
      }
   },

   // handles the 'dejaclick:validationpropertyupdated' observer notification
   updateValidationProperty: function (aData) {
      try {
         if (aData) {
            gDejaTreeView._updateTreeViewNodeValidationIcon(aData.node, null, aData.hashkey);
         }
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".updateValidationProperty" );
      }
   },

   _updateTreeViewNodeValidationIcon: function (aNode, aTVNode, aHashkey) {
      var kw = [], js = [], tvNode, tvNodeElt;

      try {
         if (aNode && (aTVNode || aHashkey)) {
            kw = gDC.script.processXPath( aNode, "child::validations/validation[@type='1']" );
            js = gDC.script.processXPath( aNode, "child::validations/validation[@type='2']" );

            tvNode = aTVNode || gDejaTreeView._treeViewNodes[aHashkey];

            if (tvNode) {
               kw.length && (tvNode.attr.kwVal = true) || delete tvNode.attr.kwVal;
               js.length && (tvNode.attr.jsVal = true) || delete tvNode.attr.jsVal;

               if (aHashkey) {
                  // update the treeview directly
                  tvNodeElt = gDejaTreeView.elems.treeview.find('li[hashkey=\'' + aHashkey + '\']');

                  kw.length && tvNodeElt.attr('kwVal', true) || tvNodeElt.removeAttr('kwVal');
                  js.length && tvNodeElt.attr('jsVal', true) || tvNodeElt.removeAttr('jsVal');
               }
            }
         }
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._updateTreeViewNodeValidationIcon" );
      }
   }
};

DejaClickUi.treeview = gDejaTreeView;


// window load and unload handlers
$(document).ready( gDejaTreeView.init );
$(window).unload( gDejaTreeView.done );

}());
